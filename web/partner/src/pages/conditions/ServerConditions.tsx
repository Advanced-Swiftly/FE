import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import type { Judgment } from '@/constants/status';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { previewPolicy, createPolicyRequest, getBreedNames, getStorePolicy, resubmitPolicyRequest, type RuleSet, type StorePolicy } from '@/api/policy';
import { uploadFile } from '@/api/files';
import { getRequestDetail } from '@/api/requests';
import { changedPolicyItems, describePolicyItem, draftPolicy, getPendingRequestLinks, policyItemLabel, STATUS_ITEMS, type PendingRequestLink, type PolicyItem, type PolicyItemState } from '@/api/policyItems';
import { getDashboard } from '@/api/stores';
import { Button, ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, TextArea, TextInput } from '@/components/common/Field';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { PolicyRulesEditor } from '@/components/policy/PolicyRules';
import { Tag } from '@/components/common/Tag';
import { RequestDetailModal } from '@/components/requests/RequestDetailModal';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import { todayISO } from '@/utils/date';
import { formatDate } from '@/utils/format';
import editStyles from './ConditionEditPage.module.css';
import styles from './ConditionsPage.module.css';
import type { ConditionRequestDetail } from '@/types';

const URL_RE = /^(https?:\/\/\S+|\/api\/v1\/files\/[0-9a-f-]{36})$/i;
/** 서버 판정값 → 화면 판정 표시 */
const VERDICT: Record<string, Judgment> = { ENTRY_OK: 'ENTRY_OK', PREPARE: 'PREPARE', CHECK_REQUIRED: 'UNKNOWN', ENTRY_DENIED: 'NO_ENTRY' };
const SCOPE_NOTE = '실내·야외 조건과 적용 시작일을 확인해 주세요. 운영자 승인 전까지 기존 조건이 유지돼요.';
/** 표의 보호자 안내 칸 — 서버 응답에 없는 항목은 판정 결과를 짐작하지 않아요 */
const GUIDE: Record<PolicyItemState, string> = { LIMITED: '조건에 맞으면 충족', UNRESTRICTED: '‘가능’으로 안내', UNKNOWN: '서버에 확인된 정보 없음', INFO: '운영자 승인 후 반영' };
const VERSION_CONFLICT_NOTE = '조건 요청은 입장 조건 전체를 기준으로 처리돼요. 진행 중인 요청 중 하나가 먼저 승인되면 입장 조건이 바뀌어, 다른 항목의 요청도 승인할 수 없어 다시 보내야 해요.';

/** 진행 중 요청의 행 동작 — 보완 요청은 보완하기, 나머지는 요청 보기 (같은 행의 요청을 모두 보여 줘요) */
function RequestActions({ link, showId, onOpen }: { link: PendingRequestLink; showId: boolean; onOpen: (id: string) => void }) {
  const label = showId ? ` #${link.request.id}` : '';
  if (link.request.status === 'NEEDS_INFO' && link.kind !== 'STALE') {
    return (
      <ButtonLink to={`/conditions/edit?request=${encodeURIComponent(link.request.id)}`} variant="primary" size="sm">
        보완하기{label}
      </ButtonLink>
    );
  }
  return (
    <Button size="sm" onClick={() => onOpen(link.request.id)}>
      요청 보기{label}
    </Button>
  );
}

