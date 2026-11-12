import type { DashboardSummary, PlaceQr, Store } from '@/types';
import { IN_PROGRESS_STATUSES } from '@/constants/status';
import { MOCK_CONDITIONS } from '@/mocks/conditions';
import { MOCK_REQUESTS } from '@/mocks/requests';
import { MOCK_DASHBOARD, MOCK_STORES } from '@/mocks/stores';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { fetchVisitStats } from './stats';
import { mockError } from './errors';
import { toId, type RawId } from './ids';

// 명세 F-WDASH-01 ~ 04 (경로 · 필드 이름은 [제안])

/** 내 관리 업체 목록 조회 (GET /business/stores) 한 줄 */
interface StoreItemDto {
  storeId?: RawId;
  name?: string | null;
  /** 지도 노출 상태 — 승인 대기 · 선택 권한으로 해석하지 않아요 */
  visibility?: string | null;
}

/**
 * 내 관리 업체 목록 — GET /business/stores → { stores: [{ storeId, name, visibility }] }
 * '승인된 업체관리자가 관리하는 업체 목록'이라 모두 고를 수 있는 매장으로 다뤄요.
 * 승인 대기 매장(업체 인증 진행 중)은 이 응답에 없어요 — 출처는 백엔드 확인 사항.
 * ID 가 없는 줄은 고를 수 없어서 빼요.
 */
export async function getMyStores(): Promise<Store[]> {
  if (USE_MOCK) return mockResponse(MOCK_STORES);
  const { data } = await apiClient.get<{ stores?: StoreItemDto[] | null }>('/business/stores');
  return (data?.stores ?? []).flatMap((s) => {
    const id = toId(s.storeId);
    if (!id) return [];
    return [{ id, name: s.name ?? '', area: null, category: null, verification: 'APPROVED' as const, visibility: s.visibility ?? null }];
  });
}

/** F-WDASH-02 대시보드 요약 (이번 달 QR 인증 · 스탬프 · 진행 중 요청 · 조건 확인일) */
export async function getDashboard(placeId: string): Promise<DashboardSummary> {
  if (USE_MOCK) {
    const d = MOCK_DASHBOARD[placeId];
    if (!d) throw mockError('NOT_FOUND');
    // 진행 중 요청 · 조건 확인일은 다른 목업과 맞춰요 (서버에서는 한 응답으로 와요)
    const inProgressRequestCount = MOCK_REQUESTS.filter((r) => r.placeId === placeId && IN_PROGRESS_STATUSES.includes(r.status)).length;
    return mockResponse({ ...d, inProgressRequestCount, conditionCheckedAt: MOCK_CONDITIONS[placeId]?.conditionCheckedAt ?? d.conditionCheckedAt });
  }
  // 관리 업체 상세 조회 (GET /business/stores/{storeId}) + 이번 달 방문 인증 통계로 채워요.
  // 진행 중 요청 수 · 조건 확인일은 두 응답에 없어 null ('–') 이에요.
  const today = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = ymd(new Date(today.getFullYear(), today.getMonth(), 1));
  const [, month] = await Promise.all([
    apiClient.get<{ storeId?: RawId; name?: string; policyVersion?: number; qrStatus?: string }>(`/business/stores/${encodeURIComponent(placeId)}`),
    fetchVisitStats(placeId, from, ymd(today)),
  ]);
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return { placeId, qrVisitCount: n(month.totalVisits), stampCount: n(month.stampAwards), inProgressRequestCount: null, conditionCheckedAt: null };
}

/** 업체 QR 조회 응답 (PawFit_Web_API '업체 QR 조회') */
interface StoreQrDto {
  qrId?: RawId;
  status?: string | null;
  qrImageUrl?: string | null;
}

function toPlaceQr(storeId: string, d: StoreQrDto): PlaceQr {
  const url = typeof d.qrImageUrl === 'string' && d.qrImageUrl.trim() !== '' ? d.qrImageUrl : null;
  return { storeId, qrId: toId(d.qrId), status: d.status ?? null, imageUrl: url };
}

/**
 * 업체 QR 조회 — GET /business/stores/{storeId}/qr → { qrId, status, qrImageUrl }
 * 화면은 qrImageUrl 이미지를 그대로 보여 줘요 (QR 을 새로 그리거나 이미지 API 를 따로 부르지 않아요).
 */
export async function getStoreQr(storeId: string): Promise<PlaceQr> {
  if (USE_MOCK) {
    const s = MOCK_STORES.find((x) => x.id === storeId);
    if (!s || s.verification !== 'APPROVED') throw mockError('NOT_FOUND');
    // 예시 모드만: 서버 대신 예시 토큰으로 QR 이미지(data URL)를 만들어 qrImageUrl 자리에 넣어요
    const { toDataURL } = await import('qrcode');
    const qrImageUrl = s.qrId ? await toDataURL(`pf_qr_mock_${s.qrId}`, { width: 480, margin: 4, errorCorrectionLevel: 'M' }) : null;
    return toPlaceQr(storeId, await mockResponse({ qrId: s.qrId ?? null, status: s.qrId ? 'ACTIVE' : null, qrImageUrl }));
  }
  const { data } = await apiClient.get<StoreQrDto>(`/business/stores/${encodeURIComponent(storeId)}/qr`);
  return toPlaceQr(storeId, data ?? {});
}
