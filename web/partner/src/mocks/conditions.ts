import type { PlaceConditionsDto } from '@/api/conditions';
import type { SampleDog } from '@/types';

// 시안용 예시 데이터 — F-WREQ-02 응답과 같은 모양이에요. 목업도 api/conditions.ts 의 변환 함수를 거쳐요.
export const MOCK_CONDITIONS: Record<string, PlaceConditionsDto> = {
  'store-ss-0142': {
    placeId: 'store-ss-0142',
    conditionCheckedAt: '2026-10-08',
    conditionsVersion: 7,
    source: '공식 인스타그램 공지 (09.30)',
    checkMethod: '업체 직접 확인',
    conditions: {
      petAllowed: true,
      weightLimitKg: 7,
      sizeLimit: null,
      restrictedBreeds: null,
      area: 'INDOOR_OK',
      requiredItems: ['STROLLER', 'MANNER_BELT'],
      vaccinationRequired: null,
    },
    unrestrictedFields: ['sizeLimit', 'restrictedBreeds'],
    pendingItems: [
      { field: 'weightLimitKg', requestId: 'REQ-0142', status: 'IN_REVIEW' },
      { field: 'vaccinationRequired', requestId: 'REQ-0131', status: 'NEEDS_INFO' },
    ],
  },
  'store-sf-0087': {
    placeId: 'store-sf-0087',
    conditionCheckedAt: '2026-09-29',
    conditionsVersion: 3,
    source: '공식 홈페이지 (09.20)',
    checkMethod: '온라인 공개 정보',
    conditions: {
      petAllowed: true,
      weightLimitKg: null,
      sizeLimit: null,
      restrictedBreeds: null,
      area: 'INDOOR_OK',
      requiredItems: ['MANNER_BELT'],
      vaccinationRequired: true,
    },
    unrestrictedFields: ['weightLimitKg', 'sizeLimit', 'restrictedBreeds'],
    pendingItems: [],
  },
};

/**
 * 판정 미리보기에 쓰는 테스트 반려견 (실제 보호자 반려견은 쓰지 않아요).
 * TODO: 테스트 반려견 수 · 값은 팀이 정하면 서버(F-WREQ-07)가 내려줘요.
 */
export const SAMPLE_DOGS: SampleDog[] = [
  { id: 'td_1', label: '4kg 말티즈 · 유모차 · 매너벨트 · 접종 확인', weightKg: 4, size: 'SMALL', breed: '말티즈', items: ['STROLLER', 'MANNER_BELT'], vaccinated: true },
  { id: 'td_2', label: '9kg 푸들 · 매너벨트 · 접종 확인', weightKg: 9, size: 'MEDIUM', breed: '푸들', items: ['MANNER_BELT'], vaccinated: true },
  { id: 'td_3', label: '15kg 시바견 · 준비물 없음', weightKg: 15, size: 'MEDIUM', breed: '시바견', items: [], vaccinated: false },
];
