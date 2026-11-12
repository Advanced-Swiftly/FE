import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createServerVerification, digitsOnly, resubmitServerVerification, type ServerVerificationInput } from '@/api/account';
import { Button } from '@/components/common/Button';
import { Field, TextInput } from '@/components/common/Field';
import { Notice } from '@/components/common/Notice';
import { useAction } from '@/hooks/useAction';
import type { SignupStatus } from '@/types';
import { SignupSteps } from './SignupSteps';
import styles from './Signup.module.css';

const URL_RE = /^https?:\/\/\S+$/;
const BIZ_RE = /^\d{10}$/;
const isLat = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 90;
const isLng = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180;

/**
 * 서버 모드 업체 인증 (실제 BE 기준).
 * - 새 요청 · 반려 뒤 다시 신청: POST /business/verifications — 사업자번호 · 상호 · 대표자 · 사업자등록증 주소 · 매장(이름 · 주소 · 전화 · 위도 · 경도) 모두 필수
 * - 보완 제출: POST /business/verifications/{id}/resubmit — 사업자등록증 주소 필수, 매장 정보는 바꾼 것만
 * BE 에 파일 업로드 · 사업자 상태 조회 · 주소 → 좌표 변환 API 가 없어서, 파일은 주소로 받고 좌표는 직접 입력받아요 (임의 값으로 채우지 않아요).
 */
