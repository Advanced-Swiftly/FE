const EVENT = 'pawfit:admin-counts';

/** 처리 · 답변 뒤 사이드바 배지 숫자를 다시 불러오게 알려요. */
export function notifyCountsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function onCountsChanged(handler: () => void) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
