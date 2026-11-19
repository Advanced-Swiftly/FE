import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import type { Judgment } from '@/constants/status';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { previewPolicy, createPolicyRequest, getBreedNames, getStorePolicy, resubmitPolicyRequest, sameRules, type RuleSet, type StorePolicy } from '@/api/policy';
import { uploadFile } from '@/api/files';
import { getPendingConditionRequests, getRequestDetail } from '@/api/requests';
import { Button, ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, TextArea } from '@/components/common/Field';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ConditionChanges, PolicyRulesEditor, PolicyRulesView } from '@/components/policy/PolicyRules';
import { StatusChip } from '@/components/common/StatusChip';
import { RequestDetailModal } from '@/components/requests/RequestDetailModal';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { ConditionRequestDetail } from '@/types';

const URL_RE = /^(https?:\/\/\S+|\/api\/v1\/files\/[0-9a-f-]{36})$/i;
/** 서버 판정값 → 화면 판정 표시 */
const VERDICT: Record<string, Judgment> = { ENTRY_OK: 'ENTRY_OK', PREPARE: 'PREPARE', CHECK_REQUIRED: 'UNKNOWN', ENTRY_DENIED: 'NO_ENTRY' };
const SCOPE_NOTE = '실내·야외 조건과 적용 시작일을 확인해 주세요. 운영자 승인 전까지 기존 조건이 유지돼요.';

