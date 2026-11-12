import type { ApplyBlockedReason, EligibilityCode, EventPhase, StampRoadEvent } from '@/types';
import { formatDate } from './format';

export const ELIGIBILITY_LABEL: Record<EligibilityCode, string> = {
  REGION: '행사 대상 지역 안의 매장',
  BUSINESS_VERIFIED: '업체 인증 승인',
  QR_ACTIVE: '매장 QR 발급 · 사용 중',
  CONDITION_CHECKED_RECENT: '입장 조건 확인일이 30일 이내',
  QR_PLEDGE: '분기 동안 매장 QR을 보호자가 볼 수 있는 곳에 두기 (신청 때 동의)',
};

export const BLOCKED_LABEL: Record<ApplyBlockedReason, string> = {
  NOT_RECRUITING: '지금은 참여 신청 기간이 아니에요',
  OUT_OF_REGION: '이 매장은 행사 대상 지역 밖에 있어요',
  ALREADY_APPLIED: '이미 이 분기에 신청한 매장이에요',
  ALREADY_PARTICIPATING: '이 분기에 이미 참여 중이에요',
};

/** 신청 · 승인 때 서버 오류 코드 → 화면 문구 (명세 F-WAD-04) */
export const APPLY_ERROR_TEXT: Record<string, string> = {
  RECRUITMENT_NOT_OPEN: '지금은 참여 신청 기간이 아니에요.',
  DUPLICATE_APPLICATION: '이미 이 분기에 신청한 매장이에요.',
  ELIGIBILITY_NOT_MET: '참여 조건을 확인해 주세요.',
  REQUEST_NOT_CANCELLABLE: '지금은 신청을 취소할 수 없어요.',
};

export const PHASE_LABEL: Record<EventPhase, string> = {
  UPCOMING: '모집 예정',
  RECRUITING: '모집 중',
  IN_PROGRESS: '진행 중',
  ENDED: '종료',
};

function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** 배너 칩 문구: 모집 중 · 마감 D-3 / 모집 예정 · 12.25부터 / 참여 중 / 종료 */
export function phaseBadge(ev: { phase: StampRoadEvent['phase']; recruitment?: StampRoadEvent['recruitment']; participating?: boolean }, now: string) {
  if (ev.participating && ev.phase === 'IN_PROGRESS') return '참여 중';
  if (ev.phase === 'RECRUITING' && ev.recruitment?.endAt) {
    // 모집 끝 시각은 '미만'이라 하루 전 날짜까지가 신청 가능일이에요.
    const d = daysBetween(now, ev.recruitment.endAt) - 1;
    return `모집 중 · ${d <= 0 ? '오늘 마감' : `마감 D-${d}`}`;
  }
  if (ev.phase === 'UPCOMING' && ev.recruitment?.startAt) return `모집 예정 · ${formatDate(ev.recruitment.startAt, true)}부터`;
  return PHASE_LABEL[ev.phase];
}

/** 모집 기간 글자 (끝 시각은 미만이라 하루 앞 날짜로 보여 줘요) */
export function recruitmentText(ev: Pick<StampRoadEvent, 'recruitment'>) {
  if (!ev.recruitment.startAt || !ev.recruitment.endAt) return '기간 정보 없음';
  const end = new Date(ev.recruitment.endAt);
  end.setDate(end.getDate() - 1);
  return `${formatDate(ev.recruitment.startAt, true)} – ${formatDate(end, true)}`;
}

export function periodText(p: { startDate: string; endDate: string }) {
  if (!p.startDate || !p.endDate) return '기간 정보 없음';
  return `${formatDate(p.startDate, true)} – ${formatDate(p.endDate, true)}`;
}
