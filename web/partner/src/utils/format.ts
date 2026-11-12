/** '2026-10-20' 같은 날짜를 '2026.10.20'으로 바꿔요. short면 '10.20'. */
export function formatDate(value: string | Date, short = false): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return short ? `${mm}.${dd}` : `${d.getFullYear()}.${mm}.${dd}`;
}

/** ISO 시각을 '10.22 14:20'으로 바꿔요. 날짜 글자가 아니면 그대로 돌려줘요. */
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d, true)} ${hh}:${mi}`;
}

/** 오늘 기준 며칠 지났는지 */
export function daysSince(value: string | Date, today: Date = new Date()): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  const ms = new Date(today).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0);
  return Math.floor(ms / 86_400_000);
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
