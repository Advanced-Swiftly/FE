import type { DailyVisit } from '@/types';
import { formatDate } from '@/utils/format';
import styles from './StatsPage.module.css';

interface DailyChartProps {
  daily: DailyVisit[];
  isWeekend: (date: string) => boolean;
}

/** 일별 세로 막대 차트 (주말은 진한 색). 막대에 마우스를 올리면 날짜와 건수가 보여요. */
export function DailyChart({ daily, isWeekend }: DailyChartProps) {
  const max = Math.max(...daily.map((d) => d.count), 1);
  const top = Math.ceil(max / 10) * 10;
  const peak = daily.reduce((a, b) => (b.count > a.count ? b : a), daily[0]);
  const low = daily.reduce((a, b) => (b.count < a.count ? b : a), daily[0]);
  // x축 날짜는 5개만
  const ticks = daily.length <= 7 ? daily : [0, 0.25, 0.5, 0.75, 1].map((p) => daily[Math.round(p * (daily.length - 1))]);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartArea}>
        <div aria-hidden="true" className={styles.yAxis}>
          <span>{top}</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>
        <div
          role="img"
          aria-label={`${formatDate(daily[0].date)}부터 ${formatDate(daily[daily.length - 1].date)}까지 일별 QR 인증 방문. 가장 많은 날 ${formatDate(peak.date, true)} ${peak.count}건, 가장 적은 날 ${formatDate(low.date, true)} ${low.count}건.`}
          className={styles.bars}
          style={{ gap: daily.length > 45 ? 1 : 4 }}
        >
          {daily.map((d) => (
            <div
              key={d.date}
              title={`${formatDate(d.date, true)} · ${d.count}건`}
              className={isWeekend(d.date) ? styles.barWeekend : styles.barWeekday}
              style={{ height: `${(d.count / top) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={styles.xAxis}>
        {ticks.map((d) => (
          <span key={d.date}>{formatDate(d.date, true).replace(/^0/, '').replace('.0', '.')}</span>
        ))}
      </div>
    </div>
  );
}
