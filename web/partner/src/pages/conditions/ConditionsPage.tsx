import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getConditions } from '@/api/conditions';
import { ButtonLink, Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { RequestDetailModal } from '@/components/requests/RequestDetailModal';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import { CONDITION_FIELDS, CONDITION_LABEL, describeField, fieldState } from '@/utils/conditions';
import { formatDate } from '@/utils/format';
import styles from './ConditionsPage.module.css';

/** 보호자 안내 칸 문구 (조건 하나의 '가능'은 전체 입장 가능 판정이 아니에요) */
const GUIDE = {
  LIMITED: '조건에 맞으면 충족',
  UNRESTRICTED: '‘가능’으로 안내',
  UNKNOWN: '‘조건 확인 필요’로 안내 중',
} as const;

/** UI-W-009 입장 조건 현황 (F-WREQ-02) */
export function ConditionsPage() {
  const { store } = useCurrentStore();
  const navigate = useNavigate();
  const location = useLocation();
  const conditions = useFetch(`conditions:${store.id}`, () => getConditions(store.id));
  const [detailId, setDetailId] = useState<string | null>(null);
  const flash = (location.state as { flash?: string } | null)?.flash;

  const c = conditions.data;

  return (
    <div className={page.stack}>
      <PageHeader
        title="입장 조건 현황"
        description={
          <>
            보호자에게 지금 보이는 조건이에요. 항목의 <strong>수정 요청</strong>을 누르면 바꿀 내용을 적어 보낼 수 있고, 운영자가 승인하면 바로 반영돼요.
          </>
        }
      />

      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })} action={<Link to="/requests">요청 처리 현황</Link>}>
          {flash}
        </Notice>
      )}

      <LoadState status={conditions.status} />
      {c && (
        <>
          <div className={page.pills}>
            <span className={page.pill}>
              <span>조건 확인일</span>
              <strong>{c.conditionCheckedAt ? formatDate(c.conditionCheckedAt) : '—'}</strong>
            </span>
            <span className={page.pill}>
              <span>확인 방식</span>
              <strong>{c.checkMethod ?? '—'}</strong>
            </span>
            <span className={page.pill}>
              <span>출처</span>
              <strong>{c.source ?? '—'}</strong>
            </span>
          </div>

          <Card title="항목별 조건" padding="none">
            <div className={table.scroll}>
              <table className={`${table.table} ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 150 }}>
                      항목
                    </th>
                    <th scope="col">현재 조건</th>
                    <th scope="col" style={{ width: 210 }}>
                      보호자 안내
                    </th>
                    <th scope="col" style={{ width: 150 }}>
                      <span className="sr-only">작업</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CONDITION_FIELDS.map((field) => {
                    const pending = c.pendingItems.find((p) => p.field === field);
                    const state = fieldState(c, field);
                    return (
                      <tr key={field} className={pending ? styles.pendingRow : state === 'UNKNOWN' ? styles.unknownRow : undefined}>
                        <th scope="row">{CONDITION_LABEL[field]}</th>
                        <td>
                          <div className={styles.valueCell}>
                            {state === 'UNKNOWN' ? (
                              <JudgmentChip judgment="UNKNOWN" label="미확인" />
                            ) : (
                              <span className={styles.value}>
                                {describeField(c, field)}
                                {state === 'UNRESTRICTED' && <Tag tone="green">가능</Tag>}
                              </span>
                            )}
                            {pending && (
                              <Tag tone={pending.status === 'NEEDS_INFO' ? 'yellow' : 'blue'} shape="pill">
                                변경 요청 {REQUEST_STATUS_LABEL[pending.status]}
                              </Tag>
                            )}
                          </div>
                        </td>
                        <td className={table.muted}>{pending ? '승인 전까지 지금 조건 유지' : GUIDE[state]}</td>
                        <td className={table.right}>
                          {pending ? (
                            // 요청 ID 가 없으면 [요청 보기]를 그리지 않아요. 진행 중 표시와 수정 막기는 그대로예요.
                            pending.requestId && (
                              <Button size="sm" onClick={() => setDetailId(pending.requestId)}>
                                요청 보기
                              </Button>
                            )
                          ) : (
                            <ButtonLink
                              to={`/conditions/edit?item=${field}`}
                              variant={state === 'UNKNOWN' ? 'ghost' : 'secondary'}
                              size="sm"
                              className={state === 'UNKNOWN' ? styles.addButton : undefined}
                            >
                              {state === 'UNKNOWN' ? '추가 요청' : '수정 요청'}
                              {state !== 'UNKNOWN' && <Icon name="chevronRight" size={16} />}
                            </ButtonLink>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className={page.muted}>‘가능’은 그 조건 하나가 맞는다는 뜻이에요. 보호자 반려견의 최종 판정은 모든 조건을 함께 보고 정해요.</p>
        </>
      )}

      <RequestDetailModal requestId={detailId} onClose={() => setDetailId(null)} onChanged={conditions.reload} />
    </div>
  );
}
