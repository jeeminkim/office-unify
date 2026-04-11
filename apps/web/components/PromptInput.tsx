"use client";
import { useState } from 'react';
import { TaskType, SqlStyleOptions } from '@/lib/types';
import { Info, Sparkles } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  schemaContext: string;
  onSchemaChange: (val: string) => void;
  showSchema: boolean;
  sqlStyle: SqlStyleOptions;
  onSqlStyleChange: (next: SqlStyleOptions) => void;
}

const EXAMPLES: Record<TaskType, string[]> = {
  flow: [
    "장바구니에서 상품 결제 중 재고 부족 시 처리 프로세스",
    "이메일 인증 기반 회원가입 로직",
  ],
  sql: [
    "최근 1주일 로그인 이력이 없는 휴면 회원 목록 조회",
    "상품 카테고리별 일별 매출 합계 집계",
  ],
  ts: [
    "비밀번호가 조건(영문, 숫자, 특수문자 포함 8자 이상)을 만족하는지 검사",
    "입력된 날짜 배열에서 가장 가까운 미래의 날짜 하나를 반환하는 함수",
  ],
};

const SCHEMA_PLACEHOLDER = `[목적]
무엇을 조회/집계/수정하려는지

[테이블]
customer(cust_id, cust_name, status_cd)
contract(contract_id, cust_id, product_cd)
payment(payment_id, contract_id, unpaid_yn)

[관계]
customer.cust_id = contract.cust_id
contract.contract_id = payment.contract_id

[조건]
필터, 기간, 상태값

[원하는 결과]
최종 컬럼 또는 집계 항목

[주의사항]
DB별 요구, 성능, CTE 선호 등`;

const TEMPLATE_CONTRACT = `[목적]
미납 계약이 있는 고객 목록과 최근 납입일

[테이블]
customer(cust_id, cust_name, region_cd)
contract(contract_id, cust_id, status_cd, start_dt, end_dt)
payment(payment_id, contract_id, pay_dt, amount, unpaid_yn)

[관계]
customer.cust_id = contract.cust_id
contract.contract_id = payment.contract_id

[조건]
unpaid_yn = 'Y' 인 납입이 최근 90일 이내 존재
status_cd = 'ACTIVE'

[원하는 결과]
cust_id, cust_name, contract_id, 최근 unpaid 발생일

[주의사항]
Oracle이면 날짜 비교 방식 명시`;

const TEMPLATE_ORDER = `[목적]
주문별 상품·재고 차감 전제의 매출 요약

[테이블]
orders(order_id, user_id, order_dt, status_cd)
order_item(order_item_id, order_id, product_id, qty, price)
product(product_id, sku, stock_qty)
inventory(product_id, warehouse_cd, qty)

[관계]
orders.order_id = order_item.order_id
order_item.product_id = product.product_id
product.product_id = inventory.product_id

[조건]
order_dt 기준 당월, status_cd = 'PAID'

[원하는 결과]
product_id별 판매 qty 합계, 매출 합계

[주의사항]
집계 쿼리, 인덱스 가정은 explanation에`;

const TEMPLATE_AUTH = `[목적]
최근 로그인 없는 계정 중 권한 보유자

[테이블]
users(user_id, email, last_login_dt, status_cd)
user_role(user_id, role_cd)
role(role_cd, role_name)

[관계]
users.user_id = user_role.user_id
user_role.role_cd = role.role_cd

[조건]
last_login_dt < TRUNC(SYSDATE)-30  (DB에 맞게 조정)
status_cd = 'ACTIVE'

[원하는 결과]
user_id, email, role_name

[주의사항]
존재 여부(EXISTS) vs 상세 조회 구분`;

const REQUEST_PLACEHOLDER = `[목적] 한 줄 요약 후, 필요 시 [조건][원하는 결과]를 덧붙이세요.

예) 미납이 1건이라도 있는 활성 계약 고객만 추출하고, 고객명 오름차순`;

