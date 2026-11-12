import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildChanges, getConditions, previewVerdicts, requestConditionChange, resubmitConditionRequest } from '@/api/conditions';
import { toApiError } from '@/api/errors';
import { getRequestDetail } from '@/api/requests';
import { Button, ButtonLink } from '@/components/common/Button';
import { Choice, InputRow, Select, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import { RequestDetailModal } from '@/components/requests/RequestDetailModal';
import page from '@/styles/page.module.css';
import type {
  AreaRule,
  ConditionField,
  ConditionRequestDetail,
  ConditionState,
  Item,
  PendingItem,
  PlaceConditions,
  SizeLimit,
  StoreConditions,
  UnrestrictableField,
  VerdictPreview,
} from '@/types';
import {
  AREA_LABEL,
  CONDITION_FIELDS,
  CONDITION_LABEL,
  ITEM_LABEL,
  SIZE_LABEL,
  changedFields,
  describeField,
  fieldState,
  isUnrestrictable,
} from '@/utils/conditions';
import { formatFileSize } from '@/utils/format';
import styles from './ConditionEditPage.module.css';

/** UI-W-011 입장 조건 수정 요청 (F-WREQ-03) · ?request= 이면 보완 다시 보내기 (F-WREQ-06) */
export function ConditionEditPage() {
  const { store } = useCurrentStore();
  const [params] = useSearchParams();
  const requestId = params.get('request');
  // 409(CONDITIONS_OUTDATED) 뒤 [최신 조건 불러오기]를 누르면 회차를 올려 둘 다 다시 읽고 새로 시작해요.
  const [round, setRound] = useState(0);
  const conditions = useFetch(`conditions:${store.id}:${round}`, () => getConditions(store.id));
  const request = useFetch(`request:${requestId ?? 'none'}:${round}`, () => (requestId ? getRequestDetail(requestId) : Promise.resolve(null)));

  // 화면이 바뀐 직후 한 번은 이전 key 의 응답이 남아 있을 수 있어요. 지금 화면과 맞는 데이터만 써요.
  // - 조건: 지금 고른 매장(placeId)의 조건만
  // - 요청: URL 에 request 가 있을 때만, 그리고 조회한 요청 ID 가 URL 의 requestId 와 같을 때만.
  //   request 파라미터가 없으면(신규 요청) 이전 요청의 값 · 근거 · 보완 사유를 쓰지 않아요.
  const cond = conditions.status === 'success' && conditions.data.storeId === store.id ? conditions.data : null;
  const r = requestId && request.status === 'success' && request.data?.id === requestId ? request.data : null;
  const condStatus = conditions.status === 'success' && !cond ? 'loading' : conditions.status;
  const reqStatus = !requestId ? 'success' : request.status === 'success' && !r ? 'loading' : request.status;
  const ready = cond !== null && (!requestId || r !== null);
  // 보완 제출 전 확인 (F-WREQ-06): 지금 고른 매장의 요청인지, 보완할 수 있는 상태인지, 최신 조건 버전이 같은지
  const blockReason = !ready || !r
    ? null
    : r.storeId !== store.id
      ? '지금 고른 매장의 요청이 아니에요. 사이드바에서 요청을 보낸 매장을 고른 뒤 다시 열어 주세요.'
      : !r.canResubmit || r.status !== 'NEEDS_INFO'
        ? '이 요청은 지금 보완할 수 없어요. 요청 처리 현황에서 상태를 확인해 주세요.'
        : // 버전 정보가 없으면 '바뀜'으로 단정하지 않고 비교할 수 없다고 알려요 (보완 기준 버전도 없어 보낼 수 없어요)
          !cond || r.latestConditionsVersion === null
          ? '현재 조건과 요청 당시 조건을 비교할 수 없어요.'
          : cond.conditionsVersion !== r.latestConditionsVersion
          ? '조건 정보가 방금 바뀌었어요. 최신 조건을 다시 불러온 뒤 보완해 주세요.'
          : null;

  return (
    <div className={page.stack}>
      <PageHeader
        breadcrumb={[{ label: requestId ? '요청 처리 현황' : '입장 조건 현황', to: requestId ? '/requests' : '/conditions' }, { label: requestId ? '보완하기' : '수정 요청' }]}
        title={requestId ? '보완해서 다시 보내기' : '입장 조건 수정 요청'}
        description={
          requestId
            ? '운영자가 남긴 사유를 보고 요청을 고쳐 주세요. 같은 요청으로 다시 접수돼요.'
            : '바뀐 항목만 고치면 돼요. 운영자가 근거를 확인한 뒤 승인하면 바로 반영되고, 그 전까지는 지금 조건이 그대로 보여요.'
        }
      />
      <LoadState
        status={condStatus === 'success' ? reqStatus : condStatus}
        errorText={(conditions.error ?? request.error)?.message}
        onRetry={() => setRound((n) => n + 1)}
      />
      {ready && blockReason && (
        <Notice
          tone="warning"
          role="alert"
          action={
            <Button variant="secondary" size="sm" onClick={() => setRound((n) => n + 1)}>
              다시 불러오기
            </Button>
          }
        >
          {blockReason}
        </Notice>
      )}
      {ready && cond && !blockReason && (
        <EditForm key={`${store.id}:${requestId ?? 'new'}:${round}`} original={cond} request={r} onRestart={() => setRound((n) => n + 1)} />
      )}
    </div>
  );
}

/** 보완 화면은 최신 확정 조건 위에 지난번 요청값을 올려서 시작해요 */
function initialDraft(original: StoreConditions, request: ConditionRequestDetail | null): ConditionState {
  const draft: ConditionState = { conditions: { ...original.conditions }, unrestrictedFields: [...original.unrestrictedFields] };
  request?.changes.forEach((ch) => {
    setField(draft, ch.field, ch.requestedValue, ch.requestedUnrestricted);
  });
  return draft;
}

function setField(state: ConditionState, field: ConditionField, value: PlaceConditions[ConditionField], unrestricted: boolean) {
  (state.conditions as Record<ConditionField, unknown>)[field] = unrestricted ? null : value;
  if (isUnrestrictable(field)) {
    state.unrestrictedFields = unrestricted ? Array.from(new Set([...state.unrestrictedFields, field])) : state.unrestrictedFields.filter((f) => f !== field);
  }
}

/** 업체는 '미확인'(null)으로 보낼 수 없어요 — 제한 있음인데 값이 비어 있으면 오류 */
function invalidValue(state: ConditionState, field: ConditionField) {
  if (fieldState(state, field) !== 'UNKNOWN') {
    const v = state.conditions[field];
    if (fieldState(state, field) === 'LIMITED' && Array.isArray(v) && v.length === 0) return true;
    if (field === 'weightLimitKg' && fieldState(state, field) === 'LIMITED' && (!v || (v as number) <= 0)) return true;
    return false;
  }
  return true;
}

function EditForm({ original, request, onRestart }: { original: StoreConditions; request: ConditionRequestDetail | null; onRestart: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /** [요청 내용 보기]로 연 진행 중 요청 — 입장 조건 현황과 같은 상세 팝업(F-WREQ-04)을 그 요청 ID 로 바로 열어요 */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConditionState>(() => initialDraft(original, request));
  const [breedInput, setBreedInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [preview, setPreview] = useState<VerdictPreview[] | null>(null);
  const [previewState, setPreviewState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });
  const [previewTick, setPreviewTick] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const send = useAction(request ? (req: Parameters<typeof requestConditionChange>[0], f: File[]) => resubmitConditionRequest(request.id, req, f) : requestConditionChange);

  // 현황 화면에서 누른 항목으로 이동
  useEffect(() => {
    const item = params.get('item');
    if (!item) return;
    const el = document.getElementById(`cond-${item}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
  }, [params]);

  const changed = changedFields(original, draft);
  // 이 요청 자신이 걸어 둔 항목은 막지 않아요 (보완)
  const blocked = changed.filter((f) => original.pendingItems.some((p) => p.field === f && p.requestId !== request?.id));
  const invalid = changed.filter((f) => invalidValue(draft, f));
  const evidenceCount = files.length + links.length + (request?.evidences.length ?? 0);
  const canSubmit = changed.length > 0 && evidenceCount > 0 && blocked.length === 0 && invalid.length === 0 && !send.pending;
  // 지금 보낼 수 없는 이유 — canSubmit 과 같은 값만 다시 써요. 보낼 수 있거나 보내는 중이면 숨겨요.
  const names = (fields: ConditionField[]) => fields.map((f) => CONDITION_LABEL[f]).join(', ');
  const submitBlockers: string[] =
    canSubmit || send.pending
      ? []
      : changed.length === 0
        ? ['변경할 조건을 하나 이상 수정해 주세요.']
        : [
            ...(invalid.length > 0 ? [`${names(invalid)}의 입력값을 확인해 주세요.`] : []),
            ...(blocked.length > 0 ? [`${withTopic(names(blocked))} 이미 요청한 항목이에요. 이번 변경에서 제외해 주세요.`] : []),
            ...(evidenceCount === 0 ? ['근거 링크나 파일을 1개 이상 추가해 주세요.'] : []),
          ];

  // 판정 미리보기 (F-WREQ-07) — 입력이 멈추고 0.4초 뒤에 다시 계산 (입력할 때마다 서버를 부르지 않게)
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    let cancelled = false;
    setPreviewState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      previewVerdicts(original, draft, original.storeId)
        .then((r) => {
          if (cancelled) return;
          setPreview(r);
          setPreviewState({ loading: false, error: null });
        })
        .catch((e: unknown) => !cancelled && setPreviewState({ loading: false, error: toApiError(e).message }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, previewTick]);

  const update = (field: ConditionField, value: PlaceConditions[ConditionField], unrestricted = false) =>
    setDraft((d) => {
      const next: ConditionState = { conditions: { ...d.conditions }, unrestrictedFields: [...d.unrestrictedFields] };
      setField(next, field, value, unrestricted);
      return next;
    });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    // 보낼 내용: 지금 확정 조건(F-WREQ-02)과 다른 항목 전체 — 새 요청은 바꾼 항목, 보완은 요청 내용 전체가 돼요.
    const { changes, unrestrictedFields } = buildChanges(original, draft);
    // 기준 버전: 새 요청은 F-WREQ-02 conditionsVersion, 보완은 F-WREQ-04 latestConditionsVersion (이전 요청의 baseVersion 은 쓰지 않아요)
    const baseVersion = request ? request.latestConditionsVersion : original.conditionsVersion;
    // 보완인데 최신 버전을 모르면 보내지 않아요 (화면에서 미리 막혀요)
    if (baseVersion === null) return;
    const res = await send.run(
      { storeId: original.storeId, baseVersion, changes, unrestrictedFields, evidenceLinks: links, evidenceFiles: files.map((f) => ({ name: f.name, size: f.size })) },
      files,
    );
    if (!res.ok) return;
    navigate(request ? '/requests' : '/conditions', {
      state: { flash: request ? `보완 내용을 다시 보냈어요(${res.data.id}). 운영자가 다시 확인해요.` : `수정 요청(${res.data.id})을 보냈어요. 결과는 요청 처리 현황에서 확인할 수 있어요.` },
    });
  };

  const section = (field: ConditionField, children: ReactNode) => {
    const isChanged = changed.includes(field);
    const pending = original.pendingItems.find((p) => p.field === field && p.requestId !== request?.id);
    return (
      <div id={`cond-${field}`} key={field} className={`${styles.group} ${isChanged ? styles.changed : ''}`}>
        {/* 진행 중인 요청이 있으면 입력만 잠가요. 안내와 버튼은 잠긴 fieldset 밖에 둬서 마우스 · 키보드로 누를 수 있어요. */}
        <fieldset className={styles.groupFields} disabled={Boolean(pending)}>
        <legend className={styles.legend}>
          <span className={styles.legendTitle}>
            {CONDITION_LABEL[field]}
            {isChanged && (
              <Tag tone="primary" shape="pill">
                변경됨
              </Tag>
            )}
          </span>
          <span className={styles.current}>지금: {describeField(original, field)}</span>
        </legend>
        {children}
        {isChanged && (
          <div className={styles.diff}>
            <del>{describeField(original, field)}</del>
            <Icon name="arrowRight" size={16} />
            <ins>{invalid.includes(field) ? '값을 입력해 주세요' : describeField(draft, field)}</ins>
          </div>
        )}
        </fieldset>
        {pending && <PendingNote item={pending} onOpenDetail={setDetailId} />}
      </div>
    );
  };

  /** 제한 있음 / 제한 없음 고르기 + 제한 있음일 때 값 입력 */
  const limitChoice = (field: UnrestrictableField, limitedLabel: string, defaultValue: PlaceConditions[UnrestrictableField], editor: ReactNode) => {
    const st = fieldState(draft, field);
    return (
      <>
        <div className={styles.choices}>
          <Choice
            type="radio"
            name={`mode-${field}`}
            boxed
            label={limitedLabel}
            checked={st === 'LIMITED'}
            onChange={() => update(field, original.conditions[field] ?? defaultValue)}
          />
          <Choice type="radio" name={`mode-${field}`} boxed label="제한 없음" checked={st === 'UNRESTRICTED'} onChange={() => update(field, null, true)} />
        </div>
        {st === 'LIMITED' && editor}
        {st === 'UNKNOWN' && <p className={page.muted}>지금은 미확인이에요. 고르지 않으면 그대로 미확인으로 남아요.</p>}
      </>
    );
  };

  const c = draft.conditions;
  const addBreed = () => {
    const b = breedInput.trim();
    if (b && !(c.restrictedBreeds ?? []).includes(b)) update('restrictedBreeds', [...(c.restrictedBreeds ?? []), b]);
    setBreedInput('');
  };

  const editors: Record<ConditionField, ReactNode> = {
    petAllowed: (
      <div className={styles.choices}>
        <Choice type="radio" name="petAllowed" boxed label="동반 가능" checked={c.petAllowed === true} onChange={() => update('petAllowed', true)} />
        <Choice type="radio" name="petAllowed" boxed label="동반 불가" checked={c.petAllowed === false} onChange={() => update('petAllowed', false)} />
      </div>
    ),
    weightLimitKg: limitChoice(
      'weightLimitKg',
      '체중 제한 있음',
      10,
      <div className={styles.inline}>
        <label htmlFor="c-weight" className="sr-only">
          이용 가능 체중
        </label>
        <TextInput
          id="c-weight"
          type="number"
          min={1}
          max={80}
          className={styles.number}
          value={c.weightLimitKg ?? ''}
          onChange={(e) => update('weightLimitKg', e.target.value === '' ? 0 : Number(e.target.value))}
        />
        <span>kg 이하</span>
      </div>,
    ),
    sizeLimit: limitChoice(
      'sizeLimit',
      '크기 제한 있음',
      'MEDIUM',
      <>
        <label htmlFor="c-size" className="sr-only">
          크기 제한
        </label>
        <Select id="c-size" className={styles.narrow} value={c.sizeLimit ?? 'MEDIUM'} onChange={(e) => update('sizeLimit', e.target.value as SizeLimit)}>
          {(Object.keys(SIZE_LABEL) as SizeLimit[]).map((s) => (
            <option key={s} value={s}>
              {SIZE_LABEL[s]}
            </option>
          ))}
        </Select>
      </>,
    ),
    restrictedBreeds: limitChoice(
      'restrictedBreeds',
      '출입 제한 견종 있음',
      [],
      <>
        <InputRow>
          <label htmlFor="c-breed" className="sr-only">
            제한 견종 추가
          </label>
          <TextInput
            id="c-breed"
            placeholder="제한할 견종을 입력하세요"
            value={breedInput}
            onChange={(e) => setBreedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addBreed();
              }
            }}
          />
          <Button variant="secondary" onClick={addBreed} disabled={!breedInput.trim()}>
            추가
          </Button>
        </InputRow>
        {(c.restrictedBreeds ?? []).length > 0 && (
          <ul className={styles.chips}>
            {(c.restrictedBreeds ?? []).map((b) => (
              <li key={b}>
                {b}
                <button type="button" aria-label={`${b} 삭제`} onClick={() => update('restrictedBreeds', (c.restrictedBreeds ?? []).filter((x) => x !== b))}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>,
    ),
    area: limitChoice(
      'area',
      '구역 정하기',
      'INDOOR_OK',
      <div className={styles.choices}>
        {(Object.keys(AREA_LABEL) as AreaRule[]).map((a) => (
          <Choice key={a} type="radio" name="area-value" boxed label={AREA_LABEL[a]} checked={c.area === a} onChange={() => update('area', a)} />
        ))}
      </div>,
    ),
    requiredItems: limitChoice(
      'requiredItems',
      '필수 준비물 있음',
      [],
      <div className={styles.choices}>
        {(Object.keys(ITEM_LABEL) as Item[]).map((i) => {
          const list = c.requiredItems ?? [];
          return (
            <Choice
              key={i}
              type="checkbox"
              boxed
              label={ITEM_LABEL[i]}
              checked={list.includes(i)}
              onChange={() => update('requiredItems', list.includes(i) ? list.filter((x) => x !== i) : [...list, i])}
            />
          );
        })}
      </div>,
    ),
    vaccinationRequired: (
      <div className={styles.choices}>
        <Choice type="radio" name="vaccine" boxed label="종합백신 접종 증빙 필요" checked={c.vaccinationRequired === true} onChange={() => update('vaccinationRequired', true)} />
        <Choice type="radio" name="vaccine" boxed label="접종 확인하지 않음" checked={c.vaccinationRequired === false} onChange={() => update('vaccinationRequired', false)} />
      </div>
    ),
  };

  return (
    <form className={page.split} onSubmit={onSubmit} noValidate>
      <div className={page.main} aria-label="항목별 조건">
        {request?.reason && (
          <Notice tone="warning">
            <strong>보완 · 반려 사유</strong>
            <br />
            {request.reason}
          </Notice>
        )}
        {request?.baseChanged && <Notice tone="info">요청한 뒤 확정 조건이 바뀌었어요. 각 항목의 ‘지금’ 값이 최신 확정 조건이에요. 최신 조건을 확인한 뒤 보내 주세요.</Notice>}
        {CONDITION_FIELDS.map((f) => section(f, editors[f]))}
      </div>

      <aside className={`${page.side} ${styles.summary}`} aria-labelledby="sum-title">
        <h2 id="sum-title" className={styles.summaryTitle}>
          변경 요약 · {changed.length}개 항목
        </h2>
        {changed.length === 0 ? (
          <p className={page.muted}>바꿀 항목을 고르면 여기에 정리돼요.</p>
        ) : (
          <ul className={styles.summaryList}>
            {changed.map((f) => (
              <li key={f}>
                <strong>{CONDITION_LABEL[f]}</strong>
                <span>
                  {describeField(original, f)} → {invalid.includes(f) ? '값을 입력해 주세요' : describeField(draft, f)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.evidence}>
          <span className={styles.label}>근거 자료 (1개 이상)</span>
          {request?.evidences.map((a, i) => (
            <div key={`${a.href ?? a.name}:${i}`} className={styles.file}>
              <Icon name={a.kind === 'link' ? 'link' : 'image'} size={16} />
              {a.href ? (
                <a href={a.href} target="_blank" rel="noopener noreferrer">
                  {a.name}
                </a>
              ) : (
                <span>{a.name}</span>
              )}
              <Tag>기존</Tag>
            </div>
          ))}
          {files.map((f) => (
            <div key={f.name} className={styles.file}>
              <Icon name="image" size={16} />
              <span>
                {f.name} · {formatFileSize(f.size)}
              </span>
              <button type="button" aria-label={`${f.name} 삭제`} onClick={() => setFiles((list) => list.filter((x) => x !== f))}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {links.map((l) => (
            <div key={l} className={styles.file}>
              <Icon name="link" size={16} />
              <span>{l}</span>
              <button type="button" aria-label={`${l} 삭제`} onClick={() => setLinks((list) => list.filter((x) => x !== l))}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label="근거 파일 추가"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((list) => [...list, ...picked.filter((p) => !list.some((x) => x.name === p.name))]);
              e.target.value = '';
            }}
          />
          <div className={styles.evidenceActions}>
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              <Icon name="plus" size={16} />
              파일 추가
            </Button>
          </div>
          <InputRow>
            <label htmlFor="c-link" className="sr-only">
              근거 링크
            </label>
            <TextInput id="c-link" placeholder="공지 링크 (인스타그램 · 홈페이지)" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!linkInput.trim()}
              onClick={() => {
                setLinks((list) => [...list, linkInput.trim()]);
                setLinkInput('');
              }}
            >
              추가
            </Button>
          </InputRow>
          {/* TODO: 근거 파일 형식 · 용량 규칙 (명세 WR-7) */}
          <span className={page.muted}>공지 캡처나 링크가 있으면 더 빨리 확인할 수 있어요.</span>
        </div>

        <div className={styles.preview}>
          <span className={styles.previewLabel}>
            승인되면 · 테스트 반려견 기준{previewState.loading && preview ? ' · 다시 계산 중…' : ''}
          </span>
          {previewState.loading && !preview && <span className={page.muted}>판정을 계산하는 중…</span>}
          {previewState.error && (
            <span role="alert" className={page.muted}>
              판정 미리보기를 불러오지 못했어요.{' '}
              <button type="button" className={page.retry} onClick={() => setPreviewTick((t) => t + 1)}>
                다시 시도
              </button>
            </span>
          )}
          {preview?.map((p) => (
            <div key={p.dogId} className={styles.previewItem} aria-busy={previewState.loading}>
              <span>{p.label}</span>
              <div className={styles.previewRow}>
                <JudgmentChip judgment={p.before} />
                <Icon name="arrowRight" size={16} />
                <JudgmentChip judgment={p.after} />
              </div>
            </div>
          ))}
        </div>

        {send.error && (
          <Notice
            tone="danger"
            role="alert"
            action={
              send.errorCode === 'CONDITIONS_OUTDATED' ? (
                <Button variant="secondary" size="sm" onClick={onRestart}>
                  최신 조건 불러오기
                </Button>
              ) : undefined
            }
          >
            {send.error}
          </Notice>
        )}

        {submitBlockers.length > 0 && (
          <ul className={styles.blockers} id="submit-blockers" aria-live="polite">
            {submitBlockers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <div className={styles.buttons}>
          <ButtonLink to={request ? '/requests' : '/conditions'} variant="secondary" className={styles.cancel}>
            취소
          </ButtonLink>
          <Button type="submit" className={styles.submit} disabled={!canSubmit} aria-describedby={submitBlockers.length > 0 ? 'submit-blockers' : undefined}>
            {send.pending ? '보내는 중…' : request ? '보완해서 다시 보내기' : '수정 요청 보내기'}
          </Button>
        </div>
      </aside>
      <RequestDetailModal requestId={detailId} onClose={() => setDetailId(null)} onChanged={onRestart} />
    </form>
  );
}

/** '체중 제한' → '체중 제한은', '크기' → '크기는' (마지막 글자 받침으로 은/는) */
function withTopic(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${word}${hasFinal ? '은' : '는'}`;
}

/**
 * 이미 요청을 보낸 항목의 안내 (pendingItems.status 별)
 * - NEEDS_INFO: [보완하기] → 그 요청의 보완 화면 (/conditions/edit?request=ID)
 * - RECEIVED · IN_REVIEW: [요청 내용 보기] → 그 요청 상세 팝업
 * 요청 번호는 본문에 쓰지 않고, 이동할 때만 requestId 를 써요.
 */
function PendingNote({ item, onOpenDetail }: { item: PendingItem; onOpenDetail: (requestId: string) => void }) {
  const name = CONDITION_LABEL[item.field];
  // 요청 ID 가 없으면 안내만 보여 주고 [보완하기] · [요청 내용 보기]는 그리지 않아요 (다른 요청을 짐작해 연결하지 않아요)
  const requestId = item.requestId;
  if (item.status === 'NEEDS_INFO') {
    return (
      <div className={`${styles.pendingNote} ${styles.pendingNoteWarn}`} role="note">
        <p>
          <Icon name="info" size={16} />
          이전에 보낸 {name} 변경 요청에 보완이 필요해요. 내용을 확인하고 다시 제출해 주세요.
        </p>
        {requestId && (
          <ButtonLink to={`/conditions/edit?request=${encodeURIComponent(requestId)}`} variant="primary" size="sm">
            보완하기
          </ButtonLink>
        )}
      </div>
    );
  }
  const text =
    item.status === 'RECEIVED'
      ? `${name} 변경 요청을 접수했어요. 요청 내용과 진행 상태를 확인할 수 있어요.`
      : item.status === 'IN_REVIEW'
        ? `보내신 ${name} 변경 요청을 검토하고 있어요. 검토가 끝나면 이 항목을 다시 수정할 수 있어요.`
        : `${name} 변경 요청이 진행 중이에요. 요청 내용과 진행 상태를 확인할 수 있어요.`;
  return (
    <div className={styles.pendingNote} role="note">
      <p>
        <Icon name="info" size={16} />
        {text}
      </p>
      {requestId && (
        <Button variant="secondary" size="sm" onClick={() => onOpenDetail(requestId)}>
          요청 내용 보기
        </Button>
      )}
    </div>
  );
}
