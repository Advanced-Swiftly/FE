import { adPeriodWeeks } from '@/utils/promo';
import { MOCK_CONDITIONS } from '@/mocks/conditions';
import { MOCK_APPLICATIONS, MOCK_EVENT_NOW, MOCK_EVENT_STATS, MOCK_EVENTS } from '@/mocks/promo';
import { MOCK_REQUESTS } from '@/mocks/requests';
import { MOCK_STORES } from '@/mocks/stores';
import type {
  AdApplyForm,
  Application,
  ApplyBlockedReason,
  DateRange,
  Eligibility,
  EligibilityCheck,
  EligibilityCode,
  EventApplyForm,
  EventPhase,
  EventStats,
  ParticipatingEvent,
  PromoOverview,
  RecruitingEvent,
  RequestStatus,
  StampRoadEvent,
} from '@/types';
import type { Area } from '@/constants/status';
import { periodText } from '@/utils/promo';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, type RawId } from './ids';

// 명세 F-WAD-01 ~ 09 (제출본 6.1.5절). 서버 응답(DTO) → 화면 타입 변환은 이 파일에서만 해요.
// 목업도 같은 DTO 를 만들어 같은 변환 함수를 거쳐요.

const enc = encodeURIComponent;

// ─── 서버 응답 모양 (DTO) ─────────────────────────────

/** 행사 공통 부분 (F-WAD-02 에서 매장마다 다른 값을 뺀 것) — 목업 데이터 모양 */
export interface EventBaseDto {
  eventId: string;
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  recruitment: { startAt: string; endAt: string };
  regions: Area[];
  description: string | null;
  conditions: EligibilityCode[];
}
interface RecruitingEventDto {
  eventId: string;
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  recruitment: { startAt: string; endAt: string };
  regions: Area[];
  placeInRegion: boolean;
  myApplication: { applicationId: string; status: RequestStatus; displayStatus: RequestStatus } | null;
  canApply: boolean;
}
interface ParticipatingEventDto {
  eventId: string;
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  participationId: string;
  approvedAt: string;
}
interface EventListDto {
  placeId: string;
  serverTime: string;
  recruiting: RecruitingEventDto[];
  participating: ParticipatingEventDto[];
}
interface EventDetailDto extends EventBaseDto {
  regionOptions?: {id:string;name:string}[];
  prizes?: {name:string;quantity:number;rank:number}[];
  applicablePlaces: { placeId: string; name: string }[];
  placeId: string;
  myApplication: { applicationId: string; status: RequestStatus; displayStatus: RequestStatus; rejectReason?: string | null } | null;
  participation: { participationId: string; approvedAt: string } | null;
  canApply: boolean;
  applyBlockedReason: ApplyBlockedReason | null;
}
interface EligibilityDto {
  eventId: string;
  placeId: string;
  baseDate: string;
  recruitmentOpen: boolean;
  existingApplication: { applicationId: string; status: RequestStatus } | null;
  checks: EligibilityCheck[];
  allPassed: boolean;
  canApply: boolean;
}
export interface ApplicationDto {
  applicationId: string;
  type: 'AD' | 'STAMP_ROAD';
  placeId: string;
  placeName: string;
  status: RequestStatus;
  displayStatus?: RequestStatus;
  submittedAt: string;
  ad?: { region: Area; startDate: string; weeks: number | null; endDate: string };
  stampRoad?: {
    eventId: string;
    periodId: string;
    title: string;
    period: DateRange;
    recruitment: { startAt: string; endAt: string };
    intro: string;
    qrPledgeAgreed: boolean;
    eligibilityAtSubmit?: { code: EligibilityCode; passed: boolean }[] | null;
    participation: { participationId: string; approvedAt: string } | null;
  };
  history: { at: string; status: RequestStatus; by: 'BUSINESS' | 'OPERATOR' }[];
  rejectReason: string | null;
  canCancel: boolean;
  canEditPeriod: boolean;
  canReapply?: boolean;
}
/** F-WAD-09 응답 (목업은 placeId · selectedMonth 를 붙여 만들어요) */
export interface EventStatsDto {
  eventId: string;
  periodId: string;
  placeId?: string;
  phase: EventPhase;
  selectedMonth?: string;
  months: EventStats['months'];
}

