import type { InquiryDto } from '@/api/inquiries';
import type { VerificationDto } from '@/api/account';
import type { Account, Term } from '@/types';

// 시안용 예시 데이터 — 문의는 F-WQNA-02 · 03 응답과 같은 모양이에요. 목업도 api/inquiries.ts 의 변환 함수를 거쳐요.
export const MOCK_INQUIRIES: InquiryDto[] = [
  {
    inquiryId: 'Q-0310',
    type: 'QR · 방문 인증',
    title: '매장 QR을 다시 내려받아도 예전 QR이 계속 되나요?',
    content: '프린트한 QR이 찢어져서 새로 뽑으려고 해요.',
    relatedRequest: null,
    status: 'WAITING',
    submittedAt: '2026-10-22T10:00:00+09:00',
    answers: [],
  },
  {
    inquiryId: 'Q-0281',
    type: '이벤트 · 광고',
    title: '이벤트 기간 중에 참여를 그만둘 수 있나요?',
    content: '매장 사정으로 11월 중순부터 참여가 어려울 수 있어요.',
    relatedRequest: { kind: 'EVENT_AD', id: 'EV-0019' },
    status: 'ANSWERED',
    submittedAt: '2026-10-05T14:00:00+09:00',
    answers: [{ content: '참여 승인 뒤에는 그 분기 동안 참여 매장으로 남아요. 운영팀에 사정을 알려 주시면 확인해 드릴게요.', answeredAt: '2026-10-06T09:30:00+09:00' }],
  },
  {
    inquiryId: 'Q-0244',
    type: '가입 · 계정',
    title: '서울숲점도 같은 아이디로 관리할 수 있나요?',
    content: '성수점으로 가입했는데 서울숲점도 운영하고 있어요.',
    relatedRequest: null,
    status: 'ANSWERED',
    submittedAt: '2026-09-18T11:00:00+09:00',
    answers: [{ content: '네, 왼쪽 위 업체 이름을 눌러 ‘업체 추가’로 서울숲점 사업자 정보를 등록하면 돼요.', answeredAt: '2026-09-18T15:00:00+09:00' }],
  },
];

export const MOCK_FAQS: { question: string; answer: string }[] = [
  { question: '입장 조건 변경은 얼마나 걸려요?', answer: '운영자가 근거 자료를 확인한 뒤 반영해요. 보통 1–2일 걸리고, 진행 상황은 요청 처리 현황에서 볼 수 있어요.' },
  { question: 'QR 인증 수가 실제 손님 수와 다른 이유', answer: 'PawFit 앱으로 매장 QR을 찍은 방문만 집계하기 때문이에요. 같은 보호자가 같은 날 여러 번 찍어도 한 번만 세요.' },
  { question: '보완 요청을 받으면 어떻게 하나요?', answer: '요청 처리 현황에서 ‘보완하기’를 누르고, 운영자 메모에 적힌 내용을 고쳐 다시 보내면 돼요.' },
];

export const MOCK_ACCOUNT: Account = {
  name: '[담당자 이름]',
  loginId: 'owner@aacafe.kr',
  phone: '010-****-0000',
  stores: { total: 3, approved: 2, pending: 1 },
};

/** F-WAUTH-11 응답의 verifications[] (최근 제출 순) */
export const MOCK_VERIFICATIONS: VerificationDto[] = [
  {
    verificationId: 'bv_1',
    businessName: 'AA 카페 성수점',
    businessNumber: '1234567890',
    region: '성수',
    // 업종이 생기기 전에 낸 요청이라 category 가 없어요 (수정할 때 고르게 해요)
    category: null,
    address: { zip: '04768', line1: '서울 성동구 [기본 주소]', line2: '1층' },
    licenseFile: { fileName: '사업자등록증.pdf', url: '' },
    status: 'RECEIVED',
    reason: null,
    submittedAt: '2026-10-22T14:20:00+09:00',
    lastSubmittedAt: '2026-10-22T14:20:00+09:00',
    approvedAt: null,
    canEdit: true,
    canResubmit: false,
    canReapply: false,
  },
];

/** 약관 — 코드 · 본문은 [확인 필요]라 예시예요. url 은 웹 안의 약관 화면이에요. */
export const MOCK_TERMS: Term[] = [
  { code: 'BIZ_SERVICE', title: '업체 센터 이용약관', required: true, version: '1.0', url: '/terms/BIZ_SERVICE' },
  { code: 'BIZ_PRIVACY', title: '개인정보 수집 · 이용', required: true, version: '1.0', url: '/terms/BIZ_PRIVACY' },
  { code: 'BIZ_MARKETING', title: '이벤트 · 광고 소식 받기', required: false, version: '1.0', url: '/terms/BIZ_MARKETING' },
];
