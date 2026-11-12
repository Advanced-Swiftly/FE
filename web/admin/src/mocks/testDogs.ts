import type { SampleDog } from '@/types/conditions';

/** 판정 미리보기 테스트 반려견 — 업체 웹(F-WREQ-07)과 같은 값 (명세 OR-17 [확인 필요]) */
export const SAMPLE_DOGS: SampleDog[] = [
  { id: 'td_1', label: '4kg 말티즈 · 유모차 · 매너벨트 · 접종 확인', weightKg: 4, size: 'SMALL', breed: '말티즈', items: ['STROLLER', 'MANNER_BELT'], vaccinated: true },
  { id: 'td_2', label: '9kg 푸들 · 매너벨트 · 접종 확인', weightKg: 9, size: 'MEDIUM', breed: '푸들', items: ['MANNER_BELT'], vaccinated: true },
  { id: 'td_3', label: '15kg 시바견 · 준비물 없음', weightKg: 15, size: 'MEDIUM', breed: '시바견', items: [], vaccinated: false },
];
