import { useState } from 'react';
import { addWinnerContact, getWinnerContact } from '@/api/stampRoad';
import { Button } from '@/components/common/Button';
import { Field, Select, TextArea, TextInput } from '@/components/common/Field';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { Tag, type TagTone } from '@/components/common/Tag';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { Address, ContactChannel, ContactOutcome, StampEntry } from '@/types';
import { formatDateTime } from '@/utils/format';
import styles from './DrawPage.module.css';

const CHANNEL_LABEL: Record<ContactChannel, string> = { PHONE_CALL: '전화', SMS: '문자' };
const OUTCOME: Record<ContactOutcome, { label: string; tone: TagTone }> = {
  REACHED: { label: '연락됨', tone: 'green' },
  NO_ANSWER: { label: '받지 않음', tone: 'yellow' },
  WRONG_NUMBER: { label: '번호 오류', tone: 'red' },
  DECLINED: { label: '수령 거절', tone: 'gray' },
};
const MEMO_MAX = 200;

const addressText = (a: Address | null) => (a ? `(${a.zip}) ${a.line1}, ${a.line2}` : '없음');

/** UI-O-013 당첨 연락 기록 (팝업) — 공개된 당첨 응모의 연락 시도를 기록만 해요 (F-ODRAW-05) */
export function ContactModal({ periodId, entry, onClose }: { periodId: string; entry: StampEntry; onClose: () => void }) {
  const detail = useFetch(`winner:${entry.entryId}`, () => getWinnerContact(periodId, entry.entryId));
  const save = useAction(addWinnerContact);
  const [at, setAt] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('PHONE_CALL');
  const [outcome, setOutcome] = useState<ContactOutcome>('REACHED');
  const [memo, setMemo] = useState('');
  const [missingAt, setMissingAt] = useState(false);
  const [saved, setSaved] = useState(false);

  const d = detail.data;

  return (
    <Modal
      open
      onClose={onClose}
      kicker={`당첨 연락 · ${periodId} · ${entry.entryId}`}
      title={entry.awardedPrize?.name ?? '당첨 응모'}
      titleAside={
        <Tag tone="green" shape="pill">
          ✓ 당첨
        </Tag>
      }
      footer={
        <div className={page.actionsBetween}>
          <span />
          <Button variant="dark" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <LoadState status={detail.status} errorText={detail.error?.message} />
      {d && (
        <div className={page.stack}>
          <InfoList
            labelWidth={130}
            rows={[
              { label: '연락처', value: <strong>{d.phoneSnapshot}</strong> },
              { label: '응모 배송지', value: addressText(d.addressSnapshot) },
              {
                label: '따로 받은 배송 정보',
                value: d.deliveryInfo ? `${addressText(d.deliveryInfo.address)} · ${formatDateTime(d.deliveryInfo.collectedAt)}` : '없음',
              },
            ]}
          />
          <Notice tone="info">PawFit에서 문자 · 전화를 보내지 않아요. 직접 연락한 뒤 결과만 기록해 주세요.</Notice>

          <section aria-labelledby="contact-history" className={page.stackSm}>
            <h3 id="contact-history" className={page.subTitle}>
              연락 기록
            </h3>
            {d.contacts.length === 0 ? (
              <p className={page.muted}>아직 연락 기록이 없어요</p>
            ) : (
              <ol className={styles.contacts}>
                {d.contacts.map((c) => (
                  <li key={c.contactId}>
                    <div className={styles.contactHead}>
                      <strong>{formatDateTime(c.attemptedAt)}</strong>
                      <span className={page.muted}>{CHANNEL_LABEL[c.channel]}</span>
                      <Tag tone={OUTCOME[c.outcome].tone} shape="pill">
                        {OUTCOME[c.outcome].label}
                      </Tag>
                      <span className={styles.by}>{c.recordedBy.operatorId}</span>
                    </div>
                    {c.memo && <p>{c.memo}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="contact-form" className={page.stackSm}>
            <h3 id="contact-form" className={page.subTitle}>
              연락 결과 기록
            </h3>
            <div className={styles.formGrid}>
              <Field label="연락한 시각" htmlFor="ct-at" message={missingAt ? { tone: 'error', text: '연락한 시각을 입력해 주세요' } : null}>
                <TextInput
                  id="ct-at"
                  type="datetime-local"
                  value={at}
                  onChange={(e) => {
                    setAt(e.target.value);
                    setMissingAt(false);
                    setSaved(false);
                  }}
                />
              </Field>
              <Field label="수단" htmlFor="ct-channel">
                <Select id="ct-channel" value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)}>
                  {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="결과" htmlFor="ct-outcome">
                <Select id="ct-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as ContactOutcome)}>
                  {Object.entries(OUTCOME).map(([v, o]) => (
                    <option key={v} value={v}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="메모 (선택)" htmlFor="ct-memo" hint={`${memo.length} / ${MEMO_MAX}자`}>
              <TextArea id="ct-memo" rows={3} maxLength={MEMO_MAX} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </Field>
            {save.error && (
              <Notice tone="danger" role="alert">
                {save.error}
              </Notice>
            )}
            {saved && (
              <Notice tone="success" role="status" onClose={() => setSaved(false)}>
                연락 기록을 저장했어요.
              </Notice>
            )}
            <div>
              <Button
                variant="primary"
                disabled={save.pending}
                onClick={async () => {
                  if (!at) {
                    setMissingAt(true);
                    return;
                  }
                  const res = await save.run(entry.entryId, { attemptedAt: `${at}:00+09:00`, channel, outcome, memo: memo.trim() || null });
                  if (res.ok) {
                    setSaved(true);
                    setAt('');
                    setMemo('');
                    detail.reload();
                  }
                }}
              >
                {save.pending ? '저장하는 중…' : '기록 저장'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
