import { REQUEST_STATUS_LABEL, type RequestStatus } from '@/constants/status';
import styles from './Chip.module.css';

const TONE: Record<RequestStatus, string> = {
  RECEIVED: styles.received,
  IN_REVIEW: styles.review,
  APPROVED: styles.approved,
  REJECTED: styles.rejected,
  NEEDS_INFO: styles.revise,
  CANCELED: styles.canceled,
  CLOSED_NOT_APPROVED: styles.canceled,
};

interface StatusChipProps {
  status: RequestStatus;
  /** 기본 글자 대신 보여줄 문구 (예: '승인 · 진행 중') */
  label?: string;
}

/** 요청 처리 상태 칩: 접수 · 검토 중 · 보완 요청 · 승인 · 반려 · 취소 · 모집 종료 · 미승인 */
export function StatusChip({ status, label }: StatusChipProps) {
  return <span className={`${styles.chip} ${TONE[status]}`}>{label ?? REQUEST_STATUS_LABEL[status]}</span>;
}
