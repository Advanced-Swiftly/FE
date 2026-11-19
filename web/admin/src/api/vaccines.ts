import { paginate, type Page } from '@/hooks/useCursorList';
import { MOCK_VACCINES } from '@/mocks/vaccines';
import type { VaccineField, VaccineListItem, VaccineStatus, VaccineSubmission } from '@/types';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId } from './ids';
import { idemKeys } from '@/utils/idempotency';

// 명세 F-OVAC-01 ~ 03 (경로 · 필드 이름은 [제안])
// 증명서 원본 열람은 허가된 운영 업무에서만 해요 (SER-001). 파일 주소는 서버가 짧게 유효한 주소로 줘요.

interface VaccineListDto {
  /** API 문서 recordId (이전 명세 docId) */
  recordId?: string | number;
  docId?: string;
  status: VaccineStatus;
  dogName?: string;
  guardian?: { name: string; phone: string } | null;
  appliedAt?: string;
  resubmitted?: boolean;
  breed?: string;
  weightKg?: number;
  vaccine?: string;
}

const toListItem = (v: VaccineSubmission): VaccineListItem => ({
  id: v.id,
  dogName: v.dogName,
  breed: v.breed,
  weightKg: v.weightKg,
  owner: v.owner,
  vaccine: v.vaccine,
  appliedAt: v.appliedAt,
  resubmitted: v.resubmitted,
  status: v.status,
});

/** F-OVAC-01 증명서 목록 한 페이지 (탭 = status) */
export async function getVaccinePage(status: VaccineStatus, cursor: string | null): Promise<Page<VaccineListItem>> {
  if (USE_MOCK) return mockResponse(paginate(MOCK_VACCINES.filter((v) => v.status === status).map(toListItem), cursor, 20));
  // 예방접종 검토 목록 — GET /admin/vaccination-records?status&page → { items: [{ recordId, dogName, status }] }
  // BE 목록은 검토할 상태(ANALYZED · NEEDS_MANUAL_REVIEW · OPERATOR_REVIEW)만 줘요. status 를 비우면 셋 다 와요 (20건씩, page 1부터).
  // '확인 완료(VERIFIED)' · '재업로드 요청(REJECTED)' 은 목록에서 고를 수 없어 그 탭은 부르지 않아요 (백엔드 확인 사항).
  if (status !== 'OPERATOR_REVIEW') throw mockError('FIELD_NOT_SUPPORTED', { field: 'status' });
  const pageNo = cursor ? Number(cursor) : 1;
  const { data } = await apiClient.get<{ items?: VaccineListDto[] | null }>('/admin/vaccination-records', { params: { page: pageNo } });
  const rows = data?.items ?? [];
  return {
    items: rows
      .map((d) => ({
        id: toId(d.recordId ?? d.docId) ?? '',
        // BE 검토 대기 상태 세 가지(ANALYZED · NEEDS_MANUAL_REVIEW · OPERATOR_REVIEW)는 화면의 '확인 대기' 하나로 봐요
        status: (['ANALYZED', 'NEEDS_MANUAL_REVIEW', 'OPERATOR_REVIEW'].includes(String(d.status)) ? 'OPERATOR_REVIEW' : d.status) as VaccineStatus,
        dogName: d.dogName ?? '',
        owner: d.guardian?.name ?? '',
        appliedAt: d.appliedAt ?? '',
        resubmitted: Boolean(d.resubmitted),
        breed: d.breed ?? '',
        // 목록 응답에 몸무게가 없으면 0 으로 채우지 않아요 (화면은 빈 칸)
        weightKg: (d.weightKg ?? null) as unknown as number,
        vaccine: d.vaccine ?? '',
      }))
      .filter((x) => x.id !== ''),
    nextCursor: rows.length >= 20 ? String(pageNo + 1) : null,
  };
}

type FieldDto = { aiValue: string | string[] | null; value: string | string[] | null; edited: boolean; match: boolean };
interface VaccineDetailDto {
  docId: string;
  status: VaccineStatus;
  appliedAt: string;
  dog: { dogId: string; name: string; breed?: string; weightKg?: number };
  guardian: { name: string; phone: string };
  files: VaccineSubmission['files'];
  fields: Record<VaccineField['key'], FieldDto>;
  result?: string;
}

const FIELD_LABEL: Record<VaccineField['key'], string> = { dogName: '반려견 이름', vaccinatedAt: '접종일', items: '접종 항목', hospital: '동물병원' };
const text = (v: string | string[] | null) => (Array.isArray(v) ? v.join(', ') : v);

