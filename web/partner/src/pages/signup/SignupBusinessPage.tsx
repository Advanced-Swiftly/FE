import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createVerification, getTerms, getVerifications, lookupBusiness, updateVerification, type BusinessFields } from '@/api/account';
import { Button, ButtonLink } from '@/components/common/Button';
import { Choice, Field, InputRow, Select, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { Notice } from '@/components/common/Notice';
import { AREAS } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import { LoadState } from '@/components/common/LoadState';
import { BUSINESS_CATEGORY_LABEL, type BusinessCategory, type SignupStatus, type Term } from '@/types';
import { formatFileSize } from '@/utils/format';
import { SignupSteps } from './SignupSteps';
import styles from './Signup.module.css';

const ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

type Mode = 'new' | 'edit' | 'resubmit' | 'reapply';
/** 화면 모드별로 서버가 허용해야 하는 플래그 (F-WAUTH-11) */
const NEEDS: Record<Exclude<Mode, 'new'>, { flag: 'canEdit' | 'canResubmit' | 'canReapply'; blocked: string }> = {
  edit: { flag: 'canEdit', blocked: '운영자가 확인을 시작해서 지금은 고칠 수 없어요.' },
  resubmit: { flag: 'canResubmit', blocked: '지금은 보완해서 다시 낼 수 없어요. 승인 대기 화면에서 상태를 확인해 주세요.' },
  reapply: { flag: 'canReapply', blocked: '이 요청으로는 다시 신청할 수 없어요. 승인 대기 화면에서 상태를 확인해 주세요.' },
};

/**
 * UI-W-003 가입 2단계 · 업체 인증 (F-WAUTH-01 · 09 · 10 · 12)
 * ?mode=edit&id= 접수 상태 수정 · ?mode=resubmit&id= 보완 제출 (둘 다 PATCH, 바뀐 필드만)
 * ?mode=reapply&id= 반려 뒤 다시 신청 (새 요청 POST, 이전 값을 채워 둠)
 * 버튼뿐 아니라 주소로 바로 들어와도 서버가 준 canEdit · canResubmit · canReapply 를 확인해요.
 */
export function SignupBusinessPage() {
  const [params] = useSearchParams();
  const raw = params.get('mode');
  const mode: Mode = raw === 'edit' || raw === 'resubmit' || raw === 'reapply' ? raw : 'new';
  const id = params.get('id');
  const list = useFetch(`verifications:${mode}:${id ?? ''}`, () => (mode === 'new' ? Promise.resolve([]) : getVerifications()));
  const terms = useFetch('terms', getTerms);

  if (mode !== 'new') {
    if (list.status !== 'success') return <LoadState status={list.status} errorText={list.error?.message} onRetry={list.reload} />;
    const current = id ? list.data.find((v) => v.verificationId === id) : undefined;
    if (!current) return <Notice tone="warning">고칠 업체 인증 요청을 찾지 못했어요. 승인 대기 화면에서 다시 골라 주세요.</Notice>;
    if (!current[NEEDS[mode].flag]) return <Notice tone="warning">{NEEDS[mode].blocked}</Notice>;
    if (mode === 'reapply' && terms.status !== 'success') return <LoadState status={terms.status} onRetry={terms.reload} />;
    return <BusinessForm key={`${mode}:${current.verificationId}`} mode={mode} current={current} terms={terms.data ?? []} />;
  }
  if (terms.status !== 'success') return <LoadState status={terms.status} errorText="약관을 불러오지 못했어요." onRetry={terms.reload} />;
  return <BusinessForm key="new" mode="new" current={null} terms={terms.data} />;
}

function BusinessForm({ mode, current, terms }: { mode: Mode; current: SignupStatus | null; terms: Term[] }) {
  const navigate = useNavigate();
  const patching = mode === 'edit' || mode === 'resubmit';
  const fileInput = useRef<HTMLInputElement>(null);
  const initial: BusinessFields = current
    ? { bizNo: current.form.bizNo, name: current.form.name, area: current.form.area, category: current.form.category, address: { zip: current.form.zip, line1: current.form.line1, line2: current.form.line2 } }
    : { bizNo: '', name: '', area: AREAS[0], category: '', address: { zip: '', line1: '', line2: '' } };
  const [before] = useState(initial);
  const [bizNo, setBizNo] = useState(initial.bizNo);
  const [bizResult, setBizResult] = useState<{ valid: boolean; message: string } | null>(current ? { valid: true, message: '이전에 확인한 사업자번호예요' } : null);
  const [form, setForm] = useState({ name: initial.name, area: initial.area, category: initial.category as BusinessCategory | '', zip: initial.address.zip, line1: initial.address.line1, line2: initial.address.line2 });
  const [cert, setCert] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [addressHint, setAddressHint] = useState(false);
  const [agree, setAgree] = useState<Record<string, boolean>>({});

  const lookup = useAction(lookupBusiness);
  const create = useAction(createVerification);
  const update = useAction(updateVerification);
  const submit = patching ? update : create;

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setFileError('JPG, PNG, PDF 파일만 올릴 수 있어요.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileError('10MB 이하 파일만 올릴 수 있어요.');
      return;
    }
    setFileError('');
    setCert(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const onLookup = async () => {
    const res = await lookup.run(bizNo);
    if (res.ok) setBizResult(res.data);
  };

  const after: BusinessFields = { bizNo, name: form.name, area: form.area, category: form.category, address: { zip: form.zip, line1: form.line1, line2: form.line2 } };
  // 수정 · 보완: 바뀐 값이나 새 파일이 있어야 보내요. 새 요청 · 다시 신청: 사업자등록증 · 필수 약관이 필요해요.
  const changed = JSON.stringify({ ...after, bizNo: after.bizNo.replace(/\D/g, '') }) !== JSON.stringify({ ...before, bizNo: before.bizNo.replace(/\D/g, '') }) || Boolean(cert);
  const requiredAgreed = terms.filter((t) => t.required).every((t) => agree[t.code]);
  const canSubmit =
    bizResult?.valid === true && form.category !== '' && form.name.trim() && form.zip.trim() && form.line1.trim() && (patching ? changed : Boolean(cert) && requiredAgreed && terms.length > 0);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const res = patching
      ? await update.run(current!.verificationId, before, after, cert)
      : await create.run(after, cert as File, terms.map((t) => ({ code: t.code, version: t.version, agreed: Boolean(agree[t.code]) })));
    if (res.ok) navigate('/signup/pending');
  };

  return (
    <>
      <div className={styles.titleBox}>
        <h1 className={styles.title}>{mode === 'edit' ? '업체 인증 내용 수정' : mode === 'resubmit' ? '보완해서 다시 제출' : mode === 'reapply' ? '다시 신청하기' : '업체 인증'}</h1>
        <p className={styles.lead}>
          {mode === 'new'
            ? '사업자 정보를 확인해야 입장 조건과 매장 QR을 관리할 수 있어요.'
            : mode === 'reapply'
              ? '이전 내용을 채워 두었어요. 새 요청으로 접수돼요.'
              : '바꿀 내용만 고치면 돼요. 바뀐 항목만 보내고, 다시 제출하면 접수 상태로 돌아가요.'}
        </p>
      </div>
      <SignupSteps current={2} />
      {(mode === 'resubmit' || mode === 'reapply') && current?.reason && (
        <Notice tone="warning">
          <strong>{mode === 'resubmit' ? '보완 요청 사유' : '반려 사유'}</strong> · {current.reason}
        </Notice>
      )}

      <form aria-label="업체 인증 정보" className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label="사업자등록번호" htmlFor="biz-no" message={bizResult && { tone: bizResult.valid ? 'ok' : 'error', text: bizResult.message }}>
          <InputRow>
            <TextInput
              id="biz-no"
              inputMode="numeric"
              placeholder="000-00-00000"
              value={bizNo}
              onChange={(e) => {
                setBizNo(e.target.value);
                setBizResult(null);
              }}
            />
            <Button variant="secondary" disabled={!bizNo || lookup.pending} onClick={onLookup}>
              조회
            </Button>
          </InputRow>
        </Field>

        {/* 대표자명 · 매장 전화번호는 업체 인증에서 받지 않아요 (매장 전화번호는 매장 정보의 선택 항목). 담당자 휴대폰을 매장 번호로 복사하지 않아요. */}
        <div className={styles.twoCol}>
          <Field
            label="업종"
            htmlFor="biz-category"
            message={form.category === '' ? { tone: 'error', text: patching ? '업종을 골라야 다시 제출할 수 있어요' : '업종을 골라 주세요' } : null}
          >
            <Select id="biz-category" value={form.category} aria-invalid={form.category === ''} onChange={(e) => set('category')(e.target.value)}>
              <option value="" disabled>
                업종 고르기
              </option>
              {(Object.keys(BUSINESS_CATEGORY_LABEL) as BusinessCategory[]).map((c) => (
                <option key={c} value={c}>
                  {BUSINESS_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className={styles.twoCol}>
          <Field label="상호명" htmlFor="biz-name">
            <TextInput id="biz-name" placeholder="예: AA 카페 성수점" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </Field>
          <Field label="지역" htmlFor="biz-area">
            <Select id="biz-area" value={form.area} onChange={(e) => set('area')(e.target.value)}>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="매장 주소"
          htmlFor="biz-address"
          hint={addressHint ? '주소 검색은 지도 API 연동 후 열려요. 지금은 직접 입력해 주세요.' : '지금은 성수 · 건대 · 서울숲 지역 업체만 가입할 수 있어요.'}
        >
          <InputRow>
            <TextInput id="biz-address" placeholder="우편번호" inputMode="numeric" value={form.zip} onChange={(e) => set('zip')(e.target.value)} className={styles.zip} />
            {/* TODO: 주소 검색 (카카오 · 도로명 주소 API) */}
            <Button variant="secondary" onClick={() => setAddressHint(true)}>
              주소 검색
            </Button>
          </InputRow>
          <label htmlFor="biz-line1" className="sr-only">
            기본 주소
          </label>
          <TextInput id="biz-line1" placeholder="기본 주소 (예: 서울 성동구 …)" value={form.line1} onChange={(e) => set('line1')(e.target.value)} />
          <label htmlFor="biz-line2" className="sr-only">
            상세 주소
          </label>
          <TextInput id="biz-line2" placeholder="상세 주소 (층 · 호수)" value={form.line2} onChange={(e) => set('line2')(e.target.value)} />
        </Field>

        <div>
          <Field label="사업자등록증" htmlFor="biz-cert" hint={fileError ? undefined : 'JPG, PNG, PDF · 최대 10MB'} message={fileError ? { tone: 'error', text: fileError } : null}>
            <input
              ref={fileInput}
              id="biz-cert"
              type="file"
              accept={ACCEPT.join(',')}
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {!cert && patching && (
              <div className={styles.file}>
                <Icon name="file" size={20} />
                <span>지금 파일 · {current?.licenseFile?.fileName ?? '사업자등록증'}</span>
                <span className={styles.small}>새로 올리면 바뀌어요</span>
              </div>
            )}
            {cert ? (
              <div className={styles.file}>
                <Icon name="file" size={20} />
                <span>
                  {cert.name} · {formatFileSize(cert.size)}
                </span>
                <button type="button" className={styles.iconButton} aria-label="첨부 삭제" onClick={() => setCert(null)}>
                  <Icon name="trash" />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <Icon name="upload" size={24} />
                <strong>파일을 끌어오거나 선택하세요</strong>
              </div>
            )}
          </Field>
        </div>

        {/* 동의는 새 요청 · 다시 신청 때만 받아요. 코드 · 버전은 F-WAUTH-01 약관 목록 값이에요. 수정 · 보완(PATCH)에는 보내지 않아요. */}
        {!patching && (
          <fieldset className={styles.fieldset}>
            <legend>동의</legend>
            {terms.map((t) => (
              <div key={t.code} className={styles.termRow}>
                <Choice
                  type="checkbox"
                  label={`${t.title} (${t.required ? '필수' : '선택'})`}
                  checked={Boolean(agree[t.code])}
                  onChange={(e) => setAgree((v) => ({ ...v, [t.code]: e.target.checked }))}
                />
                {t.url && (
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className={styles.termLink}>
                    보기
                  </a>
                )}
              </div>
            ))}
          </fieldset>
        )}
        {patching && !changed && <p className={styles.lead}>바뀐 내용이 없어요. 고칠 항목을 수정하거나 새 사업자등록증을 올려 주세요.</p>}

        {submit.error && <p role="alert">{submit.error}</p>}
        <div className={styles.formActions}>
          <ButtonLink to={current ? '/signup/pending' : '/signup'} variant="secondary">
            {current ? '취소' : '이전'}
          </ButtonLink>
          <Button type="submit" disabled={!canSubmit || submit.pending}>
            {submit.pending ? '보내는 중…' : mode === 'edit' ? '수정 내용 저장' : mode === 'resubmit' ? '보완해서 다시 제출' : mode === 'reapply' ? '다시 신청하기' : '인증 요청 보내기'}
          </Button>
        </div>
      </form>

      <Notice>
        운영자가 1–2일 안에 사업자 정보를 확인해요. 결과는 로그인하면 보이는 승인 대기 화면에서 확인할 수 있어요. 여러 매장을 운영하면 가입 후 왼쪽 위 업체 이름을 눌러{' '}
        <strong>업체 추가</strong>로 매장을 더할 수 있어요.
      </Notice>
    </>
  );
}
