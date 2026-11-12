import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getConditions } from '@/api/conditions';
import { getRequestPage } from '@/api/requests';
import { getVisitStats } from '@/api/stats';
import { getDashboard } from '@/api/stores';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { StatGrid } from '@/components/common/StatGrid';
import { StatusChip } from '@/components/common/StatusChip';
import { QrModal } from '@/components/qr/QrModal';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import { CONDITION_FIELDS, CONDITION_LABEL, describeField, fieldState } from '@/utils/conditions';
import { lastDays, todayISO } from '@/utils/date';
import { daysSince, formatDate } from '@/utils/format';
import styles from './DashboardPage.module.css';

const KIND_LABEL = { CONDITION: '조건 변경', EVENT_AD: '이벤트 · 광고' } as const;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 업체 대시보드: 요약 · 현재 입장 조건 · 최근 14일 QR 인증 · 요청 처리 현황 */
export function DashboardPage() {
  const { store } = useCurrentStore();
  const [qrOpen, setQrOpen] = useState(false);
  const conditions = useFetch(`conditions:${store.id}`, () => getConditions(store.id));
  const summary = useFetch(`dashboard:${store.id}`, () => getDashboard(store.id));
  // 명세 F-WSTAT-01 6번: 대시보드는 오늘 포함 최근 14일을 from · to 로 불러요.
  const range = lastDays(14);
  const stats = useFetch(`stats:${store.id}:${range.from}:${range.to}`, () => getVisitStats(store.id, range));
  // 명세 F-WREQ-01: 대시보드 최근 요청은 limit=3 으로 3건만 받아요. 요약 숫자(summary)도 같은 응답에서 써요.
  const requests = useFetch(`requests:${store.id}:recent3`, () => getRequestPage(store.id, { limit: 3 }));

  const todayStr = todayISO();
  const today = new Date(`${todayStr}T00:00:00`);
  const c = conditions.data;
  const d = summary.data;
  const s = stats.data;

  const last14 = s?.daily ?? [];
  const max14 = Math.max(1, ...last14.map((x) => x.count));
  const peak = last14.length ? last14.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const todayVisits = last14[last14.length - 1];

  // 진행 중 요청 수는 F-WDASH-02 값, 내가 할 일 수는 F-WREQ-01 summary.needsAction
  const recent = requests.data?.items ?? [];
  const fixCount = requests.data?.summary?.needsAction ?? 0;
  const latestOpen = recent.find((r) => r.group === 'IN_PROGRESS');
  const checkedAt = d?.conditionCheckedAt ?? c?.conditionCheckedAt ?? null;
  const checkedDays = checkedAt ? daysSince(checkedAt, today) : null;

  return (
    <div className={page.stack}>
      <header className={styles.header}>
        <div className={styles.titleBox}>
          <span className={styles.date}>
            {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 {WEEKDAYS[today.getDay()]}요일
          </span>
          <h1 className={styles.title}>{store.name}</h1>
        </div>
        <Button variant="secondary" onClick={() => setQrOpen(true)}>
          <Icon name="qr" />
          매장 QR
        </Button>
      </header>

      <Notice>
        입장 조건은 업체에서 직접 바꿀 수 없어요. <strong>변경 요청</strong>을 보내면 운영자가 근거를 확인한 뒤 반영하고, 조건 확인일이 갱신돼요.
      </Notice>

      {summary.status === 'error' && <LoadState status="error" errorText="요약을 불러오지 못했어요." onRetry={summary.reload} />}
      <StatGrid label="요약">
        <KpiCard label="이번 달 QR 인증 방문" value={d?.qrVisitCount ?? '–'} unit="건" caption="PawFit QR 인증 기준 · 전체 방문객 수 아님" />
        <KpiCard label="댕댕로드 스탬프 적립" value={d?.stampCount ?? '–'} unit="개" caption="이번 달 QR 인증 중 스탬프가 쌓인 수" />
        <KpiCard
          label="진행 중인 요청"
          value={d?.inProgressRequestCount ?? '–'}
          unit="건"
          caption={
            fixCount > 0
              ? `보완 요청 ${fixCount}건 · 내가 할 일`
              : latestOpen
                ? `${REQUEST_STATUS_LABEL[latestOpen.status]} · ${formatDate(latestOpen.submittedAt, true)} 접수`
                : '진행 중인 요청 없음'
          }
          tone={fixCount > 0 ? 'warning' : 'default'}
          action={<Link to="/requests">요청 처리 현황</Link>}
        />
        <KpiCard
          label="조건 마지막 확인일"
          value={checkedAt ? formatDate(checkedAt, true) : '–'}
          caption={checkedDays !== null ? `운영자 확인 · ${checkedDays}일 전${checkedDays > 30 ? ' · 재확인 필요' : ''}` : '아직 확인 전이에요'}
          tone={checkedDays !== null && checkedDays > 30 ? 'warning' : 'default'}
        />
      </StatGrid>

      <div className={styles.columns}>
        <Card
          title="현재 적용 중인 입장 조건"
          aside={
            c && (
              <span className={styles.verified}>
                <Icon name="checkCircle" size={16} />
                {c.checkMethod ?? '확인 방식 미정'}
              </span>
            )
          }
          className={styles.conditions}
        >
          <LoadState status={conditions.status} onRetry={conditions.reload} />
          {c && (
            <>
              <dl className={styles.condList}>
                {CONDITION_FIELDS.map((key) => {
                  const unknown = fieldState(c, key) === 'UNKNOWN';
                  const pending = c.pendingItems.find((p) => p.field === key);
                  return (
                    <div key={key} className={styles.condRow}>
                      <dt>{CONDITION_LABEL[key]}</dt>
                      <dd>
                        {unknown ? (
                          <span className={styles.unknown}>
                            <JudgmentChip judgment="UNKNOWN" label="미확인" />
                            <span>보호자에게 ‘조건 확인 필요’로 안내돼요</span>
                          </span>
                        ) : (
                          describeField(c, key)
                        )}
                        {pending && <span className={styles.pending}>변경 요청 {REQUEST_STATUS_LABEL[pending.status]}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className={styles.condFoot}>
                <span>출처: {c.source ?? '—'}</span>
                <span>조건 확인일: {c.conditionCheckedAt ? formatDate(c.conditionCheckedAt) : '—'}</span>
                {s && <span>최근 QR 인증: {formatDate(s.to)}</span>}
                <Link to="/conditions" className={styles.condLink}>
                  입장 조건 현황 <Icon name="chevronRight" size={14} />
                </Link>
              </div>
            </>
          )}
        </Card>

        <div className={styles.side}>
          <Card title="QR 인증 방문 · 최근 14일" aside={<Link to="/stats">자세히</Link>}>
            <LoadState status={stats.status} onRetry={stats.reload} />
            {last14.length > 0 && (
              <>
                <div
                  className={styles.chart}
                  role="img"
                  aria-label={`최근 14일 일별 QR 인증 방문 수. 가장 많은 날 ${peak ? `${formatDate(peak.date, true)} ${peak.count}건` : ''}, 오늘 ${todayVisits.count}건.`}
                >
                  {last14.map((d, i) => (
                    <div
                      key={d.date}
                      title={`${formatDate(d.date, true)} · ${d.count}건`}
                      className={i === last14.length - 1 ? styles.barToday : styles.bar}
                      style={{ height: `${(d.count / max14) * 100}%` }}
                    />
                  ))}
                </div>
                <div className={styles.chartFoot}>
                  <span>{formatDate(last14[0].date, true)}</span>
                  <span className={styles.todayLabel}>오늘 {todayVisits.count}건</span>
                </div>
              </>
            )}
          </Card>

          <Card title="요청 처리 현황" aside={<Link to="/requests">전체 보기</Link>}>
            <LoadState status={requests.status} errorText="요청 내역을 불러오지 못했어요." onRetry={requests.reload} />
            {requests.data &&
              (recent.length === 0 ? (
                <p className={page.muted}>아직 보낸 요청이 없어요.</p>
              ) : (
                <ul className={styles.list}>
                  {recent.map((r) => (
                    <li key={`${r.kind}:${r.appKind ?? ''}:${r.id}`} className={styles.item}>
                      <span className={styles.itemText}>
                        <span className={styles.itemTitle}>{r.summaryText ?? KIND_LABEL[r.kind]}</span>
                        <span className={styles.muted}>
                          {KIND_LABEL[r.kind]} · {formatDate(r.submittedAt, true)} {r.kind === 'CONDITION' ? '접수' : '신청'}
                        </span>
                      </span>
                      <StatusChip status={r.status} />
                    </li>
                  ))}
                </ul>
              ))}
          </Card>
        </div>
      </div>

      <p className={page.muted}>화면의 수치와 업체명은 시안용 예시입니다.</p>
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} store={store} />
    </div>
  );
}
