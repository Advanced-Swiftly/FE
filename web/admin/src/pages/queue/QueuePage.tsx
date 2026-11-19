import { USE_MOCK } from '@/api/client';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getQueuePage, getQueueSummary, type QueueTab } from '@/api/queue';
import { Button } from '@/components/common/Button';
import { useCursorList } from '@/hooks/useCursorList';
import { Card } from '@/components/common/Card';
import { Select, TextInput } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { StatGrid } from '@/components/common/StatGrid';
import { Tag, type TagTone } from '@/components/common/Tag';
import { AREAS } from '@/constants/status';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { QueueItemType, QueueStatus } from '@/types';
import { daysSince, formatDate } from '@/utils/format';
import { appToday } from '@/utils/today';
import { queuePath } from '@/utils/queue';
import styles from './QueuePage.module.css';

const TYPE: Record<QueueItemType, { label: string; tone: TagTone }> = {
  AI_POLICY: { label: 'AI 후보', tone: 'gray' },
  STORE_CHANGE: { label: '업체 요청', tone: 'dark' },
  EVENT: { label: '참여 신청', tone: 'orange' },
  AD: { label: '광고 신청', tone: 'blue' },
};

const STATUS: Record<QueueStatus, { label: string; tone: TagTone }> = {
  RECEIVED: { label: '접수', tone: 'gray' },
  IN_REVIEW: { label: '검토 중', tone: 'blue' },
  NEEDS_INFO: { label: '업체 보완 대기', tone: 'yellow' },
};

/** 유형 탭 4개 (명세 F-OREV-02 · UI-O-002 ③) — 서버가 탭별로 걸러 줘요 */
const TABS: { value: QueueTab; label: string }[] = [
  { value: 'AI_CANDIDATE', label: 'AI 후보' },
  { value: 'BUSINESS_CHANGE', label: '업체 변경' },
  { value: 'EVENT_AD', label: '이벤트 · 광고' },
  { value: 'NEEDS_INFO', label: '보완 대기' },
];

export function QueuePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const summary = useFetch('queue-summary', getQueueSummary);
  const [tab, setTab] = useState<QueueTab>('BUSINESS_CHANGE');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const flash = (location.state as { flash?: { text: string; storeId: string } } | null)?.flash;

  // 검색어는 입력이 멈추고 0.3초 뒤에 서버로 보내요
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queue = useCursorList(`queue:${tab}:${query}:${area}`, (cursor) => getQueuePage({ tab, q: query, region: area, cursor }));
  const rows = queue.items;
  const today = appToday();

  return (
    <div className={page.stack}>
      <PageHeader title="검토 대기열" description="처리가 끝난 요청은 대기열에서 사라지고 업체별 처리 이력에 남아요." />

      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })} action={<Link to={`/stores/${flash.storeId}?tab=history`}>업체 이력 보기</Link>}>
          {flash.text}
        </Notice>
      )}

      {summary.data && (
        <StatGrid label="요약">
          <KpiCard label="검토 대기" value={summary.data.waiting ?? '–'} unit="건" />
          <KpiCard label="오늘 처리" value={summary.data.processedToday ?? '–'} unit="건" />
          <KpiCard label="평균 처리 기간" value={summary.data.avgDays ?? '–'} unit="일" />
          <KpiCard label="확인일 30일 지난 업체" value={summary.data.staleStores ?? '–'} unit="곳 · 재확인 필요" tone="warning" to="/stores" />
        </StatGrid>
      )}

      <Card padding="none">
        <div className={styles.toolbar}>
          <h2 className="sr-only">검토 목록</h2>
          <Segmented
            variant="outline"
            label="유형"
            value={tab}
            onChange={setTab}
            options={TABS}
          />
          <div className={styles.filters}>
            <label htmlFor="q-search" className="sr-only">
              업체 검색
            </label>
            <TextInput id="q-search" type="search" placeholder="업체명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className={styles.search} />
            <label htmlFor="q-area" className="sr-only">
              지역
            </label>
            {/* 서버 대기열 목록에는 지역 필터가 없어(지역은 이벤트 신청에만 ID 로 있어요) 목업에서만 보여요 */}
            {USE_MOCK && <Select id="q-area" value={area} onChange={(e) => setArea(e.target.value)} className={styles.area}>
              <option value="">전체 지역</option>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>}
          </div>
        </div>

        <LoadState status={queue.status} errorText={queue.error ?? undefined} onRetry={queue.reload} />
        {queue.status === 'success' &&
          (rows.length === 0 ? (
            <p className={styles.empty}>{query || area ? '조건에 맞는 요청이 없어요.' : '이 탭에 검토할 요청이 없어요.'}</p>
          ) : (
            <div className={table.scroll}>
              <table className={`${table.table} ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col">유형</th>
                    <th scope="col">업체</th>
                    <th scope="col">검토 내용</th>
                    <th scope="col">원문 · 근거</th>
                    <th scope="col">접수</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => {
                    const age = daysSince(q.submittedAt, today);
                    return (
                      <tr key={`${q.type}:${q.id}`} className={styles.row} onClick={() => navigate(queuePath(q))}>
                        <td>
                          <Tag tone={TYPE[q.type].tone}>{TYPE[q.type].label}</Tag>
                        </td>
                        <td>
                          <Link to={queuePath(q)} className={styles.store} onClick={(e) => e.stopPropagation()}>
                            {q.storeName}
                          </Link>
                          {(q.area || q.category) && (
                            <span className={table.sub}>
                              {[q.area, q.category].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </td>
                        <td>
                          {q.summary}
                          {q.summaryNote && <span className={styles.note}> · {q.summaryNote}</span>}
                        </td>
                        <td className={table.muted}>{q.evidence}</td>
                        <td className={styles.nowrap}>
                          {formatDate(q.submittedAt, true)}
                          <span className={age > 3 ? styles.old : styles.note}> · {age === 0 ? '오늘' : `${age}일`}</span>
                        </td>
                        <td>
                          <Tag tone={STATUS[q.status].tone} shape="pill">
                            {STATUS[q.status].label}
                          </Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        {queue.hasMore && (
          <div className={styles.more}>
            <Button variant="secondary" onClick={queue.loadMore} disabled={queue.loadingMore}>
              {queue.loadingMore ? '불러오는 중…' : '더 보기'}
            </Button>
          </div>
        )}
        {queue.status === 'success' && queue.error && (
          <p role="alert" className={styles.empty}>
            {queue.error}
          </p>
        )}
        <p className={styles.foot}>승인 · 반려 · 취소된 건은 여기서 사라지고 업체 상세의 처리 이력에 남아요. 보완 요청은 업체가 다시 제출할 때까지 ‘보완 대기’로 남아요. 접수 3일이 넘으면 날짜가 강조돼요. 업체 인증 · 증명서 · 문의는 이 대기열에 들어오지 않아요.</p>
      </Card>
      <p className={page.muted}>화면의 업체명과 수치는 시안용 예시입니다.</p>
    </div>
  );
}
