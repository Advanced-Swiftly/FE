import { USE_MOCK } from '@/api/client';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getPlaceAccount,
  getPlaceConditions,
  getPlaceHistoryPage,
  getPlaceOverview,
  QR_STATUS_VALUES,
  reissuePlaceQr,
  requestRecheck,
  setPlaceQrStatus,
  setPlaceVisibility,
  updatePlaceConditions,
  updatePlaceInfo,
  updatePlaceMemo,
} from '@/api/stores';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Field, Select, TextArea, TextInput } from '@/components/common/Field';
import { InfoList } from '@/components/common/InfoList';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { StatGrid } from '@/components/common/StatGrid';
import { Tag } from '@/components/common/Tag';
import { ConditionValueInput } from '@/components/conditions/ConditionValueInput';
import { useAction } from '@/hooks/useAction';
import { useCursorList } from '@/hooks/useCursorList';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { ConditionState, PlaceConditionsView, PlaceInfo, PlaceOverview } from '@/types';
import { invalidField } from '@/utils/conditionEdit';
import { CONDITION_FIELDS, CONDITION_LABEL, changedFields, describeField, fieldState } from '@/utils/conditions';
import { daysSince, formatDate } from '@/utils/format';
import { appToday } from '@/utils/today';
import { CATEGORY_LABEL, CHECK_METHODS, sourceLabel } from '@/utils/places';
import { queuePath } from '@/utils/queue';
import styles from './StoreDetailPage.module.css';

type Tab = 'overview' | 'conditions' | 'history' | 'account';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: '개요' },
  { value: 'conditions', label: '입장 조건' },
  { value: 'history', label: '변경 · 처리 이력' },
  { value: 'account', label: '계정 · QR' },
];

const fmtDateTime = (iso: string | null) => (iso ? `${formatDate(iso, true)} ${iso.slice(11, 16)}` : '—');

/** UI-O-008 업체 상세 · 관리 (/stores/:id?tab=) — 개요 F-OPLACE-04, 탭은 각각 09 · 08 · 11 */
export function StoreDetailPage() {
  const { id = '' } = useParams();
  const overview = useFetch(`place:${id}`, () => getPlaceOverview(id));

  return (
    <div className={page.stack}>
      <LoadState status={overview.status} errorText={overview.error?.message ?? '업체를 찾을 수 없어요.'} onRetry={overview.reload} />
      {overview.data && <DetailBody key={id} s={overview.data} reload={overview.reload} />}
    </div>
  );
}

