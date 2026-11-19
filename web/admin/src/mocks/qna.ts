import type { QnaItem } from '@/types';

/** 예시 첨부 이미지 (실제 사진이 아니에요) */
const SAMPLE_PHOTO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#eef2f6"/><text x="320" y="200" font-size="28" text-anchor="middle" font-family="sans-serif">QR 사진 (예시)</text><text x="320" y="250" font-size="18" fill="#888" text-anchor="middle" font-family="sans-serif">시안용 예시 이미지</text></svg>')}`;

// 시안용 예시 데이터 — 'Q&A' 화면과 같은 내용이에요.
// 보호자 문의는 챗봇에서 전달에 동의한 것만 들어와요 (명세 7.6.1). 일반 챗봇 대화는 들어오지 않아요.
export const MOCK_QNA: QnaItem[] = [
  {
    id: 'QA-0412',
    author: 'GUARDIAN',
    authorName: '콩이 보호자',
    createdAt: '10.22 11:05',
    context: '챗봇에서 전달 · 체중 조건이 미확인이에요',
    title: null,
    body: 'BB 베이커리가 회색으로 나와요. 주말에 콩이(9kg)랑 가 보려고 하는데 중형견도 들어갈 수 있는지 확인해 주실 수 있나요?',
    attachments: [],
    relatedStore: { id: 'store-bb', name: 'BB 베이커리', area: '건대', note: '조건 미확인 · AI 후보 검토 대기 1건', queueId: 'POL-0311', queueType: 'AI_POLICY' },
  },
  {
    id: 'QA-0411',
    author: 'BUSINESS',
    authorName: 'AA 카페 성수점',
    createdAt: '10.22 10:20',
    context: '업체 센터 문의하기 · QR · 방문 인증',
    title: '매장 QR을 다시 내려받아도 예전 QR이 계속 되나요?',
    body: '프린트한 QR이 찢어져서 새로 뽑으려고 해요. 새로 내려받으면 예전 QR은 못 쓰게 되나요?',
    attachments: [{ name: 'qr_사진.jpg', url: SAMPLE_PHOTO }],
    relatedStore: { id: 'store-ss-0142', name: 'AA 카페 성수점', area: '성수', note: 'QR PF-SS-0142 사용 중' },
  },
  {
    id: 'QA-0409',
    author: 'BUSINESS',
    authorName: 'DD 펫카페',
    createdAt: '10.21 18:44',
    context: '업체 센터 문의하기 · 입장 조건',
    title: '변경 요청 처리는 보통 얼마나 걸리나요?',
    body: '입마개 조건을 빼 달라고 요청했는데 언제쯤 반영될까요?',
    attachments: [],
    relatedStore: { id: 'store-dd', name: 'DD 펫카페', area: '성수', note: '변경 요청 검토 대기 1건', queueId: 'REQ-0139', queueType: 'STORE_CHANGE' },
    relatedRequest: { kind: 'CONDITION', id: 'REQ-0139' },
  },
  {
    id: 'QA-0398',
    author: 'GUARDIAN',
    authorName: '두부 보호자',
    createdAt: '10.20 09:10',
    context: '챗봇에서 전달',
    title: null,
    body: '예방접종 증명서 재제출 요청을 받았는데 어디서 다시 올리면 되나요?',
    attachments: [],
    answer: {
      body: '마이 › 반려견 정보 › 예방접종에서 ‘다시 올리기’를 누르면 돼요. 접종일과 병원 이름이 잘 보이게 찍어 주세요.',
      answeredAt: '10.20 13:02',
    },
  },
];

/** 자주 쓰는 답변 (운영자 전용 · 웹 고정 / 서버 제공은 팀 확인 필요) */
export const ANSWER_TEMPLATES = [
  {
    label: '조건 확인 중 안내',
    body: '안녕하세요, PawFit 운영팀이에요. 이 업체는 지금 공개된 정보를 바탕으로 조건을 확인하고 있어요. 확인이 끝나면 지도에 바로 반영돼요. 그 전에 방문하신다면 매장에 조건을 한 번 물어봐 주세요.',
  },
  {
    label: '보완 자료 다시 올리기',
    body: '안녕하세요, PawFit 운영팀이에요. 요청 처리 현황에서 해당 요청의 [보완하기]를 눌러 근거 자료를 다시 올려 주세요.',
  },
  {
    label: '변경 요청 처리 기간',
    body: '안녕하세요, PawFit 운영팀이에요. 입장 조건 변경 요청은 근거 자료를 확인한 뒤 보통 1–2일 안에 처리돼요. 결과는 업체 센터 요청 처리 현황에서 확인할 수 있어요.',
  },
  {
    label: '증명서 재제출 방법',
    body: '안녕하세요, PawFit 운영팀이에요. 마이 › 반려견 정보 › 예방접종에서 ‘다시 올리기’를 누르면 돼요. 접종일과 병원 이름이 잘 보이게 찍어 주세요.',
  },
];
