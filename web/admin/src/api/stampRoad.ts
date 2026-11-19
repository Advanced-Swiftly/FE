import { MOCK_DRAW_RUNS, MOCK_ENTRIES, MOCK_PERIODS, MOCK_PRIZES, MOCK_WINNER_DETAILS } from '@/mocks/stampRoad';
import type { DrawRun, NewWinnerContact, StampEntry, StampPeriod, StampPrize, WinnerContact, WinnerContactDetail } from '@/types';
import { paginate } from '@/hooks/useCursorList';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError, toApiError } from './errors';

// 댕댕로드 추첨 · 당첨 처리 (명세 F-ODRAW-01 ~ 05, 제출본 6.3.2절).
// 분기 목록(F-ODRAW-01)에는 실행 ID 가 없어요. 실행 ID 는 ① 실행 시작 응답 ② 충돌 응답의 details.drawRunId
// ③ 응모 목록(F-ODRAW-03) entries[].drawRunId (결과가 정해진 뒤) 에서만 알아요. ID 를 알려고 실행 POST 를 부르지 않아요.

/** 목업에서 추첨이 끝나기까지 걸리는 시간 */
const MOCK_DRAW_MS = 1500;
const mockRunStartedAt: Record<string, number> = {};

function mockPeriod(p: (typeof MOCK_PERIODS)[number]): StampPeriod {
  const run = MOCK_DRAW_RUNS[p.periodId];
  return {
    ...p,
    entryCount: (MOCK_ENTRIES[p.periodId] ?? []).filter((e) => !e.canceled).length,
    prizeCount: (MOCK_PRIZES[p.periodId] ?? []).length,
    drawStatus: run?.status ?? null,
    publishedAt: run?.publication.publishedAt ?? null,
  };
}

// ─── 백엔드 API 문서 (이벤트 목록 · 상세 · 응모자 · 추첨 · 결과) ───
// 서버 모드에서는 화면의 '분기 ID(periodId)' 자리에 eventId 를, '실행 ID(drawRunId)' 자리에도 eventId 를 써요.
// (이벤트마다 추첨은 한 번이고, 결과는 GET /admin/events/{eventId}/draw-result 로 읽어요)

interface AdminEventDto { eventId: string | number; title?: string | null; year?: number; quarter?: number; status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'DRAWN' | string }
interface AdminEventDetailDto extends AdminEventDto { participatingStores?: number | null; totalEntries?: number | null; prizes?: { prizeId?: string | number; rank?: number; name: string; quantity?: number | null }[] | null }

const PHASE_OF: Record<string, StampPeriod['phase']> = { DRAFT: 'UPCOMING', OPEN: 'OPEN', CLOSED: 'CLOSED', DRAWN: 'CLOSED' };

async function getAdminEvent(eventId: string): Promise<AdminEventDetailDto> {
  const { data } = await apiClient.get<AdminEventDetailDto>(`/admin/events/${encodeURIComponent(eventId)}`);
  return data;
}

function toPeriod(e: AdminEventDto, d: AdminEventDetailDto | null): StampPeriod {
  const id = String(e.eventId);
  return {
    periodId: id,
    name: e.title ?? d?.title ?? (e.year && e.quarter ? `${e.year}년 ${e.quarter}분기 댕댕로드` : `이벤트 ${id}`),
    startDate: '',
    endDate: '',
    entryDeadline: '',
    announceDate: '',
    phase: PHASE_OF[String(e.status)] ?? 'UPCOMING',
    // 응모 수 · 상품 수는 이벤트 상세 값만 써요 (없으면 null 이라 화면이 '–')
    entryCount: typeof d?.totalEntries === 'number' ? d.totalEntries : (null as unknown as number),
    prizeCount: Array.isArray(d?.prizes) ? d.prizes.length : (null as unknown as number),
    drawStatus: e.status === 'DRAWN' ? 'SUCCEEDED' : null,
    publishedAt: null,
  };
}

/** F-ODRAW-01 → 이벤트 목록 조회 GET /admin/events (+ 각 이벤트 상세로 응모 수 · 상품 수) */
export async function getStampPeriods(): Promise<StampPeriod[]> {
  if (USE_MOCK) return mockResponse(MOCK_PERIODS.map(mockPeriod));
  const { data } = await apiClient.get<{ items?: AdminEventDto[] | null }>('/admin/events');
  const items = data?.items ?? [];
  const [details, drawn] = await Promise.all([
    Promise.all(items.map((e) => getAdminEvent(String(e.eventId)).catch(() => null))),
    Promise.all(items.map((e) => isDrawn(String(e.eventId), e.status).catch(() => null))),
  ]);
  return items.map((e, i) => ({ ...toPeriod(e, details[i]), drawStatus: drawn[i] ? 'SUCCEEDED' : null }));
}