/** 서버 모드 UI-W-009 입장 조건 현황 — GET /business/stores/{storeId}/policy */
export function ServerConditionsPage() {
  const { store } = useCurrentStore();
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const policy = useFetch(`policy:${store.id}`, () => getStorePolicy(store.id));
  const breeds = useFetch('breeds', getBreedNames);
  const pending = useFetch(`pending-conditions:${store.id}`, () => getPendingConditionRequests(store.id));
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  return (
    <div className={page.stack}>
      <PageHeader title="입장 조건 현황" description="보호자에게 안내되는 우리 매장 입장 조건이에요. 바꾸려면 변경 요청을 보내 주세요. 운영자가 승인하면 반영돼요." />
      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })} action={<Link to="/requests">요청 처리 현황</Link>}>
          {flash}
        </Notice>
      )}
      <Notice>{SCOPE_NOTE}</Notice>
      {pending.status === 'error' && (
        <Notice
          tone="warning"
          action={
            <Button variant="secondary" size="sm" onClick={pending.reload}>
              다시 불러오기
            </Button>
          }
        >
          진행 중인 변경 요청을 불러오지 못했어요.
        </Notice>
      )}
      {pending.data && pending.data.length > 0 && (
        <Card title="진행 중인 변경 요청" aside={`${pending.data.length}건`}>
          <p className={page.muted}>운영자가 승인하기 전까지 아래 현재 입장 조건이 그대로 유지돼요.</p>
          <ul className={page.stackSm} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pending.data.map((r) => (
              <li key={r.id} className={page.actionsBetween}>
                <span>
                  <StatusChip status={r.status} /> {r.sourcePreview ?? r.summaryText}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setOpenRequestId(r.id)}>
                  자세히
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <LoadState status={policy.status} errorText={policy.error?.message} onRetry={policy.reload} />
      {policy.data && (
        <Card title="현재 입장 조건" aside={policy.data.exists ? `정책 버전 ${policy.data.version}` : '아직 등록된 정책 없음'}>
          {policy.data.exists ? <PolicyRulesView rules={policy.data} breeds={breeds.data ?? new Map()} indoorAction={policy.data.conditions?.indoor?.allowed ? <ButtonLink to="/conditions/edit?item=weight" variant="secondary" size="sm">체중 제한 수정 요청</ButtonLink> : undefined} /> : <p className={page.muted}>아직 운영자가 확인한 입장 정책이 없어요. 변경 요청으로 처음 정책을 보낼 수 있어요.</p>}
          {breeds.status === 'error' && <p className={page.muted}>견종 이름을 불러오지 못해 견종 ID 로 보여 줘요.</p>}
          <div className={page.actionsBetween}>
            <span />
            <ButtonLink to="/conditions/edit">변경 요청 보내기</ButtonLink>
          </div>
        </Card>
      )}
      <RequestDetailModal requestId={openRequestId} onClose={() => setOpenRequestId(null)} onChanged={pending.reload} />
    </div>
  );
}

/** 서버 모드 UI-W-011 입장 조건 변경 요청 · ?request= 보완 제출 */
export function ServerConditionEditPage() {
  const { store } = useCurrentStore();
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const [round, setRound] = useState(0);
  const policy = useFetch(`policy:${store.id}:${round}`, () => getStorePolicy(store.id));
  const breeds = useFetch('breeds', getBreedNames);
  const request = useFetch(`request:${requestId ?? 'none'}:${round}`, () => (requestId ? getRequestDetail(requestId) : Promise.resolve(null)));
  const ready = policy.status === 'success' && (!requestId || request.status === 'success');
  const failed = policy.status === 'error' ? policy : requestId && request.status === 'error' ? request : null;
  const r = request.data ?? null;
  const blocked = r && (!r.canResubmit || r.status !== 'NEEDS_INFO') ? `이 요청은 지금 보완할 수 없어요 (${REQUEST_STATUS_LABEL[r.status] ?? r.status}). 요청 처리 현황에서 상태를 확인해 주세요.` : null;
  return (
    <div className={page.stack}>
      <PageHeader title={requestId ? '보완해서 다시 보내기' : '입장 조건 변경 요청'} description={SCOPE_NOTE} />
      {failed && <LoadState status="error" errorText={failed.error?.message} onRetry={failed.reload} />}
      {!ready && !failed && <LoadState status="loading" />}
      {ready && blocked && <Notice tone="warning">{blocked}</Notice>}
      {ready && !blocked && policy.data && (
        <EditForm key={`${policy.data.version}:${round}`} policy={policy.data} breeds={breeds.data ?? new Map()} request={r} onReload={() => setRound((x) => x + 1)} />
      )}
    </div>
  );
}

function parseUrls(text: string) {
  return text
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function EditForm({ policy, breeds, request, onReload }: { policy: StorePolicy; breeds: Map<string, string>; request: ConditionRequestDetail | null; onReload: () => void }) {
  const navigate = useNavigate();
  const { store } = useCurrentStore();
  const resubmit = request !== null;
  // 지금 정책 전체에서 시작해요 — 고치지 않은 조건도 그대로 함께 보내져서 지워지지 않아요
  const [draft, setDraft] = useState<RuleSet>({ conditions: request?.requestedPolicy?.conditions ?? policy.conditions, breedRules: [...(request?.requestedPolicy?.breedRules ?? policy.breedRules)], equipmentRules: [...(request?.requestedPolicy?.equipmentRules ?? policy.equipmentRules)], vaccineRules: [...(request?.requestedPolicy?.vaccineRules ?? policy.vaccineRules)] });
  // 보완 제출: BE 상세에 이전 요청 정책이 없어서, 정책을 다시 보낼지는 직접 고르게 해요 (보내지 않으면 이전 요청 정책 그대로)
  const [sendPolicy, setSendPolicy] = useState(!resubmit);
  const [sourceText, setSourceText] = useState(request?.sourceText ?? '');
  const [urlText, setUrlText] = useState('');
  const [uploaded, setUploaded] = useState<{name:string;url:string}[]>([]);
  const [uploading,setUploading] = useState(false);
  const [uploadError,setUploadError] = useState<string|null>(null);
  const [tried, setTried] = useState(false);
  // 입력이 멈춘 뒤에 판정을 다시 불러와요 (글자마다 서버를 부르지 않게)
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const t = setTimeout(() => setPreviewDraft(draft), 400);
    return () => clearTimeout(t);
  }, [draft]);
  const preview=useFetch(`policy-preview:${store.id}:${JSON.stringify(previewDraft)}`,()=>previewPolicy(store.id,previewDraft));
  // 체중 제한의 [수정 요청]으로 들어오면 실내 체중 입력칸으로 바로 이동해요
  const [params] = useSearchParams();
  const focusItem = params.get('item');
  useEffect(() => {
    if (focusItem !== 'weight') return;
    const el = document.getElementById('area-indoor-weight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }, [focusItem]);
  const create = useAction(createPolicyRequest);
  const re = useAction(resubmitPolicyRequest);
  const action = resubmit ? re : create;

  const urls = [...parseUrls(urlText), ...uploaded.map(f=>f.url)];
  const badUrl = urls.find((u) => !URL_RE.test(u) || u.length > 500);
  const changed = !sameRules(draft, policy);
  // 정책 원문은 승인되면 입장 조건의 근거로 저장되는 값이라, 공지 · 변경 사유로 대신 채우지 않고 직접 적게 해요
  const sourceMissing = !resubmit && sourceText.trim().length === 0;
  const blockers = [
    !resubmit && !changed ? '바꿀 입장 조건을 하나 이상 고쳐 주세요.' : null,
    resubmit && !sendPolicy && sourceText.trim() === '' && urls.length === 0 ? '보완할 정책, 정책 원문, 근거 중 하나 이상을 입력해 주세요.' : null,
    sourceMissing ? '정책 원문을 적어 주세요.' : null,
    badUrl ? '근거 주소 형식을 확인해 주세요.' : null,
    urls.length > 10 ? '근거 자료는 10개까지 첨부할 수 있어요.' : null,
  ].filter((x): x is string => x !== null);
  const canSubmit = !uploading && !action.pending && blockers.length === 0;
  const conflict = action.errorCode === 'POLICY_VERSION_CONFLICT';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!canSubmit) return;
    const res = resubmit ? await re.run(request.id, sendPolicy ? draft : null, sourceText, urls) : await create.run(store.id, policy.version, draft, sourceText, urls);
    if (res.ok) navigate('/conditions', { state: { flash: resubmit ? '보완 내용을 보냈어요. 운영자가 다시 확인해요.' : '변경 요청을 보냈어요. 운영자가 승인하면 반영돼요.' } });
  };

  return (
    <form className={page.stack} onSubmit={onSubmit} noValidate>
      {resubmit && request.reason && (
        <Notice tone="warning">
          <strong>보완 요청 사유</strong> · {request.reason}
        </Notice>
      )}
      <Card title={resubmit ? '요청 정책' : '바꿀 입장 조건'} aside={policy.exists ? `기준 정책 버전 ${policy.version}` : '기준 버전 0 (등록된 정책 없음)'}>
        {resubmit && (
          <Choice type="checkbox" label="요청 정책을 고쳐서 다시 보내기 (지금 정책 기준으로 전체를 다시 보내요)" checked={sendPolicy} onChange={(e) => setSendPolicy(e.target.checked)} />
        )}
        {(!resubmit || sendPolicy) && <PolicyRulesEditor value={draft} onChange={setDraft} breeds={breeds} />}
        {!resubmit && !changed && <p className={page.muted}>지금 정책과 달라진 조건이 없어요.</p>}
        {(!resubmit || sendPolicy) && changed && (
          <>
            <h3 className={page.muted}>변경 요약</h3>
            <ConditionChanges before={policy.conditions} after={draft.conditions} />
            <PolicyRulesView rules={draft} compareTo={policy} breeds={breeds} hideConditions />
          </>
        )}
      </Card>
      <Card title="변경 후 입장 예시" aside="승인되면">
        {preview.status === 'loading' && <p className={page.muted}>입장 판정을 계산하고 있어요…</p>}
        {preview.status === 'error' && (
          <Notice
            tone="warning"
            action={
              <Button variant="secondary" size="sm" onClick={preview.reload}>
                다시 계산
              </Button>
            }
          >
            입장 예시를 불러오지 못했어요.
          </Notice>
        )}
        {preview.data && (
          <>
            <p>
              <strong>{preview.data.example}</strong>
            </p>
            <p style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span>변경 전</span>
              <JudgmentChip judgment={VERDICT[preview.data.before] ?? 'UNKNOWN'} />
              <Icon name="arrowRight" size={16} />
              <span>변경 후</span>
              <JudgmentChip judgment={VERDICT[preview.data.after] ?? 'UNKNOWN'} />
            </p>
            <p className={page.muted}>{preview.data.before === preview.data.after ? '이 변경으로 예시 반려견의 판정은 달라지지 않아요.' : '운영자 승인 후 적용 시작일부터 반영돼요.'}</p>
          </>
        )}
      </Card>
      <Card title="근거">
        <label>근거 파일 추가
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={uploading} onChange={async e=>{
            const files=Array.from(e.target.files ?? []);e.target.value='';
            if(files.length+urls.length>10){setUploadError('근거 자료는 10개까지 첨부할 수 있어요.');return;}
            setUploading(true);setUploadError(null);
            try {const next=await Promise.all(files.map(async file=>({name:file.name,url:await uploadFile(file)})));setUploaded(old=>[...old,...next]);}
            catch {setUploadError('파일을 올리지 못했어요. 다시 시도해 주세요.');}
            finally {setUploading(false);}
          }}/>
        </label>
        {uploading && <p>파일을 올리고 있어요.</p>}
        {uploadError && <Notice tone="danger">{uploadError}</Notice>}
        {uploaded.map(file=><p key={file.url}>{file.name}</p>)}
        <Field
          label={resubmit ? '정책 원문 (바꿀 때만)' : '정책 원문 (필수)'}
          htmlFor="sv-source"
          hint={`매장 안내문 등 입장 조건의 근거가 되는 원문을 그대로 적어 주세요. 승인되면 입장 조건의 근거로 저장돼요. ${sourceText.trim().length}/2000`}
          message={tried && sourceMissing ? { tone: 'error', text: '정책 원문을 적어 주세요' } : null}
        >
          <TextArea id="sv-source" rows={4} maxLength={2000} value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
        </Field>
        <Field
          label="근거 주소 (선택)"
          htmlFor="sv-urls"
          hint={`공지 · 사진이 있는 http(s) 주소를 한 줄에 하나씩, 10개까지 적어 주세요 (${urls.length}/10). 사진·PDF 파일도 첨부할 수 있어요.${resubmit ? ' 이미 보낸 주소에 더해져요.' : ''}`}
          message={badUrl ? { tone: 'error', text: `주소 형식을 확인해 주세요: ${badUrl}` } : urls.length > 10 ? { tone: 'error', text: '근거 주소는 10개까지예요' } : null}
        >
          <TextArea id="sv-urls" rows={3} value={urlText} onChange={(e) => setUrlText(e.target.value)} />
        </Field>
      </Card>
      {tried && blockers.length > 0 && (
        <Notice tone="warning" role="alert">
          <strong>아직 보낼 수 없어요</strong>
          {blockers.map((b) => (
            <span key={b} style={{ display: 'block' }}>
              {b}
            </span>
          ))}
        </Notice>
      )}
      {action.error && (
        <Notice
          tone="danger"
          role="alert"
          action={
            conflict ? (
              <Button variant="secondary" size="sm" onClick={onReload}>
                최신 조건 불러오기
              </Button>
            ) : undefined
          }
        >
          {action.error}
        </Notice>
      )}
      <div className={page.actionsBetween}>
        <ButtonLink to="/conditions" variant="secondary">
          취소
        </ButtonLink>
        <Button type="submit" disabled={uploading || action.pending}>
          {action.pending ? '보내는 중…' : resubmit ? '보완해서 다시 보내기' : '변경 요청 보내기'}
        </Button>
      </div>
    </form>
  );
}