/** F-OVAC-02 증명서 상세 (서류 이미지 + 대조 표) */
export async function getVaccineDetail(id: string): Promise<VaccineSubmission> {
  if (USE_MOCK) {
    const v = MOCK_VACCINES.find((x) => x.id === id);
    if (!v) throw mockError('NOT_FOUND');
    return mockResponse(v);
  }
  // 예방접종 검토 상세 — GET /admin/vaccination-records/{recordId} → { recordId, documents: [{ documentId }], items: [{ vaccineCode, confidence }] }
  // 반려견 · 보호자 · 증명서 이미지 주소 · 입력값 대조는 응답 예시에 없어요 (백엔드 확인 사항).
  // AI 추출 항목은 보여 주되, 대조 결과가 없으니 '일치'로 보지 않아 확인 완료는 막혀요 (재제출 요청은 가능).
  const { data } = await apiClient.get<VaccineDetailDto & { recordId?: string | number; documents?: { documentId: string | number }[]; items?: { vaccineCode: string; confidence?: number }[] }>(
    `/admin/vaccination-records/${encodeURIComponent(id)}`,
  );
  if (data.dog && data.fields) {
    const keys: VaccineField['key'][] = ['dogName', 'vaccinatedAt', 'items', 'hospital'];
    return {
      id: toId(data.recordId ?? data.docId) ?? id,
      dogName: data.dog.name,
      breed: data.dog.breed ?? '',
      weightKg: data.dog.weightKg ?? 0,
      owner: data.guardian?.name ?? '',
      vaccine: text(data.fields.items?.value ?? null) ?? '',
      appliedAt: data.appliedAt,
      status: data.status,
      fileName: data.files?.[0] ? `증명서 ${data.files[0].fileId}` : '첨부 없음',
      files: data.files ?? [],
      fields: keys.map((k) => ({ key: k, label: FIELD_LABEL[k], aiValue: text(data.fields[k]?.aiValue ?? null), value: text(data.fields[k]?.value ?? null), edited: Boolean(data.fields[k]?.edited), match: Boolean(data.fields[k]?.match) })),
      result: data.result,
    };
  }
  const codes = (data.items ?? []).map((x) => (typeof x.confidence === 'number' ? `${x.vaccineCode} (AI 신뢰도 ${Math.round(x.confidence * 100)}%)` : x.vaccineCode));
  return {
    id: toId(data.recordId) ?? id,
    dogName: '',
    breed: '',
    weightKg: 0,
    owner: '',
    vaccine: (data.items ?? []).map((x) => x.vaccineCode).join(', '),
    appliedAt: '',
    status: data.status ?? 'OPERATOR_REVIEW',
    fileName: (data.documents ?? []).length ? `증명서 ${(data.documents ?? []).map((d) => d.documentId).join(', ')} (이미지 주소 없음)` : '첨부 없음',
    files: [],
    fields: [{ key: 'items', label: FIELD_LABEL.items, aiValue: codes.length ? codes.join(', ') : null, value: null, edited: false, match: false }],
    result: undefined,
  };
}

/** F-OVAC-03 확인 완료 또는 재제출 요청 → 다음 문서 ID (nextDocId, 없으면 null) */
export async function decideVaccine(id: string, decision: 'VERIFIED' | 'REUPLOAD', reason?: string): Promise<{ nextDocId: string | null }> {
  if (USE_MOCK) {
    const v = MOCK_VACCINES.find((x) => x.id === id);
    if (!v) throw mockError('NOT_FOUND');
    if (v.status !== 'OPERATOR_REVIEW') throw mockError('REQUEST_STATE_CONFLICT');
    const today = new Date().toISOString().slice(5, 10).replace('-', '.');
    v.status = decision;
    v.result = decision === 'VERIFIED' ? `${today} 확인 완료 · 운영팀` : `${today} 재제출 요청 · ${reason}`;
    const next = MOCK_VACCINES.find((x) => x.status === 'OPERATOR_REVIEW');
    const res = await mockResponse({ docId: id, status: decision, reviewedBy: 'u_ops', reviewedAt: new Date().toISOString(), nextDocId: next?.id ?? null });
    return { nextDocId: res.nextDocId };
  }
  const scope = `vaccine:${id}`;
  const key = idemKeys.get(scope, { decision, reason });
  // 예방접종 검토 처리 — PATCH /admin/vaccination-records/{recordId} { action: VERIFY | NEEDS_MORE | REQUEST_REUPLOAD, comment?, items? }
  const body = decision === 'REUPLOAD' ? { action: 'REQUEST_REUPLOAD', comment: reason } : { action: 'VERIFY' };
  const { data } = await apiClient.patch<{ recordId?: string | number; status?: string; nextDocId?: string | number | null }>(
    `/admin/vaccination-records/${encodeURIComponent(id)}`,
    body,
    { headers: { 'Idempotency-Key': key } },
  );
  idemKeys.done(scope);
  // 다음 건 ID 는 응답 예시에 없어요. 오면 쓰고, 없으면 null (임의로 만들지 않아요)
  return { nextDocId: toId(data?.nextDocId ?? null) };
}
