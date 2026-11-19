import { USE_MOCK } from '@/api/client';
import { useState } from 'react';
import { decideVaccine, getVaccineDetail, getVaccinePage } from '@/api/vaccines';
import { useCursorList } from '@/hooks/useCursorList';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, Select } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { Tag } from '@/components/common/Tag';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { VaccineStatus, VaccineSubmission } from '@/types';
import { notifyCountsChanged } from '@/utils/counts';
import styles from './VaccinesPage.module.css';

// TODO: 재제출 사유 목록은 운영 · 앱 팀 확인 필요 (명세 원본 40). 자유 입력은 받지 않아요.
const REASONS = ['이미지가 흐려요', '입력 정보와 달라요', '유효 기간이 지났어요', '증명서가 아니에요'];

/** UI-O-005 예방접종 증명서 확인 (F-OVAC-01 ~ 03) */
export function VaccinesPage() {
  const [tab, setTab] = useState<VaccineStatus>('OPERATOR_REVIEW');
  const list = useCursorList(`vaccines:${tab}`, (cursor) => getVaccinePage(tab, cursor));
  /**
   * 고른 문서
   * - auto: 처음 열었을 때 · 탭을 바꿨을 때만 목록 첫 건
   * - id: 사용자가 고른 문서나 서버가 알려 준 다음 문서(nextDocId). 지금 목록에 없어도(다음 페이지) 그 상세를 불러요
   * - none: 처리 뒤 다음 문서가 없을 때. 처리한 문서를 다시 열지 않고 남은 목록만 보여 줘요
   * 목록을 새로 불러와도 고른 문서를 첫 건으로 덮어쓰지 않아요.
   */
  const [selection, setSelection] = useState<{ mode: 'auto' } | { mode: 'id'; id: string } | { mode: 'none' }>({ mode: 'auto' });
  const setSelectedId = (id: string | null) => setSelection(id ? { mode: 'id', id } : { mode: 'auto' });
  const [flash, setFlash] = useState('');

  const items = list.items;
  const selId = selection.mode === 'id' ? selection.id : selection.mode === 'auto' ? (items[0]?.id ?? null) : null;
  const detail = useFetch(`vaccine:${selId ?? 'none'}`, () => (selId ? getVaccineDetail(selId) : Promise.reject(new Error('고른 증명서가 없어요.'))));

  const onDone = (message: string, nextDocId: string | null) => {
    setFlash(message);
    // 처리하면 서버가 알려 준 다음 문서(nextDocId)로 가요. 없으면 아무것도 열지 않아요.
    setSelection(nextDocId ? { mode: 'id', id: nextDocId } : { mode: 'none' });
    list.reload();
    notifyCountsChanged();
  };

  return (
    <div className={page.stack}>
      <PageHeader title="예방접종 증명서 확인" description="보호자가 올린 증명서와 입력 정보를 대조해요. 확인된 정보만 입장 판정에 쓰여요." />
      <Notice tone="info">보호자 이름과 연락처는 가려져 있어요. 증빙은 허가된 운영 업무에서만 열어 보고, 처리하면 보호자에게 결과 알림이 가요. AI 자동 판독 값은 참고용이에요.</Notice>
      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}

      <div className={styles.layout}>
        <Card title="제출 목록" padding="none" className={styles.listCard}>
          <div className={styles.tabs}>
            <Segmented
              variant="outline"
              label="상태"
              value={tab}
              onChange={(t) => {
                setTab(t);
                setSelectedId(null);
              }}
              options={[
                { value: 'OPERATOR_REVIEW', label: '확인 대기' },
                { value: 'VERIFIED', label: '확인 완료' },
                { value: 'REUPLOAD', label: '재제출 요청' },
              ]}
            />
          </div>
          <LoadState status={list.status} errorText={list.error ?? undefined} onRetry={list.reload} />
          {list.status === 'success' &&
            (items.length === 0 ? (
              <p className={styles.empty}>{tab === 'OPERATOR_REVIEW' ? '확인할 증명서가 없어요.' : '아직 없어요.'}</p>
            ) : (
              <ul className={styles.list}>
                {items.map((v) => (
                  <li key={v.id}>
                    <button type="button" aria-current={v.id === selId} className={`${styles.item} ${v.id === selId ? styles.itemOn : ''}`} onClick={() => setSelectedId(v.id)}>
                      <span aria-hidden="true" className={styles.avatar}>
                        {v.dogName.slice(0, 1)}
                      </span>
                      <span className={styles.itemText}>
                        <strong>{[v.dogName, v.breed, v.weightKg ? `${v.weightKg}kg` : ''].filter(Boolean).join(' · ')}</strong>
                        <span>
                          {[v.owner, v.vaccine, v.appliedAt.slice(0, 5)].filter(Boolean).join(' · ')} {v.resubmitted ? '재제출' : '제출'}
                        </span>
                      </span>
                      {v.status === 'OPERATOR_REVIEW' && (
                        <Tag tone={v.resubmitted ? 'yellow' : 'gray'} shape="pill">
                          {v.resubmitted ? '재제출' : '대기'}
                        </Tag>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {list.hasMore && (
            <div className={styles.more}>
              <Button variant="secondary" size="sm" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? '불러오는 중…' : '더 보기'}
              </Button>
            </div>
          )}
        </Card>

        {selId &&
          (detail.status === 'success' ? (
            <Detail
              key={detail.data.id}
              v={detail.data}
              onDone={onDone}
              onReloadFile={detail.reload}
              onNext={() => {
                const others = items.filter((x) => x.id !== selId);
                const i = items.findIndex((x) => x.id === selId);
                const next = i >= 0 ? items[(i + 1) % items.length] : others[0];
                if (next && next.id !== selId) setSelectedId(next.id);
              }}
              hasNext={items.some((x) => x.id !== selId)}
            />
          ) : (
            <Card title="증명서 상세" className={styles.detail}>
              <LoadState status={detail.status} errorText={detail.error?.message} onRetry={detail.reload} />
            </Card>
          ))}
        {!selId && selection.mode === 'none' && list.status === 'success' && (
          <Card title="증명서 상세" className={styles.detail}>
            <p className={page.muted}>{items.length > 0 ? '다음 문서가 없어요. 남은 목록에서 확인할 증명서를 골라 주세요.' : '확인할 증명서를 모두 처리했어요.'}</p>
          </Card>
        )}
      </div>

    </div>
  );
}

function Detail({ v, onDone, onNext, hasNext, onReloadFile }: { v: VaccineSubmission; onDone: (message: string, nextDocId: string | null) => void; onNext: () => void; hasNext: boolean; onReloadFile: () => void }) {
  const [fileIndex, setFileIndex] = useState(0);
  const cert = v.files[fileIndex] ?? v.files[0];
  const [loadedUrls, setLoadedUrls] = useState<string[]>([]);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const fileFailed = Boolean(cert && failedUrls.includes(cert.url));
  const fileReady = Boolean(cert?.url && loadedUrls.includes(cert.url) && !fileFailed);
  const isPdf = cert?.contentType === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(cert?.url ?? '');
  const onFileLoad = () => { if (cert?.url) setLoadedUrls((urls) => urls.includes(cert.url) ? urls : [...urls, cert.url]); };
  const onFileError = () => { if (cert?.url) setFailedUrls((urls) => urls.includes(cert.url) ? urls : [...urls, cert.url]); };
  const preview = (large = false) => isPdf
    ? <iframe key={cert?.url} src={cert?.url} title={`예방접종 증명서 PDF: ${v.dogName}`} className={large ? styles.certPdfLarge : styles.certPdf} onLoad={onFileLoad} onError={onFileError} />
    : <img key={cert?.url} src={cert?.url} alt={`보호자가 올린 예방접종 증명서: ${v.dogName}`} className={large ? styles.certImgLarge : styles.certImg} onLoad={onFileLoad} onError={onFileError} />;
  // 일치 체크는 화면에서만 써요 (저장하지 않음 · 명세 F-OVAC-02). 서버가 준 일치 여부로 시작해요.
  const [matches, setMatches] = useState<boolean[]>(() => v.fields.map((f) => f.match));
  const [decision, setDecision] = useState<'VERIFIED' | 'REUPLOAD'>('VERIFIED');
  const [reason, setReason] = useState('');
  const [zoom, setZoom] = useState(false);
  const decide = useAction(decideVaccine);
  const allMatch = matches.every(Boolean);
  const hasItems = USE_MOCK || Boolean(v.verificationItems?.length);
  const readonly = v.status !== 'OPERATOR_REVIEW';

  const onSubmit = async () => {
    if (decision === 'VERIFIED' && (!allMatch || !fileReady || !hasItems)) return;
    const res = await decide.run(v.id, decision, decision === 'REUPLOAD' ? reason : undefined, v.verificationItems);
    if (res.ok) onDone(decision === 'VERIFIED' ? `${v.dogName}의 예방접종을 ‘확인됨’으로 바꿨어요. 보호자에게 알림이 가요.` : `${v.dogName} 보호자에게 재제출을 요청했어요 (${reason}).`, res.data.nextDocId);
  };

  return (
    <Card title={`${v.dogName} · ${v.vaccine} 증명서`} aside={`기록 ${v.id}${v.appliedAt ? ` · ${v.appliedAt} 제출` : ''}`} className={styles.detail}>
      <div className={styles.detailBody}>
        <div className={styles.certImage}>
          {v.files.length > 1 && <Select aria-label="첨부파일 선택" value={fileIndex} onChange={(e) => setFileIndex(Number(e.target.value))}>
            {v.files.map((file, index) => <option key={file.fileId} value={index}>증명서 {index + 1}{file.contentType === 'application/pdf' ? ' · PDF' : ''}</option>)}
          </Select>}
          {cert?.url ? preview() : <><Icon name="image" size={36} /><span>{cert ? '첨부파일 열람 주소를 불러오지 못했어요.' : '첨부된 증명서가 없어요'}</span></>}
          {fileFailed && <span role="alert">파일을 열지 못했어요. 주소가 만료됐거나 파일을 불러올 수 없어요.</span>}
          {cert?.readError && <span role="alert">{cert.readError}</span>}
          <div className={styles.fileActions}>
            <Button variant="secondary" size="sm" disabled={!cert?.url} onClick={() => setZoom(true)}>크게 보기</Button>
            <Button variant="secondary" size="sm" onClick={onReloadFile}>첨부 다시 불러오기</Button>
            {cert?.url && <a href={cert.url} target="_blank" rel="noopener noreferrer">원본 열기</a>}
          </div>
        </div>
        <div className={styles.compare}>
          <span className={styles.compareTitle}>서류와 입력 정보 대조</span>
          <table className={`${table.table} ${table.compact}`}>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">AI가 읽은 값</th>
                <th scope="col">검토할 값</th>
                <th scope="col">서류 확인</th>
              </tr>
            </thead>
            <tbody>
              {v.fields.map((f, i) => (
                <tr key={f.key} className={!readonly && !matches[i] ? styles.mismatch : undefined}>
                  <td>{f.label}</td>
                  <td className={table.muted}>{f.aiValue ?? '읽지 못함'}</td>
                  <td>
                    {f.value ?? '—'}
                    {f.edited && (
                      <>
                        {' '}
                        <Tag tone="yellow">보호자 수정</Tag>
                      </>
                    )}
                  </td>
                  <td>
                    {readonly ? <span className={table.muted}>처리 완료</span> : <input
                      type="checkbox"
                      className={styles.check}
                      aria-label={`${f.label} 서류 확인`}
                      checked={matches[i]}
                      disabled={readonly}
                      onChange={(e) => setMatches((m) => m.map((x, j) => (j === i ? e.target.checked : x)))}
                    />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className={page.muted}>보호자가 고친 값은 서류와 다시 대조해 주세요.</span>
        </div>
      </div>

      {readonly ? (
        <Notice tone={v.status === 'VERIFIED' ? 'success' : 'warning'}>{v.result}</Notice>
      ) : (
        <>
          <fieldset className={styles.fieldset}>
            <legend>처리</legend>
            <div className={styles.decisions}>
              <Choice type="radio" name="vac-decision" boxed label="확인 완료" checked={decision === 'VERIFIED'} onChange={() => setDecision('VERIFIED')} />
              <Choice type="radio" name="vac-decision" boxed label="재제출 요청" checked={decision === 'REUPLOAD'} onChange={() => setDecision('REUPLOAD')} />
            </div>
            {decision === 'REUPLOAD' && (
              <Field label="재제출 사유 (필수)" htmlFor="vac-reason" message={!reason ? { tone: 'error', text: '사유를 골라 주세요' } : null}>
                <Select id="vac-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={styles.reason}>
                  <option value="">사유 고르기</option>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </Field>
            )}
            <span className={page.muted}>
              {decision === 'VERIFIED'
                ? `확인 완료하면 ${v.dogName}의 예방접종 정보가 ‘확인됨’으로 바뀌고, 보호자에게 알림이 가요.`
                : '보호자에게 고른 사유와 함께 다시 올려 달라는 알림이 가요.'}
            </span>
          </fieldset>
          {decision === 'VERIFIED' && (!fileReady || !hasItems) && <Notice tone="warning">첨부 서류와 유효한 접종 항목을 확인할 수 있어야 확인 완료할 수 있어요.</Notice>}
          {decision === 'VERIFIED' && !allMatch && <Notice tone="warning">일치하지 않는 항목이 있어요. 모든 항목이 맞아야 확인 완료할 수 있어요. 다르면 재제출을 요청하세요.</Notice>}
          {decide.error && (
            <Notice tone="danger" role="alert">
              {decide.error}
            </Notice>
          )}
          <div className={page.actionsBetween}>
            <Button variant="secondary" onClick={onNext} disabled={!hasNext}>
              다음 건 보기
            </Button>
            <Button variant={decision === 'VERIFIED' ? 'success' : 'caution'} disabled={decide.pending || (decision === 'VERIFIED' ? !allMatch || !fileReady || !hasItems : !reason)} onClick={onSubmit}>
              {decision === 'VERIFIED' ? '확인 완료 처리' : '재제출 요청 보내기'}
            </Button>
          </div>
        </>
      )}

      <Modal open={zoom} onClose={() => setZoom(false)} title={v.fileName} kicker={`${v.dogName} · ${v.id}`} width={760}>
        {cert?.url && (
          <div className={`${styles.certImage} ${styles.certLarge}`}>
            {preview(true)}
            <a href={cert.url} target="_blank" rel="noopener noreferrer">
              새 창에서 원본 열기
            </a>
          </div>
        )}
      </Modal>
    </Card>
  );
}
