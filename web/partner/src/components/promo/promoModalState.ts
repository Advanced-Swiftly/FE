import type { Area } from '@/constants/status';

/** 광고 · 이벤트 팝업 중 지금 열린 것 (한 번에 하나만 열려요) */
export type PromoModalState =
  | { kind: 'event'; eventId: string }
  | { kind: 'applyEvent'; eventId: string }
  | { kind: 'applyAd'; area?: Area }
  | { kind: 'application'; id: string; ids: string[]; appKind?: 'EVENT' | 'AD' }
  | { kind: 'stats'; eventId: string }
  | null;