/** 서버 모드 UI-W-009 입장 조건 현황 — 목업과 같은 항목별 표, 값은 GET /business/stores/{storeId}/policy */
export function ServerConditionsPage() {
  const { store } = useCurrentStore();
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const policy = useFetch(`policy:${store.id}`, () => getStorePolicy(store.id));
  const breeds = useFetch('breeds', getBreedNames);
  const dashboard = useFetch(`dashboard:${store.id}`, () => getDashboard(store.id));
  const p = policy.data;
  const pending = useFetch(`pending-links:${store.id}:${p?.version ?? 'none'}`, () => (p ? getPendingRequestLinks(store.id, p) : Promise.resolve([])));
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const links = pending.data ?? [];
  const reload = () => {
    policy.reload();
    pending.reload();
  };
  const checkedAt = dashboard.data?.conditionCheckedAt;

  return (
    <div className={page.stack}>
      <PageHeader
        title="입장 조건 현황"
        description={
          <>
            보호자에게 지금 보이는 조건이에요. 항목의 <strong>수정 요청</strong>을 누르면 바꿀 내용을 적어 보낼 수 있고, 운영자가 승인하면 반영돼요.
          </>
        }
      />
      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })} action={<Link to="/requests">요청 처리 현황</Link>}>
          {flash}
        </Notice>
      )}
      <LoadState status={policy.status} errorText={policy.error?.message} onRetry={policy.reload} />
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
      {links.length > 0 && (
        <Notice tone="info" action={<Link to="/requests">요청 처리 현황</Link>}>
          {VERSION_CONFLICT_NOTE}
        </Notice>
      )}
      {p && (
        <>
          <div className={page.pills}>
            <span className={page.pill}>
              <span>조건 확인일</span>
              <strong>{checkedAt ? formatDate(checkedAt) : '미확인'}</strong>
            </span>
            <span className={page.pill}>
              <span>적용 시작일</span>
              <strong>{p.conditions?.effectiveFrom ? formatDate(p.conditions.effectiveFrom) : '미확인'}</strong>
            </span>
          </div>

          <Card title="항목별 조건" padding="none">
            <div className={table.scroll}>
              <table className={`${table.table} ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 150 }}>
                      항목
                    </th>
                    <th scope="col">현재 조건</th>
                    <th scope="col" style={{ width: 210 }}>
                      보호자 안내
                    </th>
                    <th scope="col" style={{ width: 150 }}>
                      <span className="sr-only">작업</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_ITEMS.map(({ key, label }) => {
                    const row = describePolicyItem(p, key, breeds.data ?? new Map());
                    const rowLinks = links.filter((l) => l.items.includes(key));
                    return (
                      <tr key={key} className={rowLinks.length ? styles.pendingRow : row.state === 'UNKNOWN' ? styles.unknownRow : undefined}>
                        <th scope="row">{label}</th>
                        <td>
                          <div className={styles.valueCell}>
                            {row.state === 'UNKNOWN' ? (
                              <JudgmentChip judgment="UNKNOWN" label="미확인" />
                            ) : (
                              <span className={styles.value}>
                                {row.text}
                                {row.state === 'UNRESTRICTED' && <Tag tone="green">가능</Tag>}
                              </span>
                            )}
                            {rowLinks.map((l) => (
                              <Tag key={l.request.id} tone={l.request.status === 'NEEDS_INFO' ? 'yellow' : 'blue'} shape="pill">
                                변경 요청 {REQUEST_STATUS_LABEL[l.request.status]}
                                {rowLinks.length > 1 ? ` #${l.request.id}` : ''}
                              </Tag>
                            ))}
                          </div>
                        </td>
                        <td className={table.muted}>{rowLinks.length ? '승인 전까지 지금 조건 유지' : GUIDE[row.state]}</td>
                        <td className={table.right}>
                          {rowLinks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              {rowLinks.map((l) => (
                                <RequestActions key={l.request.id} link={l} showId={rowLinks.length > 1} onOpen={setOpenRequestId} />
                              ))}
                            </div>
                          ) : (
                            <ButtonLink
                              to={`/conditions/edit?item=${key}`}
                              variant={row.state === 'UNKNOWN' ? 'ghost' : 'secondary'}
                              size="sm"
                              className={row.state === 'UNKNOWN' ? styles.addButton : undefined}
                            >
                              {row.state === 'UNKNOWN' ? '추가 요청' : '수정 요청'}
                              {row.state !== 'UNKNOWN' && <Icon name="chevronRight" size={16} />}
                            </ButtonLink>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className={page.muted}>‘가능’은 그 조건 하나가 맞는다는 뜻이에요. 최종 판정은 모든 조건을 함께 보고 정해요.</p>
        </>
      )}
      <RequestDetailModal requestId={openRequestId} onClose={() => setOpenRequestId(null)} onChanged={reload} />
    </div>
  );
}

