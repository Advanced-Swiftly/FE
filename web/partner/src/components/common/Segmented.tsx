import styles from './Segmented.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 화면에 안 보이는 묶음 이름 (예: '기간') */
  label: string;
  /** segment: 회색 바 안 흰 버튼 / pill: 검정 탭 / outline: 테두리 알약 (운영자) */
  variant?: 'segment' | 'pill' | 'outline';
}

/** 하나만 고르는 탭 버튼 묶음 (기간 · 상태 · 종류) */
export function Segmented<T extends string>({ options, value, onChange, label, variant = 'segment' }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`${styles.group} ${styles[variant]}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={`${styles.item} ${o.value === value ? styles.on : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
