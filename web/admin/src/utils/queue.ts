import type { QueueItem } from '@/types';

/** 정책 · 변경 요청은 정책 검토로, 이벤트 · 광고는 신청 검토로 가요 */
export function queuePath(item: Pick<QueueItem, 'type' | 'id'>) {
  // 이벤트 신청과 광고 신청은 서버 경로가 달라서, 같은 숫자 ID 여도 섞이지 않게 종류를 함께 넘겨요
  if (item.type === 'EVENT' || item.type === 'AD') return `/queue/apply/${encodeURIComponent(item.id)}?type=${item.type}`;
  return `/queue/policy/${encodeURIComponent(item.id)}`;
}