// ─── 변환 ─────────────────────────────────────────────

const toRecruiting = (d: RecruitingEventDto): RecruitingEvent => ({
  id: d.eventId,
  periodId: d.periodId,
  title: d.title,
  phase: d.phase,
  period: d.period,
  recruitment: d.recruitment,
  regions: d.regions,
  placeInRegion: d.placeInRegion,
  myApplication: d.myApplication,
  canApply: d.canApply,
});
const toParticipating = (d: ParticipatingEventDto): ParticipatingEvent => ({
  id: d.eventId,
  periodId: d.periodId,
  title: d.title,
  phase: d.phase,
  period: d.period,
  participationId: d.participationId,
  approvedAt: d.approvedAt,
});
const toEvent = (d: EventDetailDto): StampRoadEvent => ({
  regionOptions:d.regionOptions, prizes:d.prizes,
  id: d.eventId,
  periodId: d.periodId,
  title: d.title,
  phase: d.phase,
  period: d.period,
  recruitment: d.recruitment,
  regions: d.regions,
  description: d.description,
  conditions: d.conditions,
  applicablePlaces: d.applicablePlaces,
  placeId: d.placeId,
  myApplication: d.myApplication ? { ...d.myApplication, rejectReason: d.myApplication.rejectReason ?? null } : null,
  participation: d.participation,
  canApply: d.canApply,
  applyBlockedReason: d.applyBlockedReason,
});
export const toApplication = (d: ApplicationDto): Application => ({
  id: d.applicationId,
  type: d.type,
  storeId: d.placeId,
  storeName: d.placeName,
  status: d.status,
  displayStatus: d.displayStatus,
  submittedAt: d.submittedAt,
  ad: d.ad,
  stampRoad: d.stampRoad ? { ...d.stampRoad, eligibilityAtSubmit: d.stampRoad.eligibilityAtSubmit ?? [] } : undefined,
  history: d.history,
  rejectReason: d.rejectReason,
  canCancel: d.canCancel,
  canEditPeriod: d.canEditPeriod,
  canReapply: Boolean(d.canReapply),
});
const toStats = (d: EventStatsDto, placeId: string): EventStats => ({
  eventId: d.eventId,
  periodId: d.periodId,
  placeId: d.placeId ?? placeId,
  phase: d.phase,
  selectedMonth: d.selectedMonth ?? d.months.find((m) => m.state === 'IN_PROGRESS')?.month ?? d.months[0]?.month ?? '',
  totals: null,
  months: d.months ?? [],
});

// ─── 목업 서버 (매장마다 다른 값은 그 매장의 신청 내역으로 계산 · 공용 데이터는 바꾸지 않아요) ───

const ACTIVE: RequestStatus[] = ['RECEIVED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED'];

function mockDetail(base: EventBaseDto, placeId: string): EventDetailDto {
  const store = MOCK_STORES.find((s) => s.id === placeId);
  const app = MOCK_APPLICATIONS.find((a) => a.placeId === placeId && a.stampRoad?.eventId === base.eventId && ACTIVE.includes(a.status));
  const placeInRegion = Boolean(store?.area && base.regions.includes(store.area));
  const participation = app?.status === 'APPROVED' ? (app.stampRoad?.participation ?? null) : null;
  const recruiting = base.phase === 'RECRUITING';
  const applyBlockedReason: ApplyBlockedReason | null = participation ? 'ALREADY_PARTICIPATING' : app ? 'ALREADY_APPLIED' : !recruiting ? 'NOT_RECRUITING' : !placeInRegion ? 'OUT_OF_REGION' : null;
  return {
    ...base,
    applicablePlaces: MOCK_STORES.filter((s) => s.verification === 'APPROVED' && s.area && base.regions.includes(s.area)).map((s) => ({ placeId: s.id, name: s.name })),
    placeId,
    myApplication: app ? { applicationId: app.applicationId, status: app.status, displayStatus: app.displayStatus ?? app.status, rejectReason: app.rejectReason } : null,
    participation,
    canApply: applyBlockedReason === null,
    applyBlockedReason,
  };
}

