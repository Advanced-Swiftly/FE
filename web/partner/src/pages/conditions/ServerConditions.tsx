import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createPolicyRequest, getBreedNames, getStorePolicy, resubmitPolicyRequest, sameRules, type RuleSet, type StorePolicy } from '@/api/policy';
import { getRequestDetail } from '@/api/requests';
import { Button, ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, TextArea } from '@/components/common/Field';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { PolicyRulesEditor, PolicyRulesView } from '@/components/policy/PolicyRules';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { ConditionRequestDetail } from '@/types';

const URL_RE = /^https?:\/\/\S+$/;
const SCOPE_NOTE = '서버 입장 정책은 견종 · 준비물 · 예방접종 조건만 다뤄요. 동반 가능 여부 · 체중 · 크기 · 이용 구역은 아직 서버에 없어요.';

/** 서버 모드 UI-W-009 입장 조건 현황 — GET /business/stores/{storeId}/policy */
export function ServerConditionsPage() {
  const { store } = useCurrentStore();
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const policy = useFetch(`policy:${store.id}`, () => getStorePolicy(store.id));
  const breeds = useFetch('breeds', getBreedNames);
  return (
    <div className={page.stack}>
      <PageHeader title="입장 조건 현황" description="보호자에게 안내되는 우리 매장 입장 조건이에요. 바꾸려면 변경 요청을 보내 주세요. 운영자가 승인하면 반영돼요." />
      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })} action={<Link to="/requests">요청 처리 현황</Link>}>
          {flash}
        </Notice>
      )}
      <Notice>{SCOPE_NOTE}</Notice>
      <LoadState status={policy.status} errorText={policy.error?.message} onRetry={policy.reload} />
      {policy.data && (
        <Card title="현재 입장 조건" aside={policy.data.exists ? `정책 버전 ${policy.data.version}` : '아직 등록된 정책 없음'}>
          {policy.data.exists ? <PolicyRulesView rules={policy.data} breeds={breeds.data ?? new Map()} /> : <p className={page.muted}>아직 운영자가 확인한 입장 정책이 없어요. 변경 요청으로 처음 정책을 보낼 수 있어요.</p>}
          {breeds.status === 'error' && <p className={page.muted}>견종 이름을 불러오지 못해 견종 ID 로 보여 줘요.</p>}
          <div className={page.actionsBetween}>
            <span />
            <ButtonLink to="/conditions/edit">변경 요청 보내기</ButtonLink>
          </div>
        </Card>
      )}
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
  const [draft, setDraft] = useState<RuleSet>({ breedRules: [...policy.breedRules], equipmentRules: [...policy.equipmentRules], vaccineRules: [...policy.vaccineRules] });
  // 보완 제출: BE 상세에 이전 요청 정책이 없어서, 정책을 다시 보낼지는 직접 고르게 해요 (보내지 않으면 이전 요청 정책 그대로)
  const [sendPolicy, setSendPolicy] = useState(!resubmit);
  const [sourceText, setSourceText] = useState('');
  const [urlText, setUrlText] = useState('');
  const create = useAction(createPolicyRequest);
  const re = useAction(resubmitPolicyRequest);
  const action = resubmit ? re : create;

  const urls = parseUrls(urlText);
  const badUrl = urls.find((u) => !URL_RE.test(u) || u.length > 500);
  const changed = !sameRules(draft, policy);
  const textOk = sourceText.trim().length <= 2000 && (resubmit || sourceText.trim().length > 0);
  const canSubmit = !action.pending && textOk && !badUrl && urls.length <= 10 && (resubmit ? sendPolicy || sourceText.trim() !== '' || urls.length > 0 : changed);
  const conflict = action.errorCode === 'POLICY_VERSION_CONFLICT';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
            <h3 className={page.muted}>지금 정책과 비교</h3>
            <PolicyRulesView rules={draft} compareTo={policy} breeds={breeds} />
          </>
        )}
      </Card>
      <Card title="근거">
        <Field label={resubmit ? '정책 원문 (바꿀 때만)' : '정책 원문'} htmlFor="sv-source" hint={`매장 안내문 · 공지 등 원문을 그대로 적어 주세요. ${sourceText.trim().length}/2000`}>
          <TextArea id="sv-source" rows={4} maxLength={2000} value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
        </Field>
        <Field
          label="근거 주소 (선택)"
          htmlFor="sv-urls"
          hint={`공지 · 사진이 있는 http(s) 주소를 한 줄에 하나씩, 10개까지 적어 주세요 (${urls.length}/10). 서버에 파일 업로드 기능이 아직 없어요.${resubmit ? ' 이미 보낸 주소에 더해져요.' : ''}`}
          message={badUrl ? { tone: 'error', text: `주소 형식을 확인해 주세요: ${badUrl}` } : urls.length > 10 ? { tone: 'error', text: '근거 주소는 10개까지예요' } : null}
        >
          <TextArea id="sv-urls" rows={3} value={urlText} onChange={(e) => setUrlText(e.target.value)} />
        </Field>
      </Card>
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
        <Button type="submit" disabled={!canSubmit}>
          {action.pending ? '보내는 중…' : resubmit ? '보완해서 다시 보내기' : '변경 요청 보내기'}
        </Button>
      </div>
    </form>
  );
}
