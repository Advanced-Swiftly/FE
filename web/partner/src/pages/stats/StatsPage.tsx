import { useState } from 'react';
import { getVisitStats } from '@/api/stats';
import { BarList } from '@/components/common/BarList';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { StatGrid } from '@/components/common/StatGrid';
import { QrModal } from '@/components/qr/QrModal';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { StatsPeriod } from '@/types';
import { lastDays, todayISO } from '@/utils/date';
import { downloadFile, formatDate } from '@/utils/format';
import { DailyChart } from './DailyChart';
import styles from './StatsPage.module.css';

type Period = StatsPeriod | 'custom';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00`).getDay());

export function StatsPage() {
  const { store } = useCurrentStore();
  const [period, setPeriod] = useState<Period>('30');
  const today = todayISO();
  const [range, setRange] = useState(() => lastDays(14, today));
  const [qrOpen, setQrOpen] = useState(false);

  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to && range.to <= today;
  const query = period === 'custom' ? range : period;
  const key = period === 'custom' ? `${range.from}~${range.to}` : period;
  const stats = useFetch(`stats:${store.id}:${key}`, () => (period === 'custom' && !rangeValid ? Promise.reject(new Error('시작일이 끝 날짜보다 늦거나 오늘 이후예요. 기간을 확인해 주세요.')) : getVisitStats(store.id, query)));
  const s = stats.data;

  const days = s?.daily.length ?? 0;
  const weekend = s?.daily.filter((d) => isWeekend(d.date)) ?? [];
  const weekendAvg = weekend.length ? weekend.reduce((sum, d) => sum + d.count, 0) / weekend.length : 0;
  const byWeekday = WEEKDAYS.map((label, i) => ({
    label,
    value: s?.daily.filter((d) => new Date(`${d.date}T00:00:00`).getDay() === i).reduce((sum, d) => sum + d.count, 0) ?? 0,
    highlight: i === 0 || i === 6,
  }));
  // 월요일부터 보여 줘요
  const weekdayRows = [...byWeekday.slice(1), byWeekday[0]];
  // 0~23시 → 시간대 묶음 (화면 표시용)
  const HOUR_GROUPS = [
    { label: '10시 전', from: 0, to: 10 },
    { label: '10 – 12시', from: 10, to: 12 },
    { label: '12 – 14시', from: 12, to: 14 },
    { label: '14 – 17시', from: 14, to: 17 },
    { label: '17 – 20시', from: 17, to: 20 },
    { label: '20시 이후', from: 20, to: 24 },
  ];
  const hours = s?.byHour ?? [];
  const hourTotal = Math.max(1, hours.reduce((sum, h) => sum + h.count, 0));
  const hourRows = HOUR_GROUPS.map((g) => {
    const count = hours.filter((h) => h.hour >= g.from && h.hour < g.to).reduce((sum, h) => sum + h.count, 0);
    return { label: g.label, value: count, display: `${Math.round((count / hourTotal) * 100)}%` };
  });
  const topHour = Math.max(...hourRows.map((h) => h.value));
  const change = (now: number | null, prev: number | null | undefined) => {
    if (now === null) return { text: '이 지표는 통계 응답에 없어요', tone: 'muted' as const };
    if (prev === null || prev === undefined) return { text: '직전 기간 비교 없음', tone: 'muted' as const };
    if (!prev) return { text: '직전 기간 기록 없음', tone: 'muted' as const };
    const rate = Math.round(((now - prev) / prev) * 100);
    return { text: `직전 ${days}일 ${prev.toLocaleString()} · ${rate >= 0 ? '+' : ''}${rate}%`, tone: rate >= 0 ? ('success' as const) : ('danger' as const) };
  };

  const downloadCsv = () => {
    if (!s) return;
    const lines = ['날짜,요일,QR 인증 방문'];
    s.daily.forEach((d) => lines.push(`${d.date},${WEEKDAYS[new Date(`${d.date}T00:00:00`).getDay()]},${d.count}`));
    // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙여요.
    downloadFile(`﻿${lines.join('\n')}`, `PawFit_QR인증_${store.name.replace(/\s/g, '')}_${s.from}_${s.to}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className={page.stack}>
      <PageHeader
        title="QR 인증 통계"
        description={s ? `${formatDate(s.from)} – ${formatDate(s.to)} · ${days}일` : ' '}
        actions={
          <>
            <Segmented
              label="기간"
              value={period}
              onChange={setPeriod}
              options={[
                { value: '7', label: '7일' },
                { value: '30', label: '30일' },
                { value: '90', label: '90일' },
                { value: 'custom', label: '직접 설정' },
              ]}
            />
            <Button variant="secondary" onClick={downloadCsv} disabled={!s}>
              <Icon name="download" />
              CSV 내려받기
            </Button>
            <Button variant="secondary" onClick={() => setQrOpen(true)}>
              <Icon name="qr" />
              매장 QR
            </Button>
          </>
        }
      />

      {period === 'custom' && (
        <div className={styles.range}>
          <label htmlFor="st-from">시작</label>
          <TextInput id="st-from" type="date" max={range.to} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <span aria-hidden="true">–</span>
          <label htmlFor="st-to">끝</label>
          <TextInput id="st-to" type="date" min={range.from} max={today} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          {!rangeValid && <span className={styles.error}>시작일이 끝 날짜보다 늦어요</span>}
        </div>
      )}

      <Notice>
        이 통계는 <strong>PawFit QR로 인증된 방문</strong>만 집계해요. 전체 실제 방문객 수와 다를 수 있어요. 보호자 개인정보는 표시되지 않아요.
      </Notice>

      <LoadState status={stats.status} errorText={stats.error?.message} onRetry={stats.reload} />
      {s && (
        <>
          <StatGrid label="기간 요약">
            <KpiCard
              label="QR 인증 방문"
              value={s.summary.qrVisitCount ?? '–'}
              unit="건"
              caption={change(s.summary.qrVisitCount, s.previous?.qrVisitCount).text}
              captionTone={change(s.summary.qrVisitCount, s.previous?.qrVisitCount).tone}
            />
            <KpiCard
              label="인증한 보호자"
              value={s.summary.guardianCount ?? '–'}
              unit="명"
              caption={change(s.summary.guardianCount, s.previous?.guardianCount).text}
              captionTone={change(s.summary.guardianCount, s.previous?.guardianCount).tone}
            />
            <KpiCard
              label="하루 평균"
              value={s.summary.dailyAverage !== null ? s.summary.dailyAverage.toFixed(1) : '–'}
              unit="건"
              caption={`주말 평균 ${weekendAvg.toFixed(1)}건${s.previous?.dailyAverage != null ? ` · 직전 기간 ${s.previous.dailyAverage.toFixed(1)}건` : ''}`}
            />
            <KpiCard
              label="댕댕로드 스탬프 적립"
              value={s.summary.stampCount ?? '–'}
              unit="개"
              caption={change(s.summary.stampCount, s.previous?.stampCount).text}
              captionTone={change(s.summary.stampCount, s.previous?.stampCount).tone}
            />
          </StatGrid>

          <Card
            title="일별 QR 인증 방문"
            aside={
              <span className={styles.legend}>
                <span className={styles.swatchWeekday} />
                평일
                <span className={styles.swatchWeekend} />
                주말
              </span>
            }
          >
            {days === 0 ? <p className={page.muted}>이 기간에는 인증 기록이 없어요.</p> : <DailyChart daily={s.daily} isWeekend={isWeekend} />}
          </Card>

          <div className={page.half}>
            <Card title="요일별">
              <BarList items={weekdayRows} />
            </Card>
            <Card title="시간대별">
              {s.byHour ? (
                <BarList labelWidth={84} items={hourRows.map((h) => ({ ...h, highlight: h.value === topHour }))} />
              ) : (
                <p className={page.muted}>시간대별 방문은 통계 응답에 없어요.</p>
              )}
            </Card>
          </div>
          <p className={page.muted}>화면의 수치는 시안용 예시입니다.</p>
        </>
      )}

      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} store={store} />
    </div>
  );
}