function mockList(placeId: string): EventListDto {
  const details = MOCK_EVENTS.map((e) => mockDetail(e, placeId));
  return {
    placeId,
    serverTime: MOCK_EVENT_NOW,
    recruiting: details
      .filter((d) => d.phase === 'RECRUITING')
      .map((d) => ({
        eventId: d.eventId,
        periodId: d.periodId,
        title: d.title,
        phase: d.phase,
        period: d.period,
        recruitment: d.recruitment,
        regions: d.regions,
        placeInRegion: d.applyBlockedReason !== 'OUT_OF_REGION',
        myApplication: d.myApplication ? { applicationId: d.myApplication.applicationId, status: d.myApplication.status, displayStatus: d.myApplication.displayStatus } : null,
        canApply: d.canApply,
      })),
    participating: details
      .filter((d) => d.participation)
      .map((d) => ({ eventId: d.eventId, periodId: d.periodId, title: d.title, phase: d.phase, period: d.period, participationId: d.participation!.participationId, approvedAt: d.participation!.approvedAt })),
  };
}

// ─── API ──────────────────────────────────────────────

/** F-WAD-01 이벤트 목록 — 모집 중 행사와 이 매장이 참여 중인 행사. 신청 내역은 F-WREQ-01(type=EVENT_AD)로 따로 불러요 */
// ─── 백엔드 API 문서 (현재 이벤트 · 이벤트 상세 · 지역 · 이벤트/광고 신청) ───

let regionCache: Promise<Map<string, string>> | null = null;
/** 지역 목록 조회 — GET /regions → { regions: [{ regionId, name }] } (한 번만 불러 이름을 찾아요) */
export function getRegionNames(): Promise<Map<string, string>> {
  regionCache ??= apiClient
    .get<{ regions?: { regionId: RawId; name: string }[] | null }>('/regions')
    .then((r) => new Map((r.data?.regions ?? []).flatMap((x) => (toId(x.regionId) ? [[toId(x.regionId) as string, x.name] as [string, string]] : []))))
    .catch((e) => {
      regionCache = null;
      throw e;
    });
  return regionCache;
}

const EMPTY_RANGE = { startDate: '', endDate: '' };
const EMPTY_RECRUIT = { startAt: '', endAt: '' };
async function serverOverview(storeId: string): Promise<PromoOverview> {
  const {data}=await apiClient.get<EventListDto>('/business/events',{params:{placeId:storeId}});
  return {placeId:data.placeId,serverTime:data.serverTime,recruiting:(data.recruiting ?? []).map(toRecruiting),participating:(data.participating ?? []).map(toParticipating),eventsUnavailable:null};
}

export async function getPromoOverview(storeId: string): Promise<PromoOverview> {
  if (!USE_MOCK) return serverOverview(storeId);
  const dto = await mockResponse(mockList(storeId));
  return { placeId: dto.placeId, serverTime: dto.serverTime, recruiting: (dto.recruiting ?? []).map(toRecruiting), participating: (dto.participating ?? []).map(toParticipating) };
}

/** F-WAD-02 이벤트 상세 */
export async function getEvent(eventId: string, storeId: string): Promise<StampRoadEvent> {
  let dto: EventDetailDto;
  if (USE_MOCK) {
    const ev = MOCK_EVENTS.find((e) => e.eventId === eventId);
    if (!ev) throw mockError('NOT_FOUND');
    dto = await mockResponse(mockDetail(ev, storeId));
  } else {
    dto=(await apiClient.get<EventDetailDto>(`/business/events/${enc(eventId)}`,{params:{placeId:storeId}})).data;
  }
  return toEvent(dto);
}