// ─── 서버 모드 추첨 상태 ───
// BE 추첨(POST …/draw)은 이벤트 상태를 DRAWN 으로 바꾸지 않고, draw-result 는 추첨 전에도 200 · 빈 목록이에요.
// 그래서 '추첨됨'은 이벤트 상태 DRAWN 이거나 응모 중 ENTERED 가 아닌 것(WON · NOT_SELECTED · CANCELED)이 있을 때로 봐요.
type DrawEntryDto = { drawEntryId: string | number; userId?: string | number; status?: string; stampCount?: number; fulfillmentStatus?: string | null };
type WinnerDto = { drawEntryId: string | number; userId?: string | number; prizeRank?: number | null; prizeName?: string | null; status?: string; fulfillmentStatus?: string | null; trackingNumber?: string | null };
const BE_PAGE_SIZE = 20;

async function drawEntriesPage(eventId: string, pageNo: number, status?: string) {
  const { data } = await apiClient.get<{ items?: DrawEntryDto[] | null }>(`/admin/events/${encodeURIComponent(eventId)}/draw-entries`, { params: { status, page: pageNo } });
  return data?.items ?? [];
}

async function allDrawEntries(eventId: string): Promise<DrawEntryDto[]> {
  const all: DrawEntryDto[] = [];
  for (let pageNo = 1; pageNo <= 100; pageNo += 1) {
    const items = await drawEntriesPage(eventId, pageNo);
    all.push(...items);
    if (items.length < BE_PAGE_SIZE) break;
  }
  return all;
}

/**
 * 이 브라우저에서 확인한 추첨 완료 기록 — POST …/draw 201 응답의 drawnAt · winnerCount, 또는 409 DRAW_ALREADY_EXECUTED.
 * BE 는 추첨해도 이벤트 상태를 바꾸지 않고 결과 조회도 빈 목록일 수 있어서(당첨 0건 · 응모 0건),
 * 응답으로 확인한 사실을 버리지 않고 결과 요약에 써요. (새로고침하면 사라져요)
 */
const drawnKnown = new Map<string, { drawnAt: string | null; winnerCount: number | null }>();

async function isDrawn(eventId: string, status?: string): Promise<boolean> {
  if (status === 'DRAWN' || drawnKnown.has(eventId)) return true;
  const first = await drawEntriesPage(eventId, 1);
  return first.some((x) => x.status && x.status !== 'ENTERED');
}

async function getWinners(eventId: string): Promise<WinnerDto[]> {
  const { data } = await apiClient.get<{ winners?: WinnerDto[] | null }>(`/admin/events/${encodeURIComponent(eventId)}/draw-result`);
  return data?.winners ?? [];
}

/** F-ODRAW-02 분기 상품 (등록 · 수정 방식은 팀 확인 필요 · 명세 원본 44라 화면은 조회만 해요) */
export async function getStampPrizes(periodId: string): Promise<StampPrize[]> {
  if (USE_MOCK) return mockResponse(MOCK_PRIZES[periodId] ?? []);
  // 운영자 이벤트 상세 조회 GET /admin/events/{eventId} 의 경품
  const d = await getAdminEvent(periodId);
  return (d.prizes ?? []).map((z, i) => ({ prizeId: z.prizeId != null ? String(z.prizeId) : `rank-${z.rank ?? i + 1}`, name: z.name, brand: null, imageUrl: null, quantity: z.quantity ?? null }));
}