export function ServerBusinessForm({ mode, current }: { mode: 'new' | 'resubmit' | 'reapply'; current: SignupStatus | null }) {
  const navigate = useNavigate();
  const resubmit = mode === 'resubmit';
  const [f, setF] = useState({
    businessNumber: '',
    businessName: current?.form.name ?? '',
    representativeName: '',
    documentUrl: '',
    name: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const create = useAction(createServerVerification);
  const re = useAction(resubmitServerVerification);
  const action = resubmit ? re : create;

  const urlOk = URL_RE.test(f.documentUrl.trim()) && f.documentUrl.trim().length <= 500;
  const latOk = resubmit && !f.latitude.trim() ? true : isLat(f.latitude);
  const lngOk = resubmit && !f.longitude.trim() ? true : isLng(f.longitude);
  // 위도 · 경도는 둘 다 넣거나 둘 다 비워요 (보완 제출)
  const pairOk = !resubmit || Boolean(f.latitude.trim()) === Boolean(f.longitude.trim());
  const canSubmit = resubmit
    ? urlOk && latOk && lngOk && pairOk
    : BIZ_RE.test(digitsOnly(f.businessNumber)) &&
      f.businessName.trim() !== '' &&
      f.representativeName.trim() !== '' &&
      urlOk &&
      f.name.trim() !== '' &&
      f.address.trim() !== '' &&
      f.phone.trim() !== '' &&
      latOk &&
      lngOk;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || action.pending) return;
    const store = { name: f.name, address: f.address, phone: f.phone, latitude: f.latitude, longitude: f.longitude };
    const res = resubmit
      ? await re.run(current!.verificationId, f.documentUrl, store)
      : await create.run({ businessNumber: f.businessNumber, businessName: f.businessName, representativeName: f.representativeName, documentUrl: f.documentUrl, store } satisfies ServerVerificationInput);
    if (res.ok) navigate('/signup/pending');
  };

  return (
    <>
      <div className={styles.titleBox}>
        <h1 className={styles.title}>{resubmit ? '보완해서 다시 제출' : mode === 'reapply' ? '다시 신청하기' : '업체 인증'}</h1>
        <p className={styles.lead}>
          {resubmit ? '사업자등록증 주소는 다시 적어야 해요. 매장 정보는 바꿀 항목만 적으면 나머지는 그대로예요.' : '사업자 정보를 확인해야 입장 조건과 매장 QR을 관리할 수 있어요.'}
        </p>
      </div>
      <SignupSteps current={2} />
      {current?.reason && (
        <Notice tone="warning">
          <strong>{resubmit ? '보완 요청 사유' : '반려 사유'}</strong> · {current.reason}
        </Notice>
      )}
      <form aria-label="업체 인증 정보" className={styles.form} onSubmit={onSubmit} noValidate>
        {!resubmit && (
          <>
            <Field label="사업자등록번호" htmlFor="sv-biz" hint="숫자 10자리" message={f.businessNumber && !BIZ_RE.test(digitsOnly(f.businessNumber)) ? { tone: 'error', text: '사업자등록번호 10자리를 확인해 주세요' } : null}>
              <TextInput id="sv-biz" inputMode="numeric" placeholder="000-00-00000" value={f.businessNumber} onChange={set('businessNumber')} />
            </Field>
            <div className={styles.twoCol}>
              <Field label="상호명" htmlFor="sv-bname">
                <TextInput id="sv-bname" maxLength={100} value={f.businessName} onChange={set('businessName')} />
              </Field>
              <Field label="대표자명" htmlFor="sv-rep">
                <TextInput id="sv-rep" maxLength={50} value={f.representativeName} onChange={set('representativeName')} />
              </Field>
            </div>
          </>
        )}
        <Field
          label="사업자등록증 파일 주소"
          htmlFor="sv-doc"
          hint="사업자등록증 이미지 · PDF 가 올라가 있는 http(s) 주소예요. 서버에 파일 업로드 기능이 아직 없어요."
          message={f.documentUrl && !urlOk ? { tone: 'error', text: 'http(s):// 로 시작하는 500자 이하 주소를 적어 주세요' } : null}
        >
          <TextInput id="sv-doc" type="url" inputMode="url" placeholder="https://" value={f.documentUrl} onChange={set('documentUrl')} />
        </Field>
        <h2 className={styles.lead}>{resubmit ? '매장 정보 (바꿀 항목만)' : '매장 정보'}</h2>
        <div className={styles.twoCol}>
          <Field label="매장 이름" htmlFor="sv-name">
            <TextInput id="sv-name" maxLength={100} value={f.name} onChange={set('name')} />
          </Field>
          <Field label="매장 전화번호" htmlFor="sv-phone">
            <TextInput id="sv-phone" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field label="매장 주소" htmlFor="sv-addr">
          <TextInput id="sv-addr" maxLength={255} value={f.address} onChange={set('address')} />
        </Field>
        <div className={styles.twoCol}>
          <Field label="위도" htmlFor="sv-lat" message={f.latitude && !isLat(f.latitude) ? { tone: 'error', text: '-90 ~ 90 사이 숫자예요' } : null}>
            <TextInput id="sv-lat" inputMode="decimal" placeholder="37.5445" value={f.latitude} onChange={set('latitude')} />
          </Field>
          <Field label="경도" htmlFor="sv-lng" message={f.longitude && !isLng(f.longitude) ? { tone: 'error', text: '-180 ~ 180 사이 숫자예요' } : null}>
            <TextInput id="sv-lng" inputMode="decimal" placeholder="127.0557" value={f.longitude} onChange={set('longitude')} />
          </Field>
        </div>
        <p className={styles.lead}>주소를 좌표로 바꾸는 기능이 서버에 아직 없어 위도 · 경도를 직접 적어 주세요.{resubmit && ' 위치를 바꾸려면 두 값을 함께 적어 주세요.'}</p>
        {!pairOk && <Notice tone="warning">위도와 경도는 함께 적어 주세요.</Notice>}
        {action.error && (
          <Notice tone="danger" role="alert">
            {action.error}
          </Notice>
        )}
        <Button type="submit" size="lg" fullWidth disabled={!canSubmit || action.pending}>
          {action.pending ? '보내는 중…' : resubmit ? '보완해서 다시 제출' : '인증 요청 보내기'}
        </Button>
      </form>
    </>
  );
}