/** F-WAD-03 참여 조건 자동 확인 (화면 사전 확인용 — 서버는 신청 · 승인 때 다시 검사해요) */
export async function getEligibility(eventId: string, storeId: string): Promise<Eligibility> {
  let dto: EligibilityDto;
  if (USE_MOCK) {
    const ev = MOCK_EVENTS.find((e) => e.eventId === eventId);
    const store = MOCK_STORES.find((s) => s.id === storeId);
    if (!ev || !store) throw mockError('NOT_FOUND');
    const cond = MOCK_CONDITIONS[storeId];
    const baseDate = MOCK_EVENT_NOW.slice(0, 10);
    // 시안 시각을 12월 말로 옮겨 둔 만큼, 입장 조건 확인일도 그 시각의 12일 전으로 맞춰요
    const checked = cond?.conditionCheckedAt ? new Date(Date.parse(`${baseDate}T00:00:00Z`) - 12 * 86_400_000).toISOString().slice(0, 10) : null;
    const daysSince = checked ? 12 : null;
    const checks: EligibilityCheck[] = [
      { code: 'REGION', passed: Boolean(store.area && ev.regions.includes(store.area)), detail: null },
      { code: 'BUSINESS_VERIFIED', passed: store.verification === 'APPROVED', detail: null },
      { code: 'QR_ACTIVE', passed: Boolean(store.qrId), detail: null },
      {
        code: 'CONDITION_CHECKED_RECENT',
        passed: daysSince !== null && daysSince >= 0 && daysSince <= 30,
        detail: { checkedDate: checked, daysSince, reason: daysSince === null ? 'NO_DATE' : daysSince < 0 ? 'FUTURE_DATE' : daysSince > 30 ? 'OVER_30_DAYS' : undefined },
      },
    ];
    const existing = MOCK_APPLICATIONS.find((a) => a.type === 'STAMP_ROAD' && a.placeId === storeId && a.stampRoad?.eventId === eventId && ACTIVE.includes(a.status));
    const allPassed = checks.every((c) => c.passed);
    const recruitmentOpen = ev.phase === 'RECRUITING';
    dto = await mockResponse({
      eventId,
      placeId: storeId,
      baseDate,
      recruitmentOpen,
      existingApplication: existing ? { applicationId: existing.applicationId, status: existing.status } : null,
      checks,
      allPassed,
      canApply: allPassed && recruitmentOpen && !existing,
    });
  } else {
    dto = (await apiClient.get<EligibilityDto>(`/business/events/${enc(eventId)}/eligibility`, { params: { placeId: storeId } })).data;
  }
  return { ...dto };
}

/** F-WAD-06 신청 내역 상세 */
/** 이벤트 · 광고 신청 상세 응답 (API 문서: 이벤트 { applicationId, status, reviewComment } · 광고 { applicationId, status, creativeUrl }) */
interface MyApplicationDetailDto { canEditPeriod?:boolean; applicationId?: RawId; status?: RequestStatus; reviewComment?: string | null; creativeUrl?: string | null; eventId?: RawId; storeId?: RawId; regionIds?: RawId[] | null; message?: string | null; adType?: string | null; startDate?: string | null; endDate?: string | null }

/** 상세 응답에 없는 값을 신청 목록에서 이어받아요 (이벤트 신청 상세에는 eventId · storeId 가 없어요) */
export interface ApplicationContext {
  eventId?: string | null;
  storeId?: string | null;
}

function fromMyApplication(d: MyApplicationDetailDto, kind: 'EVENT' | 'AD', id: string, context?: ApplicationContext): Application {
  const status = d.status ?? 'RECEIVED';
  return {
    id: toId(d.applicationId) ?? id,
    type: kind === 'AD' ? 'AD' : 'STAMP_ROAD',
    storeId: toId(d.storeId) ?? context?.storeId ?? '',
    storeName: '',
    status,
    submittedAt: '',
    adType: kind === 'AD' ? (d.adType ?? null) : null,
    message: kind === 'AD' ? (d.message ?? null) : null,
    ad: kind === 'AD' && d.startDate && d.endDate ? { region: '' as never, startDate: d.startDate, weeks: adPeriodWeeks(d.startDate, d.endDate), endDate: d.endDate } : undefined,
    stampRoad: kind === 'EVENT' ? { eventId: toId(d.eventId) ?? context?.eventId ?? '', periodId: '', title: '', period: EMPTY_RANGE, recruitment: EMPTY_RECRUIT, intro: d.message ?? '', qrPledgeAgreed: false, eligibilityAtSubmit: [], participation: null } : undefined,
    history: [],
    rejectReason: d.reviewComment ?? null,
    // 취소 가능 여부 필드가 없어 BE 규칙(ApplicationStatus.isCancelable: 접수 · 보완 요청)대로 열어요
    canCancel: status === 'RECEIVED' || status === 'NEEDS_INFO',
    canEditPeriod: d.canEditPeriod === true,
    canReapply: false,
    creativeUrl: d.creativeUrl ?? null,
  };
}

