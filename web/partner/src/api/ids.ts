/**
 * 서버 ID → 화면에서 쓰는 문자열 ID.
 * 서버가 숫자(1301)로 주든 문자('REQ-0131', 'p_1')로 주든 같은 요청 · 매장은 같은 문자열이 돼요.
 * 접두사를 떼거나 숫자만 뽑지 않고 받은 값을 그대로 글자로 바꿔요.
 * 값이 없거나 비어 있으면 null — 'undefined' · 'null' 같은 글자 ID 가 생기지 않아요.
 * 화면 비교(===)는 이 함수를 거친 값끼리만 해요. 화면 코드에서 String() 을 따로 붙이지 않아요.
 */
export type RawId = string | number | null | undefined;

export function toId(value: RawId): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * 입장 조건 흐름의 매장 ID. 이전 명세는 placeId, 백엔드 API 문서는 storeId 라서 둘 중 있는 값을 써요.
 * 입장 조건 흐름(현재 매장 · 조건 · 요청)의 응답에서만 써요.
 */
export function toStoreId(d: { placeId?: RawId; storeId?: RawId }): string | null {
  return toId(d.placeId) ?? toId(d.storeId);
}