/** 수정 요청 화면의 단계 제목 — ① 바꿀 조건 · ② 요청 정보 · ③ 근거 자료 */
function StepHead({ id, n, title, description, aside }: { id: string; n: number; title: string; description: string; aside?: string }) {
  return (
    <header className={editStyles.stepHead}>
      <span className={editStyles.stepNo} aria-hidden="true">
        {n}
      </span>
      <div className={editStyles.stepText}>
        <h2 id={id} className={editStyles.stepTitle}>
          {title}
          {aside && <span className={editStyles.stepAside}>{aside}</span>}
        </h2>
        <p className={editStyles.stepDesc}>{description}</p>
      </div>
    </header>
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
  const pending = useFetch(`pending-links:${store.id}:${policy.data?.version ?? 'none'}:${round}`, () => (policy.data ? getPendingRequestLinks(store.id, policy.data) : Promise.resolve([])));
  const ready = policy.status === 'success' && pending.status !== 'loading' && (!requestId || request.status === 'success');
  const failed = policy.status === 'error' ? policy : requestId && request.status === 'error' ? request : null;
  const r = request.data ?? null;
  // 보완 제출은 기준 버전을 바꾸지 않아요. 정책이 바뀐 뒤에는 다시 제출해도 승인할 수 없어서 미리 막아요
  const blocked = r && (!r.canResubmit || r.status !== 'NEEDS_INFO')
    ? `이 요청은 지금 보완할 수 없어요 (${REQUEST_STATUS_LABEL[r.status] ?? r.status}). 요청 처리 현황에서 상태를 확인해 주세요.`
    : r && policy.data && r.baseVersion !== policy.data.version
      ? '요청 뒤 정책이 바뀌어 이 요청은 보완해도 승인할 수 없어요. 요청을 취소한 뒤 최신 조건으로 다시 보내 주세요.'
      : null;
  return (
    <div className={page.stack}>
      <PageHeader
        breadcrumb={[{ label: requestId ? '요청 처리 현황' : '입장 조건 현황', to: requestId ? '/requests' : '/conditions' }, { label: requestId ? '보완하기' : '수정 요청' }]}
        title={requestId ? '보완해서 다시 보내기' : '입장 조건 수정 요청'}
        description={SCOPE_NOTE}
      />
      {failed && <LoadState status="error" errorText={failed.error?.message} onRetry={failed.reload} />}
      {!ready && !failed && <LoadState status="loading" />}
      {ready && blocked && <Notice tone="warning">{blocked}</Notice>}
      {ready && !blocked && policy.data && (
        <EditForm key={`${policy.data.version}:${round}`} policy={policy.data} breeds={breeds.data ?? new Map()} request={r} pendingLinks={pending.data ?? null} onReload={() => setRound((x) => x + 1)} />
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

/** 현황 표의 [수정 요청]에서 들어왔을 때 이동할 입력 위치 */
const ITEM_TARGET: Partial<Record<PolicyItem, string[]>> = {
  pets: ['policy-item-pets'],
  weight: ['area-indoor-weight', 'policy-item-weight'],
  breed: ['rule-breedRules'],
  area: ['policy-item-area'],
  equipment: ['policy-item-equipment'],
  vaccine: ['rule-vaccineRules'],
  effectiveFrom: ['policy-effective-from'],
  notice: ['policy-notice'],
};

function EditForm({ policy, breeds, request, pendingLinks, onReload }: { policy: StorePolicy; breeds: Map<string, string>; request: ConditionRequestDetail | null; pendingLinks: PendingRequestLink[] | null; onReload: () => void }) {
  const navigate = useNavigate();
  const { store } = useCurrentStore();
  const resubmit = request !== null;
  // 지금 정책 전체에서 시작해요 — 고치지 않은 조건도 그대로 함께 보내져서 지워지지 않아요
  // 변경 사유는 요청마다 새로 적는 값이라, 새 요청은 지난 사유를 지우고 빈 칸으로 시작해요 (보완은 그 요청의 사유를 이어받아요)
  const startConditions = request?.requestedPolicy?.conditions ?? (policy.conditions ? { ...policy.conditions, changeReason: '' } : policy.conditions);
  const [draft, setDraft] = useState<RuleSet>({ conditions: startConditions, breedRules: [...(request?.requestedPolicy?.breedRules ?? policy.breedRules)], equipmentRules: [...(request?.requestedPolicy?.equipmentRules ?? policy.equipmentRules)], vaccineRules: [...(request?.requestedPolicy?.vaccineRules ?? policy.vaccineRules)] });
  // 요청 설명 — 공지 문장 · 변경 사유는 빈 칸으로 시작해요. 보완은 그 요청에서 새로 적었던 값만 다시 채워요
  const requestedNotice = request?.requestedPolicy?.conditions?.notice?.trim() ?? '';
  const [noticeInput, setNoticeInput] = useState(requestedNotice && requestedNotice !== (policy.conditions?.notice?.trim() ?? '') ? requestedNotice : '');
  const [reasonInput, setReasonInput] = useState(request?.requestedPolicy?.conditions?.changeReason?.trim() ?? '');
  // 적용 시작일도 빈 칸으로 시작해요. 보완은 그 요청에서 새로 고른 날짜만 다시 채워요
  const requestedFrom = request?.requestedPolicy?.conditions?.effectiveFrom ?? '';
  const [fromInput, setFromInput] = useState(requestedFrom && requestedFrom !== (policy.conditions?.effectiveFrom ?? '') ? requestedFrom : '');
  // 보낼 정책 — 공지 · 적용 시작일을 비워 두면 지금 값을 그대로 보내요 (체중만 바꾸려다 다른 값이 지워지지 않게)
  const requested: RuleSet = draft.conditions
    ? { ...draft, conditions: { ...draft.conditions, effectiveFrom: fromInput || draft.conditions.effectiveFrom, notice: noticeInput.trim() || draft.conditions.notice, changeReason: reasonInput.trim() || null } }
    : draft;
  // 보완 제출: BE 상세에 이전 요청 정책이 없어서, 정책을 다시 보낼지는 직접 고르게 해요 (보내지 않으면 이전 요청 정책 그대로)
  const [sendPolicy, setSendPolicy] = useState(!resubmit);
  const [sourceText, setSourceText] = useState(request?.sourceText ?? '');
  const [urlText, setUrlText] = useState('');
  const [uploaded, setUploaded] = useState<{name:string;url:string}[]>([]);
  const [uploading,setUploading] = useState(false);
  const [uploadError,setUploadError] = useState<string|null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
    if (!focusItem) return;
    const el = (ITEM_TARGET[focusItem as PolicyItem] ?? []).map((id) => document.getElementById(id)).find(Boolean);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el?.matches('input, select, textarea') ? el : el?.querySelector<HTMLElement>('input, select, textarea'))?.focus({ preventScroll: true });
  }, [focusItem]);
  const create = useAction(createPolicyRequest);
  const re = useAction(resubmitPolicyRequest);
  const action = resubmit ? re : create;

  const urls = [...parseUrls(urlText), ...uploaded.map(f=>f.url)];
  const badUrl = urls.find((u) => !URL_RE.test(u) || u.length > 500);
  // 항목별로 들어와도 지금 정책 전체를 고쳐서 보내요. 고치지 않은 조건은 그대로 함께 전송돼요
  // 변경 사유만 적은 것은 조건 변경이 아니에요
  const changed = changedPolicyItems(policy, requested).length > 0;
  const otherLinks = (pendingLinks ?? []).filter((l) => l.request.id !== request?.id);
  const overlap = !resubmit || sendPolicy ? changedPolicyItems(policy, requested).filter((item) => otherLinks.some((l) => l.items.includes(item))) : [];
  // 정책 원문은 승인되면 입장 조건의 근거로 저장되는 값이라, 공지 · 변경 사유로 대신 채우지 않고 직접 적게 해요
  const sourceMissing = !resubmit && sourceText.trim().length === 0;
  const blockers = [
    !resubmit && !changed ? '바꿀 입장 조건을 하나 이상 고쳐 주세요.' : null,
    resubmit && !sendPolicy && sourceText.trim() === '' && urls.length === 0 ? '보완할 정책, 정책 원문, 근거 중 하나 이상을 입력해 주세요.' : null,
    sourceMissing ? '정책 원문을 적어 주세요.' : null,
    badUrl ? '근거 주소 형식을 확인해 주세요.' : null,
    urls.length > 10 ? '근거 자료는 10개까지 첨부할 수 있어요.' : null,
    overlap.length ? `${overlap.map(policyItemLabel).join(', ')} 항목은 이미 진행 중인 요청이 있어요. 결과가 나온 뒤 다시 보내 주세요.` : null,
  ].filter((x): x is string => x !== null);
  const canSubmit = !uploading && !action.pending && blockers.length === 0;
  const conflict = action.errorCode === 'POLICY_VERSION_CONFLICT';
  const editing = !resubmit || sendPolicy;
  const changedItems = editing ? changedPolicyItems(policy, requested) : [];
  const reasonChanged = editing && reasonInput.trim() !== '';
  const after = draftPolicy(policy, requested);

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length + urls.length > 10) {
      setUploadError('근거 자료는 10개까지 첨부할 수 있어요.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const next = await Promise.all(files.map(async (file) => ({ name: file.name, url: await uploadFile(file) })));
      setUploaded((old) => [...old, ...next]);
    } catch {
      setUploadError('파일을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!canSubmit) return;
    const res = resubmit ? await re.run(request.id, sendPolicy ? requested : null, sourceText, urls) : await create.run(store.id, policy.version, requested, sourceText, urls);
    if (res.ok) navigate('/conditions', { state: { flash: resubmit ? '보완 내용을 보냈어요. 운영자가 다시 확인해요.' : '변경 요청을 보냈어요. 운영자가 승인하면 반영돼요.' } });
  };

  return (
    <form className={page.stack} onSubmit={onSubmit} noValidate>
      {otherLinks.length > 0 && <Notice tone="warning">진행 중인 요청이 {otherLinks.length}건 있어요. {VERSION_CONFLICT_NOTE}</Notice>}
      {pendingLinks === null && <Notice tone="warning">진행 중인 요청을 확인하지 못했어요. 같은 항목의 요청이 이미 있을 수 있어요.</Notice>}
      {resubmit && request.reason && (
        <Notice tone="warning">
          <strong>보완 요청 사유</strong> · {request.reason}
        </Notice>
      )}
      <div className={page.split}>
        <div className={page.main}>
          <section className={editStyles.step} aria-labelledby="step-conditions">
            <StepHead id="step-conditions" n={1} title="바꿀 조건" description="보호자에게 적용될 입장 조건을 고쳐 주세요." />
            {resubmit && (
              <Card>
                <Choice type="checkbox" label="요청 정책을 고쳐서 다시 보내기 (지금 정책 기준으로 전체를 다시 보내요)" checked={sendPolicy} onChange={(e) => setSendPolicy(e.target.checked)} />
              </Card>
            )}
            {editing && <PolicyRulesEditor base={policy} value={draft} onChange={setDraft} breeds={breeds} />}
          </section>
          <div className={editStyles.requestArea}>
            {editing && (
              <section className={editStyles.step} aria-labelledby="step-request">
                <StepHead id="step-request" n={2} title="요청 정보" description="언제부터, 어떤 안내로 적용할지 적어 주세요." />
                <Card>
                  <Field label="적용 시작일 (선택)" htmlFor="policy-effective-from" hint="비워 두면 운영자가 승인한 날부터 적용돼요.">
                    <TextInput id="policy-effective-from" className={editStyles.narrow} type="date" min={todayISO()} value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
                  </Field>
                  <Field label="공지 문장 (선택)" htmlFor="policy-notice" hint={`승인되면 매장 공지로 저장돼요. 비워 두면 지금 공지를 그대로 유지해요. ${noticeInput.length}/500`}>
                    <TextArea id="policy-notice" rows={2} maxLength={500} placeholder="예: 실내 10kg 이하, 초과 시 야외 테라스 이용" value={noticeInput} onChange={(e) => setNoticeInput(e.target.value)} />
                  </Field>
                  <Field label="변경 사유 (선택)" htmlFor="policy-change-reason" hint={`운영자가 요청을 검토할 때 참고해요. ${reasonInput.length}/500`}>
                    <TextInput id="policy-change-reason" maxLength={500} placeholder="예: 매장 운영 기준 변경" value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} />
                  </Field>
                </Card>
              </section>
            )}
            <section className={editStyles.step} aria-labelledby="step-evidence">
              <StepHead id="step-evidence" n={editing ? 3 : 2} title="근거 자료" description="운영자가 확인할 근거를 올려 주세요." aside={resubmit ? undefined : '필수 1개 · 정책 원문'} />
              <Card>
                <div className={editStyles.evidence}>
                  <span className={editStyles.label}>근거 파일 (선택)</span>
                  {uploaded.map((file) => (
                    <div key={file.url} className={editStyles.file}>
                      <Icon name="image" size={16} />
                      <span>{file.name}</span>
                      <button type="button" aria-label={`${file.name} 삭제`} onClick={() => setUploaded((list) => list.filter((x) => x.url !== file.url))}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
                  <input ref={fileInput} type="file" className="sr-only" aria-label="근거 파일 추가" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={uploading} onChange={onPickFiles} />
                  <div className={editStyles.evidenceActions}>
                    <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                      <Icon name="plus" size={16} />
                      {uploading ? '올리는 중…' : '파일 추가'}
                    </Button>
                  </div>
                  <span className={page.muted}>사진 · PDF 파일을 첨부할 수 있어요.</span>
                  {uploadError && <Notice tone="danger">{uploadError}</Notice>}
                </div>
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
                  hint={`공지 · 사진이 있는 http(s) 주소를 한 줄에 하나씩, 10개까지 적어 주세요 (${urls.length}/10).${resubmit ? ' 이미 보낸 주소에 더해져요.' : ''}`}
                  message={badUrl ? { tone: 'error', text: `주소 형식을 확인해 주세요: ${badUrl}` } : urls.length > 10 ? { tone: 'error', text: '근거 주소는 10개까지예요' } : null}
                >
                  <TextArea id="sv-urls" rows={3} value={urlText} onChange={(e) => setUrlText(e.target.value)} />
                </Field>
              </Card>
            </section>
          </div>
        </div>

        <aside className={`${page.side} ${editStyles.summary}`} aria-labelledby="sv-summary-title">
          <h2 id="sv-summary-title" className={editStyles.summaryTitle}>
            변경 요약 · {changedItems.length + (reasonChanged ? 1 : 0)}개 항목
          </h2>
          {!editing ? (
            <p className={page.muted}>이전에 요청한 정책을 그대로 보내요.</p>
          ) : changedItems.length === 0 && !reasonChanged ? (
            <p className={page.muted}>바꿀 항목을 고르면 여기에 정리돼요.</p>
          ) : (
            <ul className={editStyles.summaryList}>
              {changedItems.map((item) => (
                <li key={item}>
                  <strong>{policyItemLabel(item)}</strong>
                  <span>
                    {describePolicyItem(policy, item, breeds).text} → {describePolicyItem(after, item, breeds).text}
                  </span>
                </li>
              ))}
              {reasonChanged && (
                <li>
                  <strong>변경 사유</strong>
                  <span>{reasonInput.trim()}</span>
                </li>
              )}
            </ul>
          )}

          <div className={editStyles.preview}>
            <span className={editStyles.previewLabel}>승인되면 · 입장 예시</span>
            {preview.status === 'loading' && <span className={page.muted}>입장 판정을 계산하고 있어요…</span>}
            {preview.status === 'error' && (
              <span role="alert" className={page.muted}>
                입장 예시를 불러오지 못했어요.{' '}
                <button type="button" className={page.retry} onClick={preview.reload}>
                  다시 계산
                </button>
              </span>
            )}
            {preview.data && (
              <>
                <strong>{preview.data.example}</strong>
                <div className={editStyles.previewRow}>
                  <JudgmentChip judgment={VERDICT[preview.data.before] ?? 'UNKNOWN'} />
                  <Icon name="arrowRight" size={16} />
                  <JudgmentChip judgment={VERDICT[preview.data.after] ?? 'UNKNOWN'} />
                </div>
                <span className={page.muted}>{preview.data.before === preview.data.after ? '이 변경으로 예시 반려견의 판정은 달라지지 않아요.' : '운영자 승인 후 적용 시작일부터 반영돼요.'}</span>
              </>
            )}
          </div>

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
          <div className={editStyles.buttons}>
            <ButtonLink to={resubmit ? '/requests' : '/conditions'} variant="secondary" className={editStyles.cancel}>
              취소
            </ButtonLink>
            <Button type="submit" className={editStyles.submit} disabled={uploading || action.pending}>
              {action.pending ? '보내는 중…' : resubmit ? '보완해서 다시 보내기' : '수정 요청 보내기'}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