export async function getApplication(id: string, kind?: 'EVENT' | 'AD' | null, context?: ApplicationContext): Promise<Application> {
  if (!USE_MOCK) {
    // 이벤트 신청 상세 · 광고 신청 상세 — 종류를 모르면 짐작하지 않아요
    if (!kind) throw mockError('FIELD_NOT_SUPPORTED', { field: 'kind' });
    const { data } = await apiClient.get<MyApplicationDetailDto>(`/business/${kind === 'AD' ? 'ad' : 'event'}-applications/${enc(id)}`);
    const app = fromMyApplication(data ?? {}, kind, id, context);
    if (kind !== 'EVENT' || !app.stampRoad?.eventId || !app.storeId) return app;
    // 이벤트 이름 · 기간은 신청의 이벤트 ID 와 매장 ID 로 찾아요. 못 찾으면 있는 값만 보여 줘요
    const event = await getEvent(app.stampRoad.eventId, app.storeId).catch(() => null);
    if (!event) return app;
    return {
      ...app,
      canReapply: (app.status === 'REJECTED' || app.status === 'CANCELED') && event.canApply,
      stampRoad: { ...app.stampRoad, periodId: event.periodId, title: event.title, period: event.period, recruitment: event.recruitment },
    };
  }
  let dto: ApplicationDto;
  if (USE_MOCK) {
    const app = MOCK_APPLICATIONS.find((a) => a.applicationId === id && (!kind || (kind === 'AD' ? a.type === 'AD' : a.type === 'STAMP_ROAD')));
    if (!app) throw mockError('NOT_FOUND');
    dto = await mockResponse(app);
  } else {
    dto = (await apiClient.get<ApplicationDto>(`/business/applications/${enc(id)}`)).data;
  }
  return toApplication(dto);
}

