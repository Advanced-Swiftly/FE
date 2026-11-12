/** 날짜 · 경과일은 모두 한국 시간(Asia/Seoul) 기준이에요. 브라우저 시간대와 상관없어요. */
const KST_PARTS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 한국 시간의 연 · 월 · 일 · 시 · 분. '2026-10-20' 처럼 날짜만 온 값은 그 날짜 그대로예요. */
function kstParts(value: string | Date): { y: string; m: string; d: string; hh: string; mi: string } | null {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-');
    return { y, m, d, hh: '00', mi: '00' };
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const p = Object.fromEntries(KST_PARTS.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mi: p.minute };
}

/** 한국 시간 날짜 키 'YYYY-MM-DD' */
export function kstDateKey(value: string | Date): string {
  const p = kstParts(value);
  return p ? `${p.y}-${p.m}-${p.d}` : '';
}

/** '2026-10-20' 같은 날짜를 '2026.10.20'으로 바꿔요. short면 '10.20'. */
export function formatDate(value: string | Date, short = false): string {
  const p = kstParts(value);
  if (!p) return '';
  return short ? `${p.m}.${p.d}` : `${p.y}.${p.m}.${p.d}`;
}

/** 오늘(한국 시간 날짜) 기준 며칠 지났는지 — 자정(KST)이 지나면 하루가 늘어요 */
export function daysSince(value: string | Date, today: string | Date = new Date()): number {
  const a = kstDateKey(value);
  const b = kstDateKey(today);
  if (!a || !b) return 0;
  const toUtc = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** 파일 크기를 '820KB', '1.2MB' 처럼 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 내려받기: 글자나 Blob 을 파일로 저장해요. */
export function downloadFile(content: Blob | string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** '2026-10-01T00:04:00+09:00' 같은 일시를 '2026.10.01 00:04'로 바꿔요. */
export function formatDateTime(value: string | Date): string {
  const p = kstParts(value);
  if (!p) return '';
  return `${p.y}.${p.m}.${p.d} ${p.hh}:${p.mi}`;
}
