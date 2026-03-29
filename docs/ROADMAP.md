# ROADMAP

## 현재 상태
- **Phase 1** 안정화·정합성 루틴(`check:schema-contract`, `check:phase1-structure`, `check:runtime-e2e`)은 운영 중이다.
- **Phase 2 초입**: 구조화된 의사결정(decision artifact / committee vote / risk veto)이 코드에 반영되었으며, **실행·주문 자동화는 포함하지 않는다**. 스키마는 `docs/sql/append_phase2_decision_tables.sql` 적용 후 **`append_phase2_decision_tables_hardening.sql`**로 버전·idempotency·artifact↔vote 연결을 강화한다.

## Phase 1: Persona Memory / Claim Ledger / Feedback Loop

### 목표
- 분석 결과를 claim 단위로 구조화하고 피드백을 누적 학습에 반영한다.
- OpenAI/Gemini 혼합 운영에서 비용/안정성 fallback을 확보한다.
- Discord UX 안정성(응답 지연/길이/중복 클릭)을 운영 가능한 수준으로 유지한다.

### 완료 조건
- `analysis_claims`, `claim_feedback`, `analysis_generation_trace`, `persona_memory` 경로가 운영에서 정상 동작
- feedback idempotency 및 claim mapping 메타데이터 저장
- LLM budget guard/fallback 동작 확인
- quote 실패 시 valuation 왜곡 방지 로직 적용

### 리스크
- 운영 DB 스키마 불일치
- `index.ts` 집중 구조로 인한 회귀 위험
- best-effort 저장 누락 시 사후 보정 부담

## Phase 2: 결정 자동화 수준 고도화

### 목표
- 페르소나 응답을 구조화된 decision artifact로 변환 (**진행 중**: 위원회 가중 투표 + 리스크 veto + DB 저장)
- 신호 신뢰도와 성과를 scorecard로 추적
- 운영자 승인 기반 반자동 실행 체계 도입(후속 단계, 본 레포는 결정 생성까지만)

### 완료 조건
- persona scorecard 가동
- claim outcome audit 자동 갱신
- 리스크 제한(노출/손실/품질) 가드가 자동 평가에 연결
- `npm run check:decision-engine` 스모크 통과 및 운영 DB에 Phase 2 테이블 반영

### 리스크
- 잘못된 자동화로 인한 의사결정 오탐
- 설명가능성 부족 시 운영 신뢰 저하

## Phase 3: 로보어드바이저 도입

### 목표
- 사용자 성향/제약 기반 권고 엔진 구축
- 자산배분/리밸런싱/위험관리 정책 자동화
- 모니터링/감사/규정 준수 관점 운영 체계 확립

### 완료 조건
- 전략별 백테스트/페이퍼트레이드/실거래 검증 체계
- 운영 감사 로그와 모델 변경 이력 추적 가능
- 장애 시 안전 정지(fail-safe) 보장

### 리스크
- 규정/정책 준수 문제
- 모델 편향/데이터 품질 저하
- 운영 비용 증가

## 단계별 우선순위
1. Phase 1 운영 루틴 유지
2. Phase 2: 결정 엔진·문서·migration 적용 후 운영 검증
3. Phase 3는 정책/거버넌스 준비 후 착수

## 확인 필요
- Phase 2 진입 전, 운영 DB와 문서 정합성 점검을 선행해야 한다.