/** F-WAD-09 이벤트 통계 (참여 자격이 있는 분기만). month 는 'YYYY-MM', 없으면 서버 기본 월 */
export async function getEventStats(eventId: string, storeId: string, month?: string): Promise<EventStats> {
  if (USE_MOCK) {
    const stats = MOCK_EVENT_STATS[eventId];
    // 이 매장이 참여한 분기만 볼 수 있어요.
    const joined = MOCK_APPLICATIONS.some((a) => a.placeId === storeId && a.stampRoad?.eventId === eventId && a.status === 'APPROVED');
    if (!stats || !joined) throw mockError('NOT_FOUND');
    if (month && !stats.months.some((m) => m.month === month)) throw mockError('VALIDATION_ERROR', { field: 'month' });
    const dto: EventStatsDto = await mockResponse({ ...stats, placeId: storeId, selectedMonth: month ?? stats.months.find((m) => m.state === 'IN_PROGRESS')?.month ?? stats.months[0].month });
    return toStats(dto, storeId);
  }
  // 업체 이벤트 통계 — GET /business/stores/{storeId}/event-stats?eventId → { storeId, eventId, visits, stampAwards, drawConversions }
  // 월별 값은 이 API 에 없어 months 는 비워 두고 총계만 보여 줘요
  const { data } = await apiClient.get<{ eventId?: string | number; visits?: number | null; stampAwards?: number | null; drawConversions?: number | null }>(
    `/business/stores/${enc(storeId)}/event-stats`,
    { params: { eventId } },
  );
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return { eventId, periodId: '', placeId: storeId, phase: 'IN_PROGRESS', selectedMonth: '', totals: { visits: n(data?.visits), stampAwards: n(data?.stampAwards), drawConversions: n(data?.drawConversions) }, months: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  return `${prefix}-${String(50 + MOCK_APPLICATIONS.length).padStart(4, '0')}`;
}

/** F-WAD-04 이벤트 참여 신청 — 본문 { placeId, intro, qrPledgeAgreed } */
export async function applyEvent(form: EventApplyForm): Promise<{ id: string }> {
  const body = { placeId: form.storeId, intro: form.intro.trim(), qrPledgeAgreed: form.qrPledgeAgreed };
  let dto: ApplicationDto;
  if (USE_MOCK) {
    const ev = MOCK_EVENTS.find((e) => e.eventId === form.eventId);
    const store = MOCK_STORES.find((s) => s.id === form.storeId);
    if (!ev || ev.phase !== 'RECRUITING') throw mockError('RECRUITMENT_NOT_OPEN');
    if (body.intro.length > 500) throw mockError('VALIDATION_ERROR');
    const elig = await getEligibility(form.eventId, form.storeId);
    if (elig.existingApplication) throw mockError('DUPLICATE_APPLICATION');
    if (!elig.allPassed) throw mockError('ELIGIBILITY_NOT_MET');
    const id = nextId('EV');
    dto = {
      applicationId: id,
      type: 'STAMP_ROAD',
      placeId: form.storeId,
      placeName: store?.name ?? '',
      status: 'RECEIVED',
      displayStatus: 'RECEIVED',
      submittedAt: nowIso(),
      stampRoad: {
        eventId: ev.eventId,
        periodId: ev.periodId,
        title: ev.title,
        period: ev.period,
        recruitment: ev.recruitment,
        intro: body.intro,
        qrPledgeAgreed: true,
        eligibilityAtSubmit: [...elig.checks.map((c) => ({ code: c.code, passed: c.passed })), { code: 'QR_PLEDGE', passed: true }],
        participation: null,
      },
      history: [{ at: nowIso(), status: 'RECEIVED', by: 'BUSINESS' }],
      rejectReason: null,
      canCancel: true,
      canEditPeriod: false,
      canReapply: false,
    };
    MOCK_APPLICATIONS.unshift(dto);
    MOCK_REQUESTS.unshift({ placeId: form.storeId, type: 'EVENT_AD', appKind: 'EVENT', applicationId: id, status: 'RECEIVED', group: 'IN_PROGRESS', summaryText: `${ev.title} 참여`, submittedAt: dto.submittedAt });
    dto = await mockResponse(dto);
  } else {
    // 이벤트 참여 신청 — POST /business/event-applications { storeId, eventId, regionIds, message? } → { applicationId, status }
    const regionIds = (form.regionIds ?? []).map((x) => (typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x));
    if (regionIds.length === 0) throw mockError('INVALID_REQUEST', { field: 'regionIds' });
    const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);
    const { data } = await apiClient.post<{ applicationId: RawId; status: string }>('/business/event-applications', { storeId: num(form.storeId), eventId: num(form.eventId), regionIds, message: form.intro || undefined });
    void body;
    return { id: toId(data.applicationId) ?? '' };
  }
  return { id: toApplication(dto).id };
}

