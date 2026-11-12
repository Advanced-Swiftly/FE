import { useState } from 'react';
import { getStoreQr } from '@/api/stores';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { useFetch } from '@/hooks/useFetch';
import type { Store } from '@/types';
import { downloadFile } from '@/utils/format';
import styles from './QrModal.module.css';

interface QrModalProps {
  open: boolean;
  onClose: () => void;
  store: Store;
}

/** 파일 이름에 쓸 수 없는 글자를 빼요 */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]/g, '');

/**
 * UI-W-007 매장 QR 팝업 · PNG 내려받기 (업체 QR 조회 GET /business/stores/{storeId}/qr)
 * 서버가 준 qrImageUrl 이미지를 그대로 보여 주고 내려받아요. QR 을 새로 그리지 않아요.
 */
export function QrModal({ open, onClose, store }: QrModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="매장 QR" width={440}>
      {/* 매장이 바뀌면 상태를 새로 시작해서 이전 매장 QR 이 남지 않아요 */}
      {open && <QrBody key={store.id} store={store} />}
    </Modal>
  );
}

function QrBody({ store }: { store: Store }) {
  const qr = useFetch(`qr:${store.id}`, () => getStoreQr(store.id));
  // 이미지가 안 열린 주소 (그 주소일 때만 실패로 봐요 — 다시 불러와 주소가 바뀌면 다시 시도)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // 화면이 바뀐 직후 이전 매장 응답이 남아 있으면 쓰지 않아요
  const data = qr.status === 'success' && qr.data.storeId === store.id ? qr.data : null;
  if (!data) return <LoadState status={qr.status === 'success' ? 'loading' : qr.status} errorText="매장 QR을 불러오지 못했어요." onRetry={qr.reload} />;

  const url = data.imageUrl;
  const broken = url !== null && brokenUrl === url;
  const ready = url !== null && !broken && loadedUrl === url;
  const fileName = `PawFit_QR_${safeName(store.name)}_${data.qrId ?? ''}.png`;

  const download = async () => {
    if (!url || !ready) return;
    setDownloadNote(null);
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      downloadFile(await res.blob(), fileName, 'image/png');
    } catch {
      // 이미지 서버가 내려받기(교차 출처 요청)를 막으면 새 창에서 열어 저장하게 안내해요
      window.open(url, '_blank', 'noopener');
      setDownloadNote('바로 내려받지 못해 새 창에서 QR 이미지를 열었어요. 이미지를 길게 누르거나 오른쪽 클릭해 저장해 주세요.');
    } finally {
      setDownloading(false);
    }
  };

  const notice = !url
    ? data.qrId
      ? 'QR 이미지 주소를 받지 못했어요. 잠시 뒤 다시 열어 보고, 계속 안 보이면 운영팀에 문의해 주세요.'
      : 'QR 발급 전이에요. 운영팀에 문의해 주세요.'
    : broken
      ? 'QR 이미지를 불러오지 못했어요. 다시 불러오거나 잠시 뒤 다시 열어 주세요.'
      : null;

  return (
    <div className={styles.body}>
      <div className={styles.qrBox}>
        {url && !broken ? (
          <img
            key={url}
            src={url}
            alt={`${store.name} 매장 QR 코드`}
            className={styles.canvas}
            onLoad={() => setLoadedUrl(url)}
            onError={() => setBrokenUrl(url)}
          />
        ) : (
          <div className={styles.canvas} role="img" aria-label={url ? 'QR 이미지를 불러오지 못했어요' : 'QR 이미지 없음'}>
            <Icon name="qr" size={48} />
          </div>
        )}
      </div>
      <div className={styles.name}>
        <strong>{store.name}</strong>
        <span>{data.qrId ? `QR ID ${data.qrId} · 이 매장 전용` : 'QR ID 없음'}</span>
      </div>
      {notice && (
        <div role="alert" className={styles.text}>
          <p>{notice}</p>
          {(broken || (!url && data.qrId)) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setBrokenUrl(null);
                qr.reload();
              }}
            >
              다시 불러오기
            </Button>
          )}
        </div>
      )}
      {downloadNote && (
        <p role="status" className={styles.text}>
          {downloadNote}
        </p>
      )}
      <p className={styles.text}>보호자가 이 QR을 찍으면 방문 인증과 댕댕로드 스탬프가 적립돼요. 운영자가 QR을 다시 발급하면 예전 QR은 바로 쓸 수 없어요.</p>
      <Button size="lg" fullWidth onClick={download} disabled={!ready || downloading}>
        <Icon name="download" />
        {downloading ? '내려받는 중…' : 'PNG 내려받기'}
      </Button>
    </div>
  );
}
