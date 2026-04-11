# Office Unify GPT Builder Knowledge Index

## 문서 목적
이 문서는 `office-unify` 프로젝트 관련 GPT Builder를 만들 때
어떤 문서를 지식(knowledge)으로 포함할지,
각 문서가 어떤 역할을 하는지,
어떤 상황에서 참고해야 하는지를 정리한 인덱스 문서다.

이 문서의 목적은 다음과 같다.

- GPT Builder에 넣을 지식 파일 후보 정리
- 각 문서의 역할과 우선순위 정리
- GPT가 어떤 질문에 어떤 문서를 우선 참고해야 하는지 기준화
- 향후 knowledge 세트 확장 시 구조적 기준 제공

이 문서는 실제 GPT Builder를 구성할 때
지식 업로드 목록과 설명 문서로 사용할 수 있다.

---

# 1. GPT Builder에서 이 지식 세트가 필요한 이유

`office-unify` 프로젝트는 단순한 코드 생성 프로젝트가 아니다.

이 프로젝트는 아래를 함께 다룬다.

- 제품 비전
- 저장소 간 역할 구분
- 아키텍처 경계
- 마이그레이션 전략
- Cursor 작업 방식
- 검증 기준
- 리스크 관리
- 문서화 원칙

따라서 GPT Builder에 단순 지침만 넣는 것보다,
이 프로젝트의 핵심 원칙과 문서들을 함께 knowledge로 제공하는 것이 더 안정적이다.

즉, GPT는 아래를 기억해야 한다.

- 왜 통합하는가
- 무엇이 최종 본체인가
- 무엇을 바로 옮기면 안 되는가
- 어떤 순서로 진행해야 하는가
- 어떤 형식으로 결과를 내야 하는가

이 문서는 그 knowledge 구성을 정의한다.

---

# 2. 권장 knowledge 구성 원칙

GPT Builder에는 모든 문서를 무조건 다 넣기보다,
역할이 분명한 핵심 문서를 우선 넣는 것이 좋다.

권장 원칙은 아래와 같다.

1. 상위 원칙 문서를 우선한다.
2. 용어가 흔들릴 수 있으면 terminology 문서를 포함한다.
3. 아키텍처 판단이 중요하면 boundary 문서를 포함한다.
4. 실행 흐름이 중요하면 workflow 문서를 포함한다.
5. 템플릿 문서는 필요 시 보조 지식으로 넣는다.
6. 실제 코드베이스 전체를 knowledge로 넣는 것보다,
   구조적 판단 기준 문서를 먼저 넣는 것이 낫다.
7. GPT Builder는 Cursor처럼 실제 코드 수정 하네스를 직접 수행하지 않으므로,
   실행 규칙보다 판단 기준과 출력 원칙을 더 압축적으로 제공한다.

---

# 3. 최우선 knowledge 문서

아래 문서는 GPT Builder에 가장 먼저 넣는 것을 권장한다.

## 3.1 README.md
### 역할
- 이 저장소가 무엇인지 설명
- 하네스 저장소와 실제 작업 루트의 관계 설명
- 전체 운영 목적 설명

### GPT가 참고해야 하는 상황
- 프로젝트 전체 개요를 설명할 때
- 이 저장소의 역할을 설명할 때
- Cursor와 하네스 저장소의 관계를 설명할 때

### 우선순위
- 높음

---

## 3.2 docs/overview/project-vision.md
### 역할
- 왜 통합하는지
- 어떤 제품을 만들고 싶은지
- 장기 비전이 무엇인지 설명

### GPT가 참고해야 하는 상황
- 통합 방향을 설명할 때
- 제품 비전을 요약할 때
- GPT Builder 상위 지침을 만들 때
- 범위가 흔들릴 때 방향성을 다시 잡을 때

### 우선순위
- 매우 높음

---

## 3.3 docs/overview/terminology.md
### 역할
- 프로젝트 핵심 용어 정의
- 통합, 본체, 참조 원본, 순수 로직, legacy adapter 등 용어 기준 고정

### GPT가 참고해야 하는 상황
- 용어 정의가 필요한 답변
- 문서 표현을 일관되게 정리할 때
- 설계/프롬프트/가이드 문서를 작성할 때

### 우선순위
- 매우 높음

---

