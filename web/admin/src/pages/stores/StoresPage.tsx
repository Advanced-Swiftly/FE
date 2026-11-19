import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPlace, getPlacePage, requestRecheck, type NewPlace } from '@/api/stores';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, Select, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { AREAS } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCursorList } from '@/hooks/useCursorList';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { PlaceListItem, PlaceListPage } from '@/types';
import { formatDate } from '@/utils/format';
import { CATEGORY_LABEL, sourceLabel, SOURCE_LABEL } from '@/utils/places';
import styles from './StoresPage.module.css';

/** UI-O-006 업체 목록 (F-OPLACE-01 · 02 · 03) */
export function StoresPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState('');
  const recheck = useAction(requestRecheck);
  // 정보 근거 비율은 첫 페이지 응답의 sourceRatio 를 써요
  const [ratio, setRatio] = useState<PlaceListPage['sourceRatio']>([]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useCursorList(`places:${query}:${staleOnly}`, async (cursor) => {
    const res = await getPlacePage({ q: query, stale: staleOnly, cursor });
    if (!cursor) setRatio(res.sourceRatio);
    return res;
  });
  const total = ratio.reduce((sum, r) => sum + r.count, 0);

  const onRecheck = async (s: PlaceListItem) => {
    // 업체 조건 재검토 요청은 사유가 필수예요
    const reason = window.prompt(`${s.name} 재검토 요청 사유를 적어 주세요`, '확인일이 오래돼 조건 재확인 필요')?.trim();
    if (!reason) return;
    if ((await recheck.run(s.id, reason)).ok) {
      setFlash(`${s.name}에 조건 재확인 요청을 보냈어요.`);
      list.reload();
    }
  };

  return (
    <div className={page.stack}>
      <PageHeader
        title="업체 목록"
        description="조건 확인일과 QR 방문 인증을 따로 관리해요."
        actions={
          <Button variant="dark" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            업체 등록
          </Button>
        }
      />
      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}
      {recheck.error && (
        <Notice tone="danger" role="alert">
          {recheck.error}
        </Notice>
      )}

      {ratio.length > 0 && (
        <Card title="조건 정보 근거" aside={`전체 ${total}곳`}>
          <div className={styles.mixBar} role="img" aria-label={ratio.map((r) => `${sourceLabel(r.source)} ${r.count}곳`).join(', ')}>
            {ratio.map((r) => (
              <div key={r.source ?? 'null'} className={styles[`mix_${r.source ?? 'UNKNOWN'}`] ?? styles.mix_UNKNOWN} style={{ flexGrow: r.count }} />
            ))}
          </div>
          <div className={styles.mixLegend}>
            {ratio.map((r) => (
              <div key={r.source ?? 'null'}>
                <span aria-hidden="true" className={`${styles.dot} ${styles[`mix_${r.source ?? 'UNKNOWN'}`] ?? styles.mix_UNKNOWN}`} />
                <div>
                  <strong>
                    {sourceLabel(r.source)} {r.count}곳
                  </strong>
                  {r.source && SOURCE_LABEL[r.source] && <span>{SOURCE_LABEL[r.source].desc}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className={styles.toolbar}>
          <h2 className={styles.h2}>업체 목록</h2>
          <div className={styles.filters}>
            <label htmlFor="st-search" className="sr-only">
              업체 검색
            </label>
            <TextInput id="st-search" type="search" placeholder="업체명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className={styles.search} />
            <Choice type="checkbox" label="확인일 30일 지난 업체만" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
          </div>
        </div>
        <LoadState status={list.status} errorText={list.error ?? undefined} onRetry={list.reload} />
        {list.status === 'success' &&
          (list.items.length === 0 ? (
            <p className={styles.foot}>{query || staleOnly ? '조건에 맞는 업체가 없어요.' : '등록된 업체가 없어요.'}</p>
          ) : (
            <div className={table.scroll}>
              <table className={`${table.table} ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col">업체</th>
                    <th scope="col">정보 근거</th>
                    <th scope="col">조건 확인일</th>
                    <th scope="col">QR 인증</th>
                    <th scope="col">
                      <span className="sr-only">작업</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s.id} className={s.stale ? styles.staleRow : undefined}>
                      <td>
                        <Link to={`/stores/${s.id}`} className={styles.name}>
                          {s.name}
                        </Link>
                        <span className={table.sub}>
                          {[s.region, s.category ? (CATEGORY_LABEL[s.category] ?? s.category) : null].filter(Boolean).join(' · ')}
                          {s.hidden && ' · 지도 노출 중지'}
                        </span>
                      </td>
                      <td>{s.source === 'UNKNOWN' || !s.source ? <Tag shape="pill">{sourceLabel(s.source)}</Tag> : sourceLabel(s.source)}</td>
                      <td className={styles.nowrap}>
                        {s.conditionCheckedAt ? (
                          <span className={s.stale ? styles.stale : undefined}>
                            {formatDate(s.conditionCheckedAt, true)}
                            {s.stale && ' · 30일 지남'}
                          </span>
                        ) : (
                          <span className={table.muted}>—</span>
                        )}
                      </td>
                      <td className={s.qrVisitCount ? undefined : table.muted}>{s.qrVisitCount === null ? '—' : s.qrVisitCount ? `${s.qrVisitCount}건` : '기록 없음'}</td>
                      <td className={table.right}>
                        {!s.conditionCheckedAt ? (
                          <Button variant="secondary" size="sm" onClick={() => navigate(`/stores/${s.id}?tab=conditions&edit=1`)}>
                            직접 확인 기록
                          </Button>
                        ) : s.stale !== false ? (
                          // 확인일 상태를 모르는 업체(null)도 재검토를 요청할 수 있어요 — 사유는 필수
                          <Button variant="secondary" size="sm" disabled={s.recheckRequested || recheck.pending} onClick={() => onRecheck(s)}>
                            {s.recheckRequested ? '요청 보냄' : '재확인 요청'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {list.hasMore && (
          <div className={styles.more}>
            <Button variant="secondary" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? '불러오는 중…' : '더 보기'}
            </Button>
          </div>
        )}
        <div className={styles.foot}>
          <span>업체 이름을 누르면 상세 정보 · 관리로 이동 · 조건 확인일 30일 지나면 노란색으로 표시 · QR 인증 수는 정책 최신성 근거가 아니에요</span>
          {list.status === 'success' && (
            <span>
              {list.items.length}곳 표시{list.hasMore ? ' · 더 있음' : ''}
            </span>
          )}
        </div>
      </Card>

      {adding && (
        <NewPlaceModal
          onClose={() => setAdding(false)}
          onDone={(s) => {
            setAdding(false);
            setFlash(`${s.name}을 등록했어요.`);
            list.reload();
          }}
        />
      )}
    </div>
  );
}

function NewPlaceModal({ onClose, onDone }: { onClose: () => void; onDone: (s: PlaceListItem) => void }) {
  const [form, setForm] = useState<Omit<NewPlace, 'channels'> & { channelsText: string }>({ name: '', region: AREAS[0], category: 'CAFE', source: 'ONLINE', channelsText: '' });
  const create = useAction(createPlace);
  const valid = form.name.trim().length > 0;

  const onSubmit = async () => {
    const res = await create.run({ name: form.name, region: form.region, category: form.category, source: form.source, channels: form.channelsText.split('\n') });
    if (res.ok) onDone(res.data);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="업체 등록"
      kicker="운영자 직접 등록"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="dark" disabled={!valid || create.pending} onClick={onSubmit}>
            등록하기
          </Button>
        </>
      }
    >
      <Field label="업체 이름" htmlFor="ns-name">
        <TextInput id="ns-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Field>
      <div className={styles.twoCol}>
        <Field label="지역" htmlFor="ns-area" hint="값 목록은 백엔드 확인 중이에요">
          <Select id="ns-area" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="업종" htmlFor="ns-cat">
          <Select id="ns-cat" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {Object.entries(CATEGORY_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>조건 정보 근거</legend>
        {Object.entries(SOURCE_LABEL).map(([k, v]) => (
          <Choice key={k} type="radio" name="ns-source" label={`${v.label} · ${v.desc}`} checked={form.source === k} onChange={() => setForm((f) => ({ ...f, source: k }))} />
        ))}
      </fieldset>
      <Field label="공식 채널 (선택)" htmlFor="ns-channel" hint="홈페이지 · SNS 주소를 한 줄에 하나씩 적어 주세요.">
        <textarea id="ns-channel" rows={2} className={styles.channels} placeholder="https://instagram.com/..." value={form.channelsText} onChange={(e) => setForm((f) => ({ ...f, channelsText: e.target.value }))} />
      </Field>
      {create.error && (
        <Notice tone="danger" role="alert">
          {create.error}
        </Notice>
      )}
    </Modal>
  );
}
