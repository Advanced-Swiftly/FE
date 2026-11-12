import { ApplicationDetailModal } from './ApplicationDetailModal';
import { ApplyAdModal } from './ApplyAdModal';
import { ApplyEventModal } from './ApplyEventModal';
import { EventDetailModal } from './EventDetailModal';
import { EventStatsModal } from './EventStatsModal';
import type { PromoModalState } from './promoModalState';

interface PromoModalsProps {
  modal: PromoModalState;
  onChange: (next: PromoModalState) => void;
  /** 신청 · 취소 뒤 목록을 다시 불러와요 */
  onChanged?: () => void;
}

/** 광고 · 이벤트 관련 팝업을 한곳에서 열고 닫아요. 팝업끼리 이어서 열 수 있어요 (상세 → 신청 등). */
export function PromoModals({ modal, onChange, onChanged }: PromoModalsProps) {
  const close = () => onChange(null);
  if (!modal) return null;

  switch (modal.kind) {
    case 'event':
      return (
        <EventDetailModal
          eventId={modal.eventId}
          onClose={close}
          onApply={() => onChange({ kind: 'applyEvent', eventId: modal.eventId })}
          onStats={() => onChange({ kind: 'stats', eventId: modal.eventId })}
          onApplication={(id) => onChange({ kind: 'application', id, ids: [id], appKind: 'EVENT' })}
        />
      );
    case 'applyEvent':
      return (
        <ApplyEventModal
          eventId={modal.eventId}
          onClose={close}
          onBack={() => onChange({ kind: 'event', eventId: modal.eventId })}
          onDone={(id) => {
            onChanged?.();
            onChange({ kind: 'application', id, ids: [id], appKind: 'EVENT' });
          }}
        />
      );
    case 'applyAd':
      return (
        <ApplyAdModal
          defaultArea={modal.area}
          onClose={close}
          onDone={(id) => {
            onChanged?.();
            onChange({ kind: 'application', id, ids: [id], appKind: 'AD' });
          }}
        />
      );
    case 'application':
      return (
        <ApplicationDetailModal
          key={modal.id}
          id={modal.id}
          ids={modal.ids}
          appKind={modal.appKind ?? null}
          onMove={(id) => onChange({ ...modal, id })}
          onClose={close}
          onChanged={onChanged}
          onOpenStats={(eventId) => onChange({ kind: 'stats', eventId })}
          onReapplyEvent={(eventId) => onChange({ kind: 'applyEvent', eventId })}
          onReapplyAd={(area) => onChange({ kind: 'applyAd', area })}
        />
      );
    case 'stats':
      return <EventStatsModal eventId={modal.eventId} onClose={close} />;
  }
}
