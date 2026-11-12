import { useState } from 'react';
import { applyAd } from '@/api/promo';
import { Button } from '@/components/common/Button';
import { Field, Select, TextInput } from '@/components/common/Field';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { AREAS, type Area } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { formatDate } from '@/utils/format';
import styles from './Promo.module.css';

/** 다음 월요일 (광고는 1주 단위 · 월요일 시작) */
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  defaultArea?: Area;
  onClose: () => void;
  onDone: (applicationId: string) => void;
}

/** UI-W-016 지도 추천 노출 광고 신청 (F-WAD-05) */
export function ApplyAdModal({ defaultArea, onClose, onDone }: Props) {
  const { store: current, stores } = useCurrentStore();
  const approved = stores.filter((s) => s.verification === 'APPROVED');
  const [storeId, setStoreId] = useState(current.id);
  const store = approved.find((s) => s.id === storeId) ?? approved[0];
  // 매장 지역을 모르면 첫 지역을 고르지 않고 비워 둬요. 운영자가 고르게 해요 (서버가 매장 지역과 다시 비교해요).
  const [area, setArea] = useState<Area | ''>(defaultArea ?? store.area ?? '');
  const [startDate, setStartDate] = useState(nextMonday());
  const [weeks, setWeeks] = useState(2);
  // 오늘 0시 (팝업을 연 시점 기준)
  const [today] = useState(() => new Date(new Date().toDateString()).getTime());
  const submit = useAction(applyAd);

  const start = new Date(`${startDate}T00:00:00`);
  const isMonday = start.getDay() === 1;
  const isPast = start.getTime() < today;
  // 매장 지역을 모르면(서버 응답에 없을 때) 서버가 신청 때 다시 확인해요.
  const areaMismatch = store.area !== null && area !== store.area;
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7 - 1);
  const canSubmit = area !== '' && isMonday && !isPast && !areaMismatch && !submit.pending;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const res = await submit.run({ storeId: store.id, region: area, startDate, weeks });
    if (res.ok) onDone(res.data.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="지도 추천 노출"
      kicker="광고 신청 · 1주 단위"
      footer={
        <div className={styles.footerBetween}>
          <span className={styles.muted}>검토 시작 전까지 기간을 바꾸거나 취소할 수 있어요</span>
          <div className={styles.footerButtons}>
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button onClick={onSubmit} disabled={!canSubmit}>
              {submit.pending ? '보내는 중…' : '신청하기'}
            </Button>
          </div>
        </div>
      }
    >
      <p className={styles.lead}>지도 추천 노출 광고 신청이에요. 입장 판정 색상은 광고와 관계없이 그대로예요. 신청만으로는 보호자 지도에 아무것도 바뀌지 않아요.</p>
      <div className={styles.twoCol}>
        <Field label="매장" htmlFor="ad-store">
          <Select
            id="ad-store"
            value={store.id}
            onChange={(e) => {
              setStoreId(e.target.value);
              const s = approved.find((x) => x.id === e.target.value);
              setArea(s?.area ?? '');
            }}
          >
            {approved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="노출 지역" htmlFor="ad-area" message={areaMismatch ? { tone: 'error', text: `매장이 있는 ${store.area} 지역만 신청할 수 있어요` } : null}>
          <Select id="ad-area" value={area} aria-invalid={areaMismatch || area === ''} onChange={(e) => setArea(e.target.value as Area | '')}>
            <option value="" disabled>
              매장이 있는 지역을 골라 주세요
            </option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.twoCol}>
        <Field
          label="시작일 (월요일)"
          htmlFor="ad-start"
          message={!isMonday ? { tone: 'error', text: '월요일을 골라 주세요' } : isPast ? { tone: 'error', text: '지난 날짜는 고를 수 없어요' } : null}
        >
          <TextInput id="ad-start" type="date" value={startDate} aria-invalid={!isMonday || isPast} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="기간" htmlFor="ad-weeks" hint={`${formatDate(start, true)} – ${formatDate(end, true)} (끝나는 날은 서버가 계산해요)`}>
          <Select id="ad-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>
                {w}주
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {/* 비용 · 결제 · 노출 단계는 명세에서 후순위라(1.2절 · WAD-2 · 3) 금액이나 노출 약속을 보여 주지 않아요. */}
      <Notice>신청하면 운영자가 검토해요. 비용 · 결제 · 노출 시작은 아직 정해지지 않아 결과는 신청 내역에서 안내해요.</Notice>
      {submit.error && (
        <Notice tone="danger" role="alert">
          {submit.error}
        </Notice>
      )}
    </Modal>
  );
}