## 3.4 .cursor/rules/00-project-charter.md
### 역할
- 프로젝트 최상위 원칙
- 수정 우선순위
- 금지 사항
- 기본 산출물 형식 정의

### GPT가 참고해야 하는 상황
- 프로젝트 원칙을 요약할 때
- 무엇을 해도 되고 안 되는지 판단할 때
- 상위 지침문을 만들 때
- GPT Builder instructions를 작성/수정할 때

### 우선순위
- 매우 높음

---

## 3.5 .cursor/rules/10-architecture-boundaries.md
### 역할
- 클라이언트/서버 경계
- 순수 로직 / Discord 결합 로직 분류 기준
- 서버 구조 원칙
- 보안 경계 정의

### GPT가 참고해야 하는 상황
- 아키텍처 판단
- 웹 전환 가능성 판단
- 서버/클라이언트 분리 포인트 설명
- 바로 옮기면 안 되는 코드 유형 설명

### 우선순위
- 매우 높음

---

## 3.6 .cursor/rules/20-migration-workflow.md
### 역할
- 분석 → 설계 → 구현 → 검증 → 문서화 순서 정의
- 점진적 통합 원칙
- 구현 단위 제어 기준

### GPT가 참고해야 하는 상황
- 작업 순서를 제안할 때
- 현재 단계가 적절한지 판단할 때
- “무엇부터 해야 하나” 질문에 답할 때

### 우선순위
- 높음

---

## 3.7 .cursor/rules/30-validation-and-done.md
### 역할
- 완료 기준
- 검증 원칙
- Done / Partial Done 구분
- 보고 시 태도 기준

### GPT가 참고해야 하는 상황
- 완료 여부를 판단할 때
- 결과 보고 형식을 정리할 때
- 검증/문서화 필요 여부를 말할 때

### 우선순위
- 높음

---

# 4. 보조 knowledge 문서

아래 문서는 상황에 따라 함께 넣으면 좋다.

## 4.1 docs/workflow/harness-engineering-guide.md
### 역할
- 하네스 엔지니어링의 개념과 실무 적용 방식 설명

### 적합한 상황
- GPT가 하네스 자체를 설명해야 할 때
- 팀/사용자에게 방법론을 안내할 때

### 우선순위
- 중간~높음

---

## 4.2 docs/workflow/cursor-operating-guide.md
### 역할
- Cursor에서 실제로 어떻게 작업하는지 설명

### 적합한 상황
- Cursor 사용법을 설명할 때
- 프롬프트 운영 흐름을 제안할 때
- 실제 작업 루트 운영 방식 설명이 필요할 때

### 우선순위
- 중간~높음

---

## 4.3 .cursor/plans/office-unify-master-plan.template.md
### 역할
- 마스터 플랜 템플릿
- 통합 설계/계획의 구조 제공

### 적합한 상황
- 설계안을 구조화할 때
- 계획 문서 초안을 작성할 때
- 구현 전에 정리해야 할 항목을 누락 없이 뽑을 때

### 우선순위
- 중간~높음

---

## 4.4 templates/report-template.md
### 역할
- 표준 결과 보고 형식

### 적합한 상황
- 보고서 형식이 필요한 답변
- 분석/설계/구현/검증 결과를 정리할 때

### 우선순위
- 중간

---

## 4.5 templates/migration-plan-template.md
### 역할
- 특정 기능/계층 이관 작업 단위용 계획 문서

### 적합한 상황
- 전체 통합이 아니라 특정 범위 이관을 다룰 때
- 작은 실행 계획 문서가 필요할 때

### 우선순위
- 중간

---

## 4.6 templates/risk-log-template.md
### 역할
- 리스크 기록 및 상태 관리

### 적합한 상황
- 리스크를 별도로 정리할 때
- 남은 불확실성이나 회귀 위험을 구조적으로 정리할 때

### 우선순위
- 중간

---

# 5. GPT Builder에 넣을 추천 1차 세트

가장 처음 GPT Builder를 구성할 때는 아래 정도만 넣어도 충분하다.

## 최소 추천 세트
1. `README.md`
2. `docs/overview/project-vision.md`
3. `docs/overview/terminology.md`
4. `.cursor/rules/00-project-charter.md`
5. `.cursor/rules/10-architecture-boundaries.md`
6. `.cursor/rules/20-migration-workflow.md`
7. `.cursor/rules/30-validation-and-done.md`