function DetailBody({ s, reload }: { s: PlaceOverview; reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'overview') as Tab;
  const editConditions = params.get('edit') === '1';
  const [flash, setFlash] = useState('');
  const recheck = useAction(requestRecheck);
  const [recheckSent, setRecheckSent] = useState(false);

  const go = (t: Tab, extra?: Record<string, string>) => setParams({ tab: t, ...extra }, { replace: true });
  const done = (message: string) => {
    setFlash(message);
    reload();
  };

  const checked = s.summary.conditionCheckedAt;
  const age = checked ? daysSince(checked, appToday()) : null;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: '업체 목록', to: '/stores' }, { label: s.name }]}
        title={s.name}
        titleAside={
          <>
            {/* 칩이 보는 값은 명세 [확인 필요] (OPL-21 · 22) — 받은 값을 그대로 보여 줘요 */}
            {s.chips.certification && <Tag shape="pill">{s.chips.certification === 'APPROVED' ? '인증 완료' : s.chips.certification}</Tag>}
            {s.chips.checkMethod && <Tag shape="pill">{s.chips.checkMethod}</Tag>}
            {s.chips.eventParticipation && (
              <Tag tone="orange" shape="pill">
                {s.chips.eventParticipation}
              </Tag>
            )}
            {s.chips.hidden && (
              <Tag tone="red" shape="pill">
                지도 노출 중지
              </Tag>
            )}
          </>
        }
        description={[s.region, s.category ? (CATEGORY_LABEL[s.category] ?? s.category) : null, s.source ? sourceLabel(s.source) : null, s.info.address, typeof s.policyVersion === 'number' ? `정책 버전 ${s.policyVersion}` : null].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={recheckSent || recheck.pending}
              onClick={async () => {
                // 업체 조건 재검토 요청은 사유가 필수예요
                const reason = window.prompt(`${s.name} 재검토 요청 사유를 적어 주세요`, '조건 재확인 필요')?.trim();
                if (!reason) return;
                if ((await recheck.run(s.id, reason)).ok) {
                  setRecheckSent(true);
                  done('업체에 조건 재확인 요청을 보냈어요.');
                }
              }}
            >
              {recheckSent ? '재확인 요청 보냄' : '업체에 조건 재확인 요청'}
            </Button>
            <Button variant="dark" onClick={() => go('conditions', { edit: '1' })}>
              조건 직접 수정
            </Button>
          </>
        }
      />
      {recheck.error && (
        <Notice tone="danger" role="alert">
          {recheck.error}
        </Notice>
      )}

      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}

      <div role="tablist" aria-label="업체 정보" className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={`${styles.tab} ${tab === t.value ? styles.tabOn : ''}`} onClick={() => go(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className={page.stack}>
        {tab === 'overview' && (
          <>
            <StatGrid label="요약">
              <KpiCard
                label="조건 확인일"
                value={checked ? formatDate(checked, true) : '—'}
                caption={age !== null ? `${age}일 전` : '미확인'}
                tone={age !== null && age > 30 ? 'warning' : 'default'}
              />
              <KpiCard label="QR 인증" value={s.summary.qrVisitCount ?? '–'} unit="건" />
              <KpiCard label="진행 중인 요청" value={s.summary.openRequestCount ?? '–'} unit="건" action={<Link to="/queue">검토 대기열</Link>} />
              <KpiCard label="답변 대기 문의" value={s.summary.inquiryCount ?? '–'} unit="건" action={<Link to="/qna">Q&amp;A에서 보기</Link>} />
            </StatGrid>
            <div className={page.half}>
              <InfoCard id={s.id} info={s.info} onSaved={() => done('업체 정보를 저장했어요.')} />
              <MemoCard id={s.id} memo={s.memo} onSaved={() => done('운영 메모를 저장했어요.')} />
            </div>
          </>
        )}

        {tab === 'conditions' && (
          <ConditionsTab
            id={s.id}
            editing={editConditions}
            onEdit={(on) => go('conditions', on ? { edit: '1' } : {})}
            onSaved={() => {
              go('conditions');
              done('입장 조건을 저장했어요. 확인일이 오늘로 바뀌고 변경 이력에 남았어요.');
            }}
          />
        )}

        {tab === 'history' && <HistoryTab id={s.id} />}

        {tab === 'account' && <AccountTab id={s.id} onChanged={setFlash} />}
      </div>

      <MapVisibility id={s.id} hidden={s.chips.hidden} onChanged={done} />
    </>
  );
}

