import type { VaccineField, VaccineSubmission } from '@/types';

/** 예시 서류 이미지 (실제 증명서가 아니에요 · 서버 연동 뒤에는 짧게 유효한 주소가 와요) */
function sampleImage(name: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#f7f7f5"/><rect x="40" y="40" width="520" height="720" fill="#fff" stroke="#ccc"/><text x="300" y="130" font-size="34" text-anchor="middle" font-family="sans-serif">예방접종 증명서 (예시)</text><text x="80" y="230" font-size="24" font-family="sans-serif">반려견: ${name}</text><text x="80" y="290" font-size="24" font-family="sans-serif">접종: 종합백신 (DHPPL)</text><text x="80" y="350" font-size="24" font-family="sans-serif">동물병원: [동물병원명]</text><text x="300" y="720" font-size="18" fill="#999" text-anchor="middle" font-family="sans-serif">시안용 예시 이미지</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 대조 항목 4개 (명세 F-OVAC-02 fields) */
function fields(name: string, date: string, items: string, hospital: string, opts: Partial<Record<VaccineField['key'], Partial<VaccineField>>> = {}): VaccineField[] {
  const base: VaccineField[] = [
    { key: 'dogName', label: '반려견 이름', aiValue: name, value: name, edited: false, match: true },
    { key: 'vaccinatedAt', label: '접종일', aiValue: date, value: date, edited: false, match: true },
    { key: 'items', label: '접종 항목', aiValue: items, value: items, edited: false, match: true },
    { key: 'hospital', label: '동물병원', aiValue: hospital, value: hospital, edited: false, match: true },
  ];
  return base.map((f) => ({ ...f, ...(opts[f.key] ?? {}) }));
}

// 시안용 예시 데이터 — '예방접종 증명서 확인' 화면과 같은 내용이에요. 보호자 이름은 가려서 와요.
export const MOCK_VACCINES: VaccineSubmission[] = [
  {
    id: 'CERT-2210',
    dogName: '몽이',
    breed: '말티즈',
    weightKg: 4,
    owner: '김*희',
    vaccine: '종합백신',
    appliedAt: '10.22 09:12',
    status: 'OPERATOR_REVIEW',
    fileName: '접종증명서_몽이.jpg',
    files: [{ fileId: 'f_몽이', kind: 'CERTIFICATE', url: sampleImage('몽이'), urlExpiresAt: null }],
    fields: fields('몽이', '2026.05.10', '종합백신 (DHPPL)', '[동물병원명]', { hospital: { aiValue: null, edited: true, match: false } }),
  },
  {
    id: 'CERT-2211',
    dogName: '콩이',
    breed: '푸들',
    weightKg: 9,
    owner: '이*린',
    vaccine: '광견병',
    appliedAt: '10.22 10:40',
    status: 'OPERATOR_REVIEW',
    fileName: '광견병_콩이.png',
    files: [{ fileId: 'f_콩이', kind: 'CERTIFICATE', url: sampleImage('콩이'), urlExpiresAt: null }],
    fields: fields('콩이', '2026.03.02', '광견병', '[동물병원명]'),
  },
  {
    id: 'CERT-2204',
    dogName: '보리',
    breed: '시바견',
    weightKg: 12,
    owner: '정*윤',
    vaccine: '종합백신',
    appliedAt: '10.21 18:05',
    status: 'OPERATOR_REVIEW',
    fileName: '보리_접종.jpg',
    files: [{ fileId: 'f_보리', kind: 'CERTIFICATE', url: sampleImage('보리'), urlExpiresAt: null }],
    fields: fields('보리', '2025.11.20', '종합백신 (DHPPL)', '[동물병원명]', { vaccinatedAt: { aiValue: '2025.11.02', edited: true, match: false } }),
  },
  {
    id: 'CERT-2198',
    dogName: '두부',
    breed: '비숑',
    weightKg: 10,
    owner: '차*실',
    vaccine: '종합백신',
    appliedAt: '10.20 14:22',
    resubmitted: true,
    status: 'OPERATOR_REVIEW',
    fileName: '두부_종합백신_재제출.jpg',
    files: [{ fileId: 'f_두부', kind: 'CERTIFICATE', url: sampleImage('두부'), urlExpiresAt: null }],
    fields: fields('두부', '2026.07.01', '종합백신 (DHPPL)', '[동물병원명]'),
  },
  {
    id: 'CERT-2180',
    dogName: '초코',
    breed: '닥스훈트',
    weightKg: 6,
    owner: '박*우',
    vaccine: '종합백신',
    appliedAt: '10.18 11:02',
    status: 'VERIFIED',
    result: '10.18 확인 완료 · 운영팀',
    fileName: '초코_접종.jpg',
    files: [{ fileId: 'f_초코', kind: 'CERTIFICATE', url: sampleImage('초코'), urlExpiresAt: null }],
    fields: fields('초코', '2026.02.14', '종합백신 (DHPPL)', '[동물병원명]'),
  },
  {
    id: 'CERT-2175',
    dogName: '두부',
    breed: '비숑',
    weightKg: 10,
    owner: '차*실',
    vaccine: '종합백신',
    appliedAt: '10.17 09:30',
    status: 'REUPLOAD',
    result: '10.17 재제출 요청 · 이미지가 흐려요',
    fileName: '두부_종합백신.jpg',
    files: [{ fileId: 'f_두부', kind: 'CERTIFICATE', url: sampleImage('두부'), urlExpiresAt: null }],
    fields: fields('두부', '2026.07.01', '종합백신 (DHPPL)', '판독 불가', { hospital: { aiValue: null, value: null, match: false } }),
  },
];