이 세트만으로도
- 프로젝트 목적
- 용어 기준
- 아키텍처 경계
- 작업 순서
- 완료 기준

을 대부분 설명할 수 있다.

---

# 6. GPT Builder에 넣을 추천 2차 확장 세트

1차 세트 이후 아래를 추가하면 더 정교해진다.

## 확장 추천 세트
1. `docs/workflow/harness-engineering-guide.md`
2. `docs/workflow/cursor-operating-guide.md`
3. `.cursor/plans/office-unify-master-plan.template.md`
4. `templates/report-template.md`
5. `templates/migration-plan-template.md`
6. `templates/risk-log-template.md`

이 세트까지 넣으면
- 운영 방식 설명
- 계획 문서 구조
- 결과 보고 구조
- 리스크 정리 방식

까지 GPT가 더 안정적으로 답변할 수 있다.

---

# 7. GPT Builder에서 이 knowledge를 활용하는 질문 유형

아래와 같은 질문에 특히 유용하다.

## 제품/전략 질문
- 왜 `dev_support`가 본체인가?
- 왜 `ai_office`를 그대로 합치면 안 되는가?
- 이 통합의 장기 방향은 무엇인가?

## 아키텍처 질문
- 어떤 코드는 서버로 가야 하나?
- Discord 결합 로직은 어떻게 처리해야 하나?
- 어떤 기능이 먼저 이관되어야 하나?

## 운영 질문
- Cursor로는 어떤 순서로 작업해야 하나?
- 지금 단계에서 무엇을 먼저 해야 하나?
- 설계와 구현을 어떻게 나눠야 하나?

## 문서/보고 질문
- 결과를 어떤 형식으로 정리해야 하나?
- 완료와 부분 완료를 어떻게 구분하나?
- 리스크는 어떻게 관리해야 하나?

---

# 8. GPT Builder에서 knowledge를 쓸 때 주의할 점

아래를 유의한다.

1. GPT Builder는 Cursor처럼 실제 코드베이스를 직접 인덱싱하며 수정하는 도구가 아니다.
2. 따라서 knowledge는 “코드 수정 실행 규칙”보다는 “판단 기준, 설명 기준, 출력 기준” 위주로 넣는 것이 좋다.
3. 너무 많은 템플릿을 한꺼번에 넣으면 핵심 원칙보다 형식 문서에 끌릴 수 있다.
4. 처음에는 최소 세트로 시작하고, 필요 시 확장 세트를 추가하는 방식이 좋다.
5. GPT Builder의 역할은 실행보다 판단 보조, 설명, 지침 정리에 더 가깝다.

---

# 9. 권장 업로드 순서

GPT Builder에 knowledge 파일을 넣는다면 아래 순서를 권장한다.

## 1단계
- `README.md`
- `docs/overview/project-vision.md`
- `docs/overview/terminology.md`

## 2단계
- `.cursor/rules/00-project-charter.md`
- `.cursor/rules/10-architecture-boundaries.md`
- `.cursor/rules/20-migration-workflow.md`
- `.cursor/rules/30-validation-and-done.md`

## 3단계
- `docs/workflow/harness-engineering-guide.md`
- `docs/workflow/cursor-operating-guide.md`

## 4단계
- `.cursor/plans/office-unify-master-plan.template.md`
- `templates/report-template.md`
- `templates/migration-plan-template.md`
- `templates/risk-log-template.md`

---

# 10. 이 문서의 역할

이 문서는 GPT Builder를 만들 때
어떤 문서를 knowledge로 채택할지 결정하는 기준 문서다.

즉, 단순 목록이 아니라
- 어떤 문서가 핵심인지
- 어떤 문서가 보조인지
- 어떤 질문에 어떤 문서가 중요한지
를 설명하는 knowledge 설계 문서다.

---

# 11. 결론

`office-unify` 관련 GPT Builder는
많은 문서를 무작정 넣는 것보다,
핵심 원칙 문서를 중심으로 구성하는 것이 더 안정적이다.

가장 중요한 것은 아래다.

- 프로젝트 비전
- 용어 기준
- 최상위 원칙
- 아키텍처 경계
- 작업 순서
- 완료 기준

이 문서는 그 knowledge 구성을 체계적으로 정리하기 위한 인덱스다.
