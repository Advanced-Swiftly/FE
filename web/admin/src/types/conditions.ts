/* ───────── 입장 조건 (사용자 앱 place_conditions 와 같은 필드 · 업체 웹과 같은 모양) ───────── */

// TODO: Size · Area · Item 값 목록은 사용자 앱 명세서 값으로 맞춰 주세요.
export type SizeLimit = 'SMALL' | 'MEDIUM' | 'LARGE';
export type AreaRule = 'INDOOR_OK' | 'OUTDOOR_ONLY';
export type Item = 'STROLLER' | 'CARRIER' | 'MANNER_BELT' | 'MUZZLE';

/** 조건 값. null 은 '미확인' (단, unrestrictedFields 에 든 필드는 '제한 없음') */
export interface PlaceConditions {
  petAllowed: boolean | null;
  weightLimitKg: number | null;
  sizeLimit: SizeLimit | null;
  restrictedBreeds: string[] | null;
  area: AreaRule | null;
  requiredItems: Item[] | null;
  vaccinationRequired: boolean | null;
}

export type ConditionField = keyof PlaceConditions;

/** '제한 없음' 으로 둘 수 있는 필드 (명세 5.2절) */
export type UnrestrictableField = 'weightLimitKg' | 'sizeLimit' | 'restrictedBreeds' | 'area' | 'requiredItems';

/** 조건 값 + 제한 없음 필드 목록 */
export interface ConditionState {
  conditions: PlaceConditions;
  unrestrictedFields: UnrestrictableField[];
}

/** 판정 미리보기용 테스트 반려견 */
export interface SampleDog {
  id: string;
  label: string;
  weightKg: number;
  size: SizeLimit;
  breed: string;
  items: Item[];
  vaccinated: boolean;
}

/** 판정 미리보기 한 줄 (F-OREV-05 dogs[]: testDogId · label · before · after) */
export interface VerdictPreview {
  dogId: string;
  label: string;
  before: import('@/constants/status').Judgment;
  after: import('@/constants/status').Judgment;
}
