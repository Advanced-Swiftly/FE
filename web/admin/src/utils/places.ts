/** 업종 — 명세 F-OPLACE-02 예시 값 (CAFE · RESTAURANT). 다른 값이 오면 그대로 보여 줘요 */
export const CATEGORY_LABEL: Record<string, string> = { CAFE: '카페', RESTAURANT: '식당' };

/** 정보 근거 — 값 목록은 명세 [확인 필요] (원본 20). 화면이 아는 값만 이름을 붙여요 */
export const SOURCE_LABEL: Record<string, { label: string; desc: string }> = {
  ONLINE: { label: '온라인 공개 정보', desc: '홈페이지 · SNS 원문을 AI로 구조화' },
  DIRECT: { label: '업체 직접 확인', desc: '전화 · 방문으로 조건 기록' },
  UNKNOWN: { label: '조건 미확인', desc: '보호자에게 회색 · 문의 권장' },
};

export const sourceLabel = (source: string | null) => (source ? (SOURCE_LABEL[source]?.label ?? source) : '정보 근거 없음');

/**
 * F-OPLACE-10 확인 방법 — 선택지 4개는 기획 확정 (2026.11).
 * 서버 전송 코드는 백엔드와 아직 합의하지 않아서 지금은 화면 글자를 그대로 보내요. 코드가 정해지면 value 만 바꿔 주세요.
 */
export const CHECK_METHODS: { value: string; label: string }[] = [
  { value: '업체 전화 확인', label: '업체 전화 확인' },
  { value: '매장 방문 확인', label: '매장 방문 확인' },
  { value: '공식 홈페이지', label: '공식 홈페이지' },
  { value: '공식 SNS 공지', label: '공식 SNS 공지' },
];