function endDateOf(startDate: string, weeks: number) {
  const end = new Date(`${startDate}T00:00:00`);
  end.setDate(end.getDate() + weeks * 7 - 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

/** F-WAD-05 지도 추천 노출 광고 신청 — 본문 { placeId, region, startDate, weeks } (판정에는 영향 없어요) */
export async function applyAd(form: AdApplyForm): Promise<{ id: string }> {
  const body = { placeId: form.storeId, region: form.region, startDate: form.startDate, weeks: form.weeks };
  if (USE_MOCK) {
    const store = MOCK_STORES.find((s) => s.id === form.storeId);
    if (!form.region || (store?.area && store.area !== form.region)) throw mockError('VALIDATION_ERROR', { field: 'region' });
    const region = form.region;
    const id = nextId('AD');
    const endDate = endDateOf(form.startDate, form.weeks);
    const submittedAt = nowIso();
    MOCK_APPLICATIONS.unshift({
      applicationId: id,
      type: 'AD',
      placeId: form.storeId,
      placeName: store?.name ?? '',
      status: 'RECEIVED',
      submittedAt,
      ad: { region, startDate: form.startDate, weeks: form.weeks, endDate },
      history: [{ at: submittedAt, status: 'RECEIVED', by: 'BUSINESS' }],
      rejectReason: null,
      canCancel: true,
      canEditPeriod: true,
    });
    MOCK_REQUESTS.unshift({ placeId: form.storeId, type: 'EVENT_AD', appKind: 'AD', applicationId: id, status: 'RECEIVED', group: 'IN_PROGRESS', summaryText: `지도 추천 노출 · ${region} · ${periodText({ startDate: form.startDate, endDate })}`, submittedAt });
    const res = await mockResponse({ applicationId: id, type: 'AD', status: 'RECEIVED', submittedAt, startDate: form.startDate, weeks: form.weeks, endDate });
    return { id: res.applicationId };
  }
  // 광고 신청 — POST /business/ad-applications { storeId, adType, startDate, endDate, creativeUrl(https), message? } → { applicationId, status }
  // BE 에는 노출 지역 · 주 단위가 없어서 끝나는 날을 화면에서 계산해 보내요.
  void body;
  if (!form.adType) throw mockError('INVALID_REQUEST', { field: 'adType' });
  const creativeUrl = (form.creativeUrl ?? '').trim();
  if (!/^https?:\/\/.+/.test(creativeUrl)) throw mockError('INVALID_REQUEST', { field: 'creativeUrl' });
  const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);
  const { data } = await apiClient.post<{ applicationId: RawId; status?: string }>('/business/ad-applications', {
    storeId: num(form.storeId),
    adType: form.adType,
    startDate: form.startDate,
    endDate: endDateOf(form.startDate, form.weeks),
    creativeUrl,
    message: form.message?.trim() || undefined,
  });
  return { id: toId(data.applicationId) ?? '' };
}

/** F-WAD-07 신청 취소 (검토 시작 전 · 참여 신청은 접수 상태에서만) */
export async function cancelApplication(id: string, kind?: 'EVENT' | 'AD' | null): Promise<void> {
  if (!USE_MOCK) {
    // 이벤트 · 광고 신청 취소 — PATCH /business/{event|ad}-applications/{applicationId} { action: 'CANCEL' }
    if (!kind) throw mockError('FIELD_NOT_SUPPORTED', { field: 'kind' });
    await apiClient.patch(`/business/${kind === 'AD' ? 'ad' : 'event'}-applications/${enc(id)}`, { action: 'CANCEL' });
    return;
  }
  if (USE_MOCK) {
    const app = MOCK_APPLICATIONS.find((a) => a.applicationId === id && (!kind || (kind === 'AD' ? a.type === 'AD' : a.type === 'STAMP_ROAD')));
    if (!app || !app.canCancel) throw mockError('REQUEST_NOT_CANCELLABLE');
    Object.assign(app, {
      status: 'CANCELED',
      displayStatus: app.type === 'STAMP_ROAD' ? 'CANCELED' : undefined,
      canCancel: false,
      canEditPeriod: false,
      history: [...app.history, { at: nowIso(), status: 'CANCELED', by: 'BUSINESS' }],
    });
    // 같은 숫자 ID 의 이벤트 · 광고 신청이 있어 목록 줄도 종류 + ID 로 찾아요 (다른 종류 줄을 바꾸지 않아요)
    const appKind = app.type === 'AD' ? 'AD' : 'EVENT';
    const row = MOCK_REQUESTS.find((r) => r.type === 'EVENT_AD' && r.appKind === appKind && r.applicationId === id);
    if (row) Object.assign(row, { status: 'CANCELED', group: 'DONE' });
    await mockResponse(null);
    return;
  }
  await apiClient.post(`/business/applications/${enc(id)}/cancel`);
}

/**
 * F-WAD-08 광고 기간 수정 (검토 시작 전) — 바꾼 값만 { startDate?, weeks? } 보내요.
 * 시작일만 보내면 서버가 기존 일수를 그대로 유지하고, 주 수만 보내면 기존 시작일을 유지해요.
 */
export async function updateAdPeriod(id: string, change: { startDate?: string; weeks?: number }): Promise<Application> {
  let dto: ApplicationDto;
  if (USE_MOCK) {
    const app = MOCK_APPLICATIONS.find((a) => a.applicationId === id && a.type === 'AD');
    if (!app?.ad || !app.canEditPeriod) throw mockError('REQUEST_NOT_EDITABLE');
    const startDate = change.startDate ?? app.ad.startDate;
    const weeks = change.weeks ?? app.ad.weeks ?? 1;
    app.ad = { ...app.ad, startDate, weeks, endDate: endDateOf(startDate, weeks) };
    dto = await mockResponse(app);
  } else {
    dto = (await apiClient.patch<ApplicationDto>(`/business/applications/${enc(id)}`, change)).data;
  }
  return toApplication(dto);
}
