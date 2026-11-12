/**
 * 비밀번호 규칙 — 사용자 앱과 같아요 (명세 F-WAUTH-05 · 7.6.2 UI-W-002 ③).
 * 8자 이상, 영문 · 특수기호 각 1자 이상, 숫자는 선택.
 */
export function passwordRules(pw: string) {
  return [
    { label: '8자 이상', met: pw.length >= 8, required: true },
    { label: '영문 포함', met: /[a-zA-Z]/.test(pw), required: true },
    { label: '특수기호 포함', met: /[^a-zA-Z0-9\s]/.test(pw), required: true },
    { label: '숫자 (선택)', met: /\d/.test(pw), required: false },
  ];
}

export function isValidPassword(pw: string) {
  return passwordRules(pw).every((r) => !r.required || r.met);
}

export const PASSWORD_HINT = '8자 이상 · 영문과 특수기호 포함 (숫자는 선택)';