function InfoCard({ id, info, onSaved }: { id: string; info: PlaceInfo; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ address: info.address ?? '', phone: info.phone ?? '', channels: info.channels.join('\n') });
  const save = useAction(updatePlaceInfo);
  const next: PlaceInfo = { address: form.address.trim() || null, phone: form.phone.trim() || null, channels: form.channels.split('\n').map((c) => c.trim()).filter(Boolean) };

  return (
    <Card
      title="업체 정보"
      aside={
        !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            정보 수정
          </Button>
        )
      }
    >
      {editing ? (
        <div className={page.stackSm}>
          <Field label="주소" htmlFor="si-address">
            <TextInput id="si-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="연락처" htmlFor="si-phone">
            <TextInput id="si-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="공식 채널" htmlFor="si-channels" hint="한 줄에 하나씩">
            <TextArea id="si-channels" rows={3} value={form.channels} onChange={(e) => setForm((f) => ({ ...f, channels: e.target.value }))} />
          </Field>
          {save.error && (
            <Notice tone="danger" role="alert">
              {save.errorField ? `${save.error} (${save.errorField})` : save.error}
            </Notice>
          )}
          <div className={page.actions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                save.reset();
                setEditing(false);
              }}
            >
              취소
            </Button>
            <Button
              variant="dark"
              size="sm"
              disabled={save.pending}
              onClick={async () => {
                if ((await save.run(id, info, next)).ok) {
                  setEditing(false);
                  onSaved();
                }
              }}
            >
              저장
            </Button>
          </div>
        </div>
      ) : (
        <InfoList
          labelWidth={110}
          rows={[
            { label: '주소', value: info.address ?? '—' },
            { label: '연락처', value: info.phone ?? '—' },
            {
              label: '공식 채널',
              value: info.channels.length ? (
                <span className={page.stackSm}>
                  {info.channels.map((c) => (
                    <a key={c} href={/^https?:\/\//.test(c) ? c : `https://${c}`} target="_blank" rel="noreferrer">
                      {c}
                    </a>
                  ))}
                </span>
              ) : (
                '—'
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

function MemoCard({ id, memo, onSaved }: { id: string; memo: PlaceOverview['memo']; onSaved: () => void }) {
  const [text, setText] = useState(memo.text);
  const save = useAction(updatePlaceMemo);
  const dirty = text !== memo.text;

  return (
    <Card title="운영 메모">
      <label htmlFor="sd-memo" className="sr-only">
        운영 메모
      </label>
      <TextArea id="sd-memo" rows={5} value={text} placeholder="운영자끼리 공유할 내용을 적어 주세요." onChange={(e) => setText(e.target.value)} />
      {save.error && (
        <Notice tone="danger" role="alert">
          {save.error}
        </Notice>
      )}
      <div className={page.actionsBetween}>
        <span className={page.muted}>
          운영자끼리만 보여요{memo.updatedAt && ` · ${fmtDateTime(memo.updatedAt)}`}
          {memo.updatedBy && ` ${memo.updatedBy}`}
        </span>
        <Button
          variant="dark"
          size="sm"
          disabled={!dirty || save.pending}
          onClick={async () => {
            if ((await save.run(id, text)).ok) onSaved();
          }}
        >
          메모 저장
        </Button>
      </div>
    </Card>
  );
}

/** UI-O-009 입장 조건 — 조회 F-OPLACE-09, 직접 수정 F-OPLACE-10 */
function ConditionsTab({ id, editing, onEdit, onSaved }: { id: string; editing: boolean; onEdit: (on: boolean) => void; onSaved: () => void }) {
  // 409 뒤 [최신 조건 불러오기]를 누르면 회차를 올려 처음부터 다시 읽고, 새 편집을 시작해요.
  const [round, setRound] = useState(0);
  const cond = useFetch(`place-cond:${id}:${round}`, () => getPlaceConditions(id));

  if (cond.status !== 'success') return <LoadState status={cond.status} errorText={cond.error?.message} onRetry={cond.reload} />;
  const v = cond.data;

  return (
    <Card padding="none">
      {v.pendingRequests.length > 0 && (
        <div className={styles.pendingBar}>
          <span>
            검토 중인 <strong>변경 요청 {v.pendingRequests.length}건</strong>이 있어요. 직접 수정해도 막지 않아요.
          </span>
          {v.pendingRequests.map((p) => (
            <Link key={p.requestId} to={queuePath({ id: p.requestId, type: 'STORE_CHANGE' })}>
              {p.requestId} 검토하러 가기
            </Link>
          ))}
        </div>
      )}
      {editing ? (
        <ConditionsEditor
          key={`${round}`}
          id={id}
          view={v}
          onCancel={() => onEdit(false)}
          onSaved={onSaved}
          onRestart={() => setRound((r) => r + 1)}
        />
      ) : (
        <>
          <ConditionTable state={v.state} />
          <p className={styles.foot}>
            출처 {v.source ?? '—'} · 확인일 {v.checkedAt ? formatDate(v.checkedAt) : '—'}
            {v.sourceUrl && (
              <>
                {' · '}
                <a href={v.sourceUrl} target="_blank" rel="noreferrer">
                  원문 보기
                </a>
              </>
            )}
          </p>
          <p className={styles.foot}>저장하면 바로 보호자 화면에 반영되고 확인일이 오늘이 돼요. 출처 · 처리자 · 변경 전후가 이력에 남아요.</p>
        </>
      )}
    </Card>
  );
}

function ConditionTable({ state, edit }: { state: ConditionState; edit?: { draft: ConditionState; setDraft: (s: ConditionState) => void; base: ConditionState; disabled: boolean; idPrefix: string } }) {
  const changed = edit ? changedFields(edit.base, edit.draft) : [];
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">현재 조건</th>
            {edit && <th scope="col">변경</th>}
          </tr>
        </thead>
        <tbody>
          {CONDITION_FIELDS.map((f) => {
            const st = fieldState(state, f);
            return (
              <tr key={f}>
                <td>{CONDITION_LABEL[f]}</td>
                <td>
                  {edit ? (
                    <ConditionValueInput field={f} state={edit.draft} onChange={edit.setDraft} idPrefix={edit.idPrefix} disabled={edit.disabled} />
                  ) : st === 'UNRESTRICTED' ? (
                    <span className={styles.inlineTag}>
                      {describeField(state, f)} <Tag tone="green">가능</Tag>
                    </span>
                  ) : st === 'UNKNOWN' ? (
                    <Tag shape="pill">미확인</Tag>
                  ) : (
                    describeField(state, f)
                  )}
                </td>
                {edit && <td className={table.muted}>{changed.includes(f) ? `${describeField(edit.base, f)} → ${describeField(edit.draft, f)}` : '—'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 편집 화면. 열리는 순간의 조건 · conditionsVersion 을 고정하고, 저장할 때 그 버전을 baseVersion 으로 보내요.
 * 버전이 없으면 저장을 막고, 409(CONDITIONS_OUTDATED)면 다시 보내지 않고 최신 조건으로 새 편집을 시작하게 해요.
 */
function ConditionsEditor({ id, view, onCancel, onSaved, onRestart }: { id: string; view: PlaceConditionsView; onCancel: () => void; onSaved: () => void; onRestart: () => void }) {
  const [frozen] = useState(() => ({ base: structuredClone(view.state), version: view.conditionsVersion }));
  const [draft, setDraft] = useState<ConditionState>(() => structuredClone(view.state));
  // 확인 방법은 필수 · 편집을 시작할 때마다 비워 둬요 (409 뒤 다시 시작해도 이 화면이 새로 만들어져 비어 있어요)
  const [checkMethod, setCheckMethod] = useState('');
  const save = useAction(updatePlaceConditions);
  const invalid = CONDITION_FIELDS.filter((f) => invalidField(draft, f));
  const changed = changedFields(frozen.base, draft);
  const outdated = save.errorCode === 'CONDITIONS_OUTDATED';
  const noVersion = frozen.version === null;
  const blocked = noVersion || outdated;

  return (
    <>
      <ConditionTable state={draft} edit={{ draft, setDraft, base: frozen.base, disabled: save.pending || blocked, idPrefix: `cond-${id}` }} />
      <div className={styles.editBar}>
        {noVersion && (
          <Notice tone="danger" role="alert">
            서버 응답에 조건 버전(conditionsVersion)이 없어 저장할 수 없어요. 다른 운영자의 수정을 덮어쓸 수 있어서 막아 두었어요.
          </Notice>
        )}
        {outdated && (
          <Notice
            tone="warning"
            role="alert"
            action={
              <Button variant="secondary" size="sm" onClick={onRestart}>
                최신 조건 불러와서 다시 시작
              </Button>
            }
          >
            다른 운영자가 이 업체 조건을 먼저 바꿔서 저장되지 않았어요. 입력한 값을 자동으로 다시 보내지 않아요. 최신 조건을 확인한 뒤 다시 수정해 주세요.
          </Notice>
        )}
        <Field
          label="확인 방법 (필수)"
          htmlFor="cond-source"
          message={
            save.error && !outdated
              ? { tone: 'error', text: save.errorField === 'checkMethod' ? '서버가 이 확인 방법을 받지 않았어요. 다른 확인 방법을 고르거나 운영팀에 허용 값을 확인해 주세요.' : save.error }
              : !checkMethod && !blocked
                ? { tone: 'error', text: '확인 방법을 골라야 저장할 수 있어요.' }
                : invalid.length
                ? { tone: 'error', text: `${invalid.map((f) => CONDITION_LABEL[f]).join(', ')} 값을 입력해 주세요.` }
                : null
          }
        >
          <Select id="cond-source" value={checkMethod} disabled={blocked} onChange={(e) => setCheckMethod(e.target.value)} className={styles.sourceSelect}>
            <option value="">확인 방법 고르기</option>
            {CHECK_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className={page.actions}>
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button
            variant="dark"
            disabled={save.pending || blocked || !checkMethod || invalid.length > 0}
            onClick={async () => {
              if (frozen.version === null) return;
              if ((await save.run(id, frozen.version, frozen.base, draft, checkMethod)).ok) onSaved();
            }}
          >
            {changed.length ? `저장 · 확인일 갱신 (${changed.length}개 변경)` : '확인일만 갱신'}
          </Button>
        </div>
        <span className={page.muted}>기준 버전 {frozen.version ?? '없음'} · 수정을 시작한 시점의 조건과 비교해 바꾼 항목만 보내요.</span>
      </div>
    </>
  );
}

/** F-OPLACE-08 처리 이력 */
function HistoryTab({ id }: { id: string }) {
  const list = useCursorList(`place-history:${id}`, (cursor) => getPlaceHistoryPage(id, cursor));
  return (
    // 서버 모드는 '업체 정책 변경 이력' API 라 전체 운영 이력처럼 보이지 않게 제목을 구분해요
    <Card title={USE_MOCK ? '변경 · 처리 이력' : '입장 정책 변경 이력'} aside={USE_MOCK ? undefined : '정책 버전 · 변경 주체 · 관련 요청만 보여요'} padding="none">
      <LoadState status={list.status} errorText={list.error ?? undefined} onRetry={list.reload} />
      {list.status === 'success' &&
        (list.items.length === 0 ? (
          <p className={styles.foot}>아직 이력이 없어요.</p>
        ) : (
          <div className={table.scroll}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">종류 · 결과</th>
                  <th scope="col">내용</th>
                  <th scope="col">처리자</th>
                  <th scope="col">관련 요청</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((h) => (
                  <tr key={h.id}>
                    <td className={styles.nowrap}>{fmtDateTime(h.at)}</td>
                    <td>
                      {h.type}
                      {h.result && <span className={table.sub}>{h.result}</span>}
                    </td>
                    <td>{h.changes ?? '—'}</td>
                    <td>{h.actorName ?? '—'}</td>
                    <td>{h.requestId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {list.hasMore && (
        <div className={styles.more}>
          <Button variant="secondary" size="sm" onClick={list.loadMore} disabled={list.loadingMore}>
            {list.loadingMore ? '불러오는 중…' : '더 보기'}
          </Button>
        </div>
      )}
      <p className={styles.foot}>이력의 종류 · 결과 값과 변경 전후 모양은 백엔드 확인 중이라 받은 값을 그대로 보여 줘요.</p>
    </Card>
  );
}

/** F-OPLACE-11 계정 · QR, F-OPLACE-12 재발급, F-OPLACE-13 사용 중지 */
function AccountTab({ id, onChanged }: { id: string; onChanged: (m: string) => void }) {
  const acc = useFetch(`place-account:${id}`, () => getPlaceAccount(id));
  const reissue = useAction(reissuePlaceQr);
  const status = useAction(setPlaceQrStatus);
  const [confirm, setConfirm] = useState(false);

  if (acc.status !== 'success') return <LoadState status={acc.status} errorText={acc.error?.message} onRetry={acc.reload} />;
  const { account, qr } = acc.data;

  return (
    <div className={page.half}>
      <Card title="업체 관리자 계정">
        {account ? (
          <InfoList
            labelWidth={100}
            rows={[
              { label: '아이디', value: account.withdrawn ? `${account.loginId} (탈퇴)` : account.loginId },
              { label: '담당자', value: account.managerName ?? '—' },
              { label: '마지막 로그인', value: fmtDateTime(account.lastLoginAt) },
              { label: '연결 업체', value: account.linkedPlaces.map((p) => p.name).join(' · ') || '—' },
            ]}
          />
        ) : (
          <p className={page.muted}>연결된 계정 없음 · 업체 관리자가 가입해 업체 인증을 받으면 연결돼요.</p>
        )}
      </Card>
      <Card title="매장 QR">
        {!qr ? (
          <p className={page.muted}>아직 발급된 QR이 없어요.</p>
        ) : (
          <>
            <div className={styles.qrRow}>
              <span>
                {qr.qrId} · {qr.issuedAt ? formatDate(qr.issuedAt) : '—'} 발급
              </span>
              <Tag shape="pill">{qr.status ?? '상태 정보 없음'}</Tag>
            </div>
            {(reissue.error || status.error) && (
              <Notice tone="danger" role="alert">
                {reissue.error ?? status.error}
              </Notice>
            )}
            {confirm ? (
              <Notice
                tone="warning"
                action={
                  <div className={page.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
                      취소
                    </Button>
                    <Button
                      variant="dangerSolid"
                      size="sm"
                      disabled={reissue.pending}
                      onClick={async () => {
                        if ((await reissue.run(id)).ok) {
                          setConfirm(false);
                          acc.reload();
                          onChanged('QR을 새로 발급했어요. 예전 QR은 더 이상 인증되지 않아요.');
                        }
                      }}
                    >
                      재발급
                    </Button>
                  </div>
                }
              >
                재발급하면 매장에 붙은 예전 QR은 바로 못 써요.
              </Notice>
            ) : (
              <div className={page.actions}>
                <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
                  QR 재발급
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!QR_STATUS_VALUES || status.pending}
                  onClick={async () => {
                    if ((await status.run(id, true)).ok) acc.reload();
                  }}
                >
                  QR 사용 중지
                </Button>
              </div>
            )}
            {!QR_STATUS_VALUES && <p className={page.muted}>QR 사용 중지 · 다시 사용은 상태 값이 정해진 뒤(백엔드 확인 중) 쓸 수 있어요.</p>}
          </>
        )}
      </Card>
    </div>
  );
}

function MapVisibility({ id, hidden, onChanged }: { id: string; hidden: boolean; onChanged: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('폐업 · 휴업');
  const action = useAction(setPlaceVisibility);

  const run = async (visible: boolean) => {
    if ((await action.run(id, visible, visible ? undefined : reason)).ok) {
      setOpen(false);
      onChanged(visible ? '보호자 지도에 다시 보이게 했어요.' : `보호자 지도에서 숨겼어요 (${reason}).`);
    }
  };

  return (
    <section className={styles.danger} aria-labelledby="danger-title">
      <div>
        <h2 id="danger-title" className={page.subTitle}>
          지도 노출 관리
        </h2>
        <p className={page.muted}>폐업 · 휴업이거나 조건이 크게 틀렸을 때 보호자 지도에서 잠시 숨길 수 있어요.</p>
        {action.error && (
          <p role="alert" className={styles.actionError}>
            {action.error}
          </p>
        )}
      </div>
      {!hidden ? (
        open ? (
          <div className={styles.dangerForm}>
            <label htmlFor="hide-reason" className="sr-only">
              중지 사유
            </label>
            {/* 사유 목록은 명세 [확인 필요] (원본 41) */}
            <Select id="hide-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={styles.sourceSelect}>
              <option>폐업 · 휴업</option>
              <option>입장 조건이 크게 틀림</option>
              <option>업체 요청</option>
            </Select>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="dangerSolid" disabled={action.pending} onClick={() => run(false)}>
              노출 중지
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setOpen(true)}>
            지도 노출 중지
          </Button>
        )
      ) : (
        <Button variant="secondary" disabled={action.pending} onClick={() => run(true)}>
          다시 노출
        </Button>
      )}
    </section>
  );
}