/** F-ODRAW-03 응모 · 당첨자 목록 한 페이지 (읽기 전용, 탈퇴 취소 응모는 기본 제외). result 로 서버가 걸러요 */
export async function getStampEntryPage(
  periodId: string,
  opts: { result?: StampEntry['result']; includeCanceled: boolean; cursor: string | null; limit?: number },
): Promise<{ items: StampEntry[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 50;
  let dto: { periodId: string; entries: StampEntry[]; nextCursor: string | null };
  if (USE_MOCK) {
    const rows = (MOCK_ENTRIES[periodId] ?? []).filter((e) => (opts.includeCanceled || !e.canceled) && (!opts.result || (!e.canceled && e.result === opts.result)));
    const page = paginate(rows, opts.cursor, limit);
    dto = await mockResponse({ periodId, entries: page.items, nextCursor: page.nextCursor });
  } else {
    // 추첨 응모 목록 — GET /admin/events/{eventId}/draw-entries?status&page → { items: [{ drawEntryId, userId, status, stampCount, fulfillmentStatus }] }
    // 상태: ENTERED(추첨 전) · WON · NOT_SELECTED(미당첨) · CANCELED(당첨 취소). 상품명은 추첨 결과(draw-result)에서 응모 ID 로 붙여요.
    const pageNo = opts.cursor ? Number(opts.cursor) : 1;
    const STATUS: Record<string, string> = { WON: 'WON', NOT_WON: 'NOT_SELECTED', PENDING: 'ENTERED' };
    const [rows, winners] = await Promise.all([drawEntriesPage(periodId, pageNo, opts.result ? STATUS[opts.result] : undefined), getWinners(periodId).catch(() => [] as WinnerDto[])]);
    const prizeOf = new Map(winners.map((w) => [String(w.drawEntryId), w.prizeName ?? null]));
    const entries: StampEntry[] = rows
      .filter((x) => opts.includeCanceled || x.status !== 'CANCELED')
      .map((x) => {
        const id = String(x.drawEntryId);
        const prize = prizeOf.get(id) ?? null;
        const decided = x.status === 'WON' || x.status === 'NOT_SELECTED' || x.status === 'CANCELED';
        return {
          entryId: id,
          userId: x.userId != null ? String(x.userId) : '',
          enteredAt: '',
          result: x.status === 'WON' || x.status === 'CANCELED' ? 'WON' : x.status === 'NOT_SELECTED' ? 'NOT_WON' : 'PENDING',
          canceled: x.status === 'CANCELED',
          ...(x.status === 'CANCELED' ? { canceledKind: 'WIN' as const } : {}),
          canceledAt: null,
          contactPhoneMasked: '',
          hasAddressSnapshot: null,
          awardedPrize: prize ? { prizeId: '', name: prize } : null,
          drawRunId: decided ? periodId : null,
        };
      });
    return { items: entries, nextCursor: rows.length >= BE_PAGE_SIZE ? String(pageNo + 1) : null };
  }
  return { items: dto.entries ?? [], nextCursor: dto.nextCursor };
}

/**
 * 결과가 정해진 분기의 실행 ID 를 응모 목록(F-ODRAW-03 entries[].drawRunId)에서 찾아요.
 * 진행 중 · 실패한 실행이나 응모가 없는 분기는 읽을 수 있는 계약이 없어 null 이에요 (백엔드 확인 사항).
 */
export async function findDrawRunIdFromEntries(periodId: string): Promise<string | null> {
  // 서버 모드: 추첨됐으면 그 이벤트 ID 가 곧 결과 조회 키예요
  if (!USE_MOCK) {
    // 이벤트 상태(DRAWN)도 함께 봐요 — 응모가 없는 이벤트도 추첨 완료로 알아볼 수 있게
    const ev = await getAdminEvent(periodId).catch(() => null);
    return (await isDrawn(periodId, ev?.status)) ? periodId : null;
  }
  const page = await getStampEntryPage(periodId, { includeCanceled: true, cursor: null, limit: 20 });
  return page.items.find((e) => e.drawRunId)?.drawRunId ?? null;
}

/** F-ODRAW-04 추첨 실행 기록 조회 — GET /admin/stamp-road/draws/{drawRunId} */
export async function getDrawRun(drawRunId: string): Promise<DrawRun> {
  if (USE_MOCK) {
    const run = Object.values(MOCK_DRAW_RUNS).find((r) => r?.drawRunId === drawRunId);
    if (!run) throw mockError('NOT_FOUND');
    if (run.status === 'RUNNING' && Date.now() - (mockRunStartedAt[run.periodId] ?? 0) >= MOCK_DRAW_MS) finishMockDraw(run.periodId, run);
    return mockResponse(run, 150);
  }
  const result = await readDrawResult(drawRunId);
  if (!result) throw mockError('NOT_FOUND');
  return result;
}

/** 이벤트 추첨 결과 조회 GET /admin/events/{eventId}/draw-result → { eventId, winners: [...] } (없으면 null) */
async function readDrawResult(eventId: string): Promise<DrawRun | null> {
  try {
    // 결과 · 응모 상태로 요약해요. 실행 시각 · 실행자 · 추첨 대상 수 · 공개 정보는 BE 응답에 없어 null 이에요.
    const [winners, entries, event] = await Promise.all([getWinners(eventId), allDrawEntries(eventId), getAdminEvent(eventId).catch(() => null)]);
    const count = (st: string) => entries.filter((x) => x.status === st).length;
    const known = drawnKnown.get(eventId) ?? null;
    const decided = entries.some((x) => x.status && x.status !== 'ENTERED') || winners.length > 0;
    // 추첨됐다고 볼 근거: 이번에 받은 추첨 응답 · 이벤트 상태 DRAWN · 결과가 정해진 응모. 빈 결과만으로는 완료로 보지 않아요
    if (!known && event?.status !== 'DRAWN' && !decided) return null;
    return {
      drawRunId: eventId,
      periodId: eventId,
      status: 'SUCCEEDED',
      requestedAt: known?.drawnAt ?? '',
      requestedBy: { type: 'OPERATOR', operatorId: null },
      finishedAt: known?.drawnAt ?? null,
      eligibleCount: null,
      // 응모 목록이 비어 있으면 추첨 응답의 당첨 수를 써요 (둘 다 없으면 응모 기준 0)
      wonCount: entries.length === 0 && known?.winnerCount != null ? known.winnerCount : count('WON'),
      notWonCount: count('NOT_SELECTED'),
      canceledDuringRunCount: null,
      canceledWinCount: winners.filter((w) => w.status === 'CANCELED').length,
      failure: null,
      publication: { publishedAt: null, notificationsQueued: 0 },
    };
  } catch (e) {
    const err = toApiError(e);
    // 아직 추첨 전(404 · 409 등 서버가 결과 없음을 알린 경우)은 null, 연결 실패는 그대로 알려요
    if (err.responded && err.status !== null && err.status < 500) return null;
    throw err;
  }
}

/** 같은 이벤트의 추첨 요청이 동시에 두 번 나가지 않게 막아요 (연속 클릭 대비) */
const drawInFlight = new Map<string, Promise<string>>();

/**
 * F-ODRAW-04 추첨 시작 — 202 RUNNING. 시작한 실행의 drawRunId 를 돌려줘요.
 * 멱등 키: 응답을 못 받아 다시 누르면 같은 키(서버가 기존 실행을 돌려줌), 응답을 받은 뒤 새 실행은 새 키.
 * 이미 진행 중 · 완료면 서버가 details.drawRunId 로 기존 실행을 알려 줘요 → 그 ID 를 돌려줘요.
 */
export async function startDraw(periodId: string): Promise<string> {
  if (USE_MOCK) {
    const p = MOCK_PERIODS.find((x) => x.periodId === periodId);
    const run = MOCK_DRAW_RUNS[periodId];
    // 서버와 같은 오류를 내고, 아래 서버 경로와 같은 처리(충돌이면 details.drawRunId)를 거쳐요
    if (!p || p.phase !== 'CLOSED') throw mockError('DRAW_NOT_ALLOWED_YET');
    if (run?.status === 'RUNNING') return existingRunOrThrow(mockError('DRAW_IN_PROGRESS', { drawRunId: run.drawRunId }));
    if (run?.status === 'SUCCEEDED') return existingRunOrThrow(mockError('DRAW_ALREADY_COMPLETED', { drawRunId: run.drawRunId }));
    if (!(MOCK_PRIZES[periodId] ?? []).length) throw mockError('PRIZES_NOT_SET');
    const now = new Date().toISOString();
    mockRunStartedAt[periodId] = Date.now();
    MOCK_DRAW_RUNS[periodId] = {
      drawRunId: `dr_${Date.now() % 1000}`,
      periodId,
      status: 'RUNNING',
      requestedAt: now,
      requestedBy: { type: 'OPERATOR', operatorId: 'admin01' },
      finishedAt: null,
      eligibleCount: null,
      wonCount: null,
      notWonCount: null,
      canceledDuringRunCount: null,
      failure: null,
      publication: { publishedAt: null, notificationsQueued: 0 },
    };
    return mockResponse((MOCK_DRAW_RUNS[periodId] as DrawRun).drawRunId);
  }
  // 이벤트 추첨 실행 POST /admin/events/{eventId}/draw { confirm: true } → 201 { eventId, drawnAt, winnerCount }
  const running = drawInFlight.get(periodId);
  if (running) return running;
  const task = (async () => {
    try {
      // 201 { eventId, drawnAt, winnerCount } — 당첨 0건이어도 성공이에요. 응답 값을 결과 요약에 남겨요
      const { data } = await apiClient.post<{ eventId?: string | number; drawnAt?: string | null; winnerCount?: number | null }>(`/admin/events/${encodeURIComponent(periodId)}/draw`, { confirm: true });
      drawnKnown.set(periodId, { drawnAt: data?.drawnAt ?? null, winnerCount: typeof data?.winnerCount === 'number' ? data.winnerCount : null });
      return periodId;
    } catch (e) {
      const err = toApiError(e);
      // 이미 추첨된 이벤트(409)면 다시 추첨하지 않고 기존 결과를 보여 줘요 (실행 시각 · 당첨 수는 모름)
      if (err.code === 'DRAW_ALREADY_EXECUTED') {
        if (!drawnKnown.has(periodId)) drawnKnown.set(periodId, { drawnAt: null, winnerCount: null });
        return periodId;
      }
      // 응답을 못 받았으면 자동으로 다시 보내지 않아요. 서버가 이미 처리했는지 결과 조회로만 확인해요
      if (!err.responded) {
        const done = await readDrawResult(periodId).catch(() => null);
        if (done) return periodId;
      }
      throw err;
    } finally {
      drawInFlight.delete(periodId);
    }
  })();
  drawInFlight.set(periodId, task);
  return task;
}

/** 충돌 응답(DRAW_IN_PROGRESS · DRAW_ALREADY_COMPLETED)의 details.drawRunId 로 기존 실행을 알려 줘요 */
function existingRunOrThrow(err: ReturnType<typeof toApiError>): string {
  const existing = typeof err.details?.drawRunId === 'string' ? err.details.drawRunId : null;
  if (existing && (err.code === 'DRAW_IN_PROGRESS' || err.code === 'DRAW_ALREADY_COMPLETED')) return existing;
  throw err;
}

/** 목업 추첨 마무리 — 상품 수량만큼 앞에서부터 당첨으로 표시해요 (실제 당첨 방식이 아니에요) */
function finishMockDraw(periodId: string, run: DrawRun) {
  const valid = (MOCK_ENTRIES[periodId] ?? []).filter((e) => !e.canceled);
  const slots = (MOCK_PRIZES[periodId] ?? []).flatMap((z) => Array.from({ length: z.quantity ?? 1 }, () => ({ prizeId: z.prizeId, name: z.name })));
  valid.forEach((e, i) => {
    const prize = i % 3 === 0 ? slots.shift() : undefined;
    e.result = prize ? 'WON' : 'NOT_WON';
    e.awardedPrize = prize ?? null;
    e.drawRunId = run.drawRunId;
  });
  const won = valid.filter((e) => e.result === 'WON').length;
  Object.assign(run, {
    status: 'SUCCEEDED',
    finishedAt: new Date().toISOString(),
    eligibleCount: valid.length,
    wonCount: won,
    notWonCount: valid.length - won,
    canceledDuringRunCount: 0,
  });
}

/** F-ODRAW-05 당첨 연락 조회 — 공개된 당첨 응모만 */
export async function getWinnerContact(periodId: string, entryId: string): Promise<WinnerContactDetail> {
  if (USE_MOCK) {
    const e = (MOCK_ENTRIES[periodId] ?? []).find((x) => x.entryId === entryId);
    if (!e || e.result !== 'WON') throw mockError('ENTRY_NOT_WON');
    if (!MOCK_DRAW_RUNS[periodId]?.publication.publishedAt) throw mockError('RESULT_NOT_PUBLISHED');
    const d = MOCK_WINNER_DETAILS[entryId] ?? { phoneSnapshot: '010-0000-0000', addressSnapshot: null, deliveryInfo: null, contacts: [] };
    MOCK_WINNER_DETAILS[entryId] = d;
    return mockResponse({ entryId, periodId, result: e.result, awardedPrize: e.awardedPrize, ...d }, 200);
  }
  const { data } = await apiClient.get<WinnerContactDetail>(`/admin/stamp-road/entries/${encodeURIComponent(entryId)}/contacts`);
  return data;
}

/** F-ODRAW-05 연락 기록 — 기록만 하고 문자 · 전화를 보내지 않아요 */
export async function addWinnerContact(entryId: string, body: NewWinnerContact): Promise<WinnerContact> {
  if (USE_MOCK) {
    const d = MOCK_WINNER_DETAILS[entryId];
    if (!d) throw mockError('NOT_FOUND');
    const c: WinnerContact = {
      contactId: `ct_${Date.now() % 10000}`,
      entryId,
      ...body,
      recordedBy: { operatorId: 'admin01' },
      recordedAt: new Date().toISOString(),
    };
    d.contacts.push(c);
    return mockResponse(c);
  }
  const { data } = await apiClient.post<WinnerContact>(`/admin/stamp-road/entries/${encodeURIComponent(entryId)}/contacts`, body);
  return data;
}
