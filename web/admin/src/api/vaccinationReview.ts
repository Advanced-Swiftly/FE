import type { VaccineStatus, VaccineSubmission } from '@/types';

export interface VaccinationItemDto {
  vaccineCode: string;
  vaccinatedAt: string;
  source: 'AI' | 'GUARDIAN' | 'OPERATOR';
  confidence?: number;
}
export interface VaccinationReviewDto {
  recordId?: string | number;
  dogId?: string | number;
  status?: string;
  dog?: { dogId: string | number; name: string; breed?: string; weightKg?: number } | null;
  documents?: { documentId: string | number; url?: string | null; contentType?: string; urlExpiresAt?: string | null; readError?: string | null }[];
  items?: VaccinationItemDto[];
}
export function reviewStatus(status?: string): VaccineStatus {
  if (status === 'REJECTED') return 'REUPLOAD';
  if (status === 'VERIFIED') return 'VERIFIED';
  return 'OPERATOR_REVIEW';
}

/** Source and date stay paired; missing URLs remain attachments with a retryable error. */
export function mapVaccinationReview(data: VaccinationReviewDto, id: string): VaccineSubmission {
  const all = data.items ?? [];
  const ai = all.filter((i) => i.source === 'AI');
  const guardian = all.filter((i) => i.source === 'GUARDIAN');
  const operator = all.filter((i) => i.source === 'OPERATOR');
  const effective = operator.length ? operator : guardian.length ? guardian : ai;
  const codes = (items: VaccinationItemDto[]) => items.length ? [...new Set(items.map((i) => i.vaccineCode))].join(', ') : null;
  const dates = (items: VaccinationItemDto[]) => items.length ? items.map((i) => `${i.vaccineCode}: ${i.vaccinatedAt}`).join(' · ') : null;
  const files = (data.documents ?? []).map((d) => ({ fileId: String(d.documentId), kind: 'CERTIFICATE' as const, url: d.url ?? '', urlExpiresAt: d.urlExpiresAt ?? null, contentType: d.contentType ?? 'application/octet-stream', readError: d.readError ?? undefined }));
  return {
    id: String(data.recordId ?? id), dogName: data.dog?.name ?? '', breed: data.dog?.breed ?? '', weightKg: data.dog?.weightKg ?? 0,
    owner: '', vaccine: codes(effective) ?? '', appliedAt: '', status: reviewStatus(data.status),
    fileName: files.length ? `증명서 ${files[0].fileId}` : '첨부 없음', files,
    verificationItems: effective.map(({ vaccineCode, vaccinatedAt }) => ({ vaccineCode, vaccinatedAt })),
    fields: [
      { key: 'items', label: '접종 항목', aiValue: codes(ai), value: codes(effective), edited: guardian.length > 0 && codes(guardian) !== codes(ai), match: false },
      { key: 'vaccinatedAt', label: '접종일', aiValue: dates(ai), value: dates(effective), edited: guardian.length > 0 && dates(guardian) !== dates(ai), match: false },
    ],
    result: data.status === 'VERIFIED' ? '운영자가 확인 완료한 접종 기록이에요.' : data.status === 'REJECTED' ? '재제출을 요청한 접종 기록이에요.' : undefined,
  };
}