export default function PromptInput({
  value,
  onChange,
  schemaContext,
  onSchemaChange,
  showSchema,
  sqlStyle,
  onSqlStyleChange,
}: PromptInputProps) {
  const [activeTab, setActiveTab] = useState<TaskType>('flow');

  const patchSqlStyle = (patch: Partial<SqlStyleOptions>) => {
    onSqlStyleChange({ ...sqlStyle, ...patch });
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-800 mb-2">프롬프트 템플릿 예시</label>
        <div className="flex gap-2 mb-2">
          {(['flow', 'sql', 'ts'] as TaskType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveTab(type)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                activeTab === type
                  ? 'bg-slate-800 text-white border border-slate-800'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {type === 'flow' ? 'Flow 예시' : type === 'sql' ? 'SQL 예시' : 'TS 예시'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLES[activeTab].map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(ex)}
              className="px-3 py-2 text-xs text-left font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors truncate max-w-full"
            >
              • {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-6">
        <label className="block text-sm font-bold text-slate-800 mb-2">요구사항 입력</label>
        <p className="text-xs text-slate-500 mb-2">
          조회·집계·수정 목적과 조건을 적습니다. SQL은 아래 스키마 블록과 함께 쓰면 정확도가 올라갑니다. 짧게만 적어도 내부적으로 보완 문구가 붙지만, 표준 포맷을 채우는 편이 안전합니다.
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={REQUEST_PLACEHOLDER}
          className="w-full h-36 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none bg-white font-sans text-slate-800 shadow-inner"
        />
        {value.trim() === '' && (
          <div className="absolute right-4 bottom-4 text-xs font-medium text-slate-400 pointer-events-none">
            내용을 입력해주세요
          </div>
        )}
      </div>

      {showSchema && (
        <div className="relative border-t border-slate-100 pt-6 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-xs text-emerald-900">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">SQL 정확도 팁</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  [테이블]에 PK/FK 후보 컬럼을 적고, [관계]에 조인 키를 명시하면 조인 추정 오류가 줄어듭니다.
                </li>
                <li>
                  기간·상태 필터는 컬럼명과 값 형식(문자/숫자/날짜)을 함께 적으면 좋습니다. DB 종류(상단 대상 DB)에 맞는 날짜 함수를 쓰라고 요청할 수 있습니다.
                </li>
                <li>
                  [목적][테이블][관계][조건][원하는 결과] 형식을 권장합니다. 스키마가 비어 있으면 가정이 warnings에 남습니다.
                </li>
              </ul>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">스키마 예시 넣기</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSchemaChange(TEMPLATE_CONTRACT)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                고객/계약/납입
              </button>
              <button
                type="button"
                onClick={() => onSchemaChange(TEMPLATE_ORDER)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                주문/상품/재고
              </button>
              <button
                type="button"
                onClick={() => onSchemaChange(TEMPLATE_AUTH)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                회원/로그인/권한
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">SQL 생성 옵션</p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sqlStyle.readabilityFirst}
                  onChange={(e) => patchSqlStyle({ readabilityFirst: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                가독성 우선
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sqlStyle.performanceAware}
                  onChange={(e) => patchSqlStyle({ performanceAware: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                성능 고려
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sqlStyle.preferCte}
                  onChange={(e) => patchSqlStyle({ preferCte: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                CTE 선호
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              테이블 구조 / 조인 관계
            </label>
            <p className="text-xs text-slate-500 mb-2">
              아래 권장 섹션을 채울수록 조인·컬럼 추정 오류가 줄어듭니다. 빈 칸이면 LLM이 가정하며 warnings에 남깁니다.
            </p>
            <textarea
              value={schemaContext}
              onChange={(e) => onSchemaChange(e.target.value)}
              placeholder={SCHEMA_PLACEHOLDER}
              className="w-full min-h-[220px] p-4 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-y bg-emerald-50/40 font-mono text-sm text-slate-800 shadow-inner"
            />
          </div>
        </div>
      )}
    </div>
  );
}
