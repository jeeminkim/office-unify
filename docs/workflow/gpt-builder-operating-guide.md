# Office Unify GPT Builder Operating Guide

## 문서 목적
이 문서는 `office-unify` 프로젝트에서 GPT Builder를 어떻게 활용할지 정리하는 운영 가이드다.

이 문서는 다음을 설명한다.

- GPT Builder의 역할
- Cursor와 GPT Builder의 차이
- 어떤 지침과 지식을 GPT Builder에 넣어야 하는지
- 어떤 작업은 GPT Builder에 적합하고, 어떤 작업은 Cursor에 적합한지
- 하네스 엔지니어링 관점에서 GPT Builder를 어떻게 보조 계층으로 운영할지

즉, 이 문서는
`office-unify-harness`의 원칙을 GPT Builder에 확장할 때
무엇을 넣고 무엇을 기대해야 하는지를 정리하는 실무 문서다.

---

# 1. 기본 관점

`office-unify` 프로젝트에서 GPT Builder는
실제 코드베이스를 직접 통합하는 주 실행 도구가 아니다.

이 프로젝트에서 GPT Builder는 아래 역할에 가깝다.

- 상위 원칙 유지
- 비전/아키텍처 판단 보조
- 프롬프트 초안 정리
- 문서 초안 작성
- 용어 일관성 유지
- 마이그레이션 방향 검토
- 리스크/범위 정리
- 결과 보고 형식 정리

즉,
Cursor가 실제 코드 작업의 중심이라면,
GPT Builder는 **상위 판단과 문서화의 보조 계층**이다.

---

# 2. 왜 GPT Builder가 필요한가

이 프로젝트는 단순히 Cursor만 잘 쓰면 끝나는 구조가 아니다.

실제로는 아래 같은 일이 반복된다.

- 통합 방향을 다시 요약해야 함
- 왜 `dev_support`가 본체인지 설명해야 함
- Discord 결합 로직을 어떻게 봐야 하는지 판단해야 함
- Cursor용 프롬프트를 다듬어야 함
- 마이그레이션 단계를 설명해야 함
- 결과 보고 형식을 맞춰야 함
- 프로젝트 원칙을 흔들리지 않게 유지해야 함

이런 작업은 코드 직접 수정보다
**일관된 판단과 설명**이 중요하다.

따라서 GPT Builder는
이 프로젝트의 상위 원칙과 사고방식을 고정하는 데 유용하다.

---

# 3. Cursor와 GPT Builder의 역할 차이

## 3.1 Cursor의 역할
Cursor는 아래 작업에 적합하다.

- 실제 코드베이스 분석
- 관련 파일 탐색
- 구조 리팩토링
- 새 파일 생성/수정
- 작은 단위 구현
- 검증 명령 제안 및 수행 보조
- 실제 변경 파일 단위 작업

즉, Cursor는 **실행 중심 도구**다.

---

## 3.2 GPT Builder의 역할
GPT Builder는 아래 작업에 적합하다.

- 통합 방향 설명
- 아키텍처 판단 기준 유지
- 프롬프트 템플릿 정리
- 문서/지침 초안 작성
- 용어 일관성 유지
- 상위 원칙 검토
- 범위/우선순위 정리
- 리스크와 완료 기준 정리

즉, GPT Builder는 **판단/설명 중심 도구**다.

---

## 3.3 핵심 차이
간단히 정리하면 아래와 같다.

- Cursor: 실제 코드 작업
- GPT Builder: 상위 원칙과 설명의 일관성 유지

따라서 GPT Builder를 Cursor 대체재로 보면 안 된다.
GPT Builder는 Cursor를 더 잘 쓰기 위한 보조 계층으로 보는 것이 맞다.

---

# 4. 이 프로젝트에서 GPT Builder의 위치

이 프로젝트의 하네스는 아래처럼 3층으로 볼 수 있다.

## 1층. 하네스 원본 저장소
- `office-unify-harness`
- rules, plans, docs, templates, prompts를 관리

## 2층. Cursor 실행 환경
- 실제 작업 루트
- `ai_office/`
- `dev_support/`
- `.cursor/rules/`
- `.cursor/plans/`

## 3층. GPT Builder 보조 계층
- 상위 원칙 유지
- 프롬프트 보조
- 문서화 보조
- 판단 정리 보조

즉,
GPT Builder는 프로젝트의 “실행 중심”이 아니라,
**상시 판단 보조 레이어**다.

---

# 5. GPT Builder에 넣어야 할 핵심 정보

GPT Builder에는 실제 코드 전체보다,
아래 같은 상위 정보가 더 중요하다.

## 5.1 제품 비전
- 왜 통합하는가
- 어떤 제품을 만들려는가
- 장기 방향은 무엇인가

## 5.2 용어 기준
- 본체
- 참조 원본
- 순수 로직
- Discord 결합 로직
- legacy adapter
- source of truth

## 5.3 최상위 원칙
- `dev_support` 중심 통합
- 기존 기능 보호
- Discord 직접 이식 금지
- 민감정보 서버 전용
- 점진적 통합 우선

## 5.4 작업 순서
- 분석 → 설계 → 구현 → 검증 → 문서화

## 5.5 완료 기준
- 검증 없는 완료 선언 금지
- 문서와 리스크 공개 포함
- Done / Partial Done 구분

즉,
GPT Builder는 “실행 세부사항”보다
“판단 기준”을 기억해야 한다.

---

# 6. GPT Builder에 적합한 질문 유형

아래 질문은 GPT Builder에 특히 잘 맞는다.

## 6.1 방향/전략 질문
- 지금 통합 방향이 맞는가?
- 왜 `dev_support`가 본체인가?
- 어떤 기능을 먼저 이관해야 하는가?

## 6.2 아키텍처 질문
- 이 로직은 서버로 가야 하나?
- Discord 결합 로직은 어떻게 처리해야 하나?
- 어떤 폴더 구조가 적절한가?

## 6.3 문서/프롬프트 질문
- Cursor용 프롬프트를 어떻게 써야 하나?
- GPT Builder용 지침을 어떻게 압축해야 하나?
- 결과 보고 형식은 어떻게 정리해야 하나?

## 6.4 운영 질문
- 지금은 분석 단계인가 설계 단계인가?
- 다음 단계로 무엇이 가장 적절한가?
- 현재 Done인지 Partial Done인지 어떻게 판단하나?

---

# 7. GPT Builder에 덜 적합한 질문 유형

아래 유형은 GPT Builder보다 Cursor가 더 적합하다.

## 7.1 실제 파일 수정 질문
- 이 파일을 직접 수정해줘
- import 정리해줘
- 라우트를 추가해줘
- API 파일 만들어줘

## 7.2 실제 코드베이스 의존 질문
- 현재 저장소에서 어떤 파일이 연결되어 있지?
- 실제 import chain을 분석해줘
- 이 커밋 이후 깨진 부분을 찾아줘

## 7.3 로컬 환경 의존 질문
- 현재 빌드 오류를 바로 고쳐줘
- 실행 로그를 보고 패치해줘
- 로컬 실행 기준으로 검증해줘

이런 질문은 실제 코드와 실행 환경이 필요한 만큼
GPT Builder보다 Cursor가 중심이 되어야 한다.

---

# 8. GPT Builder 운영 원칙

## 8.1 상위 원칙 유지 우선
GPT Builder는 즉흥적인 조언보다
프로젝트 원칙을 먼저 유지해야 한다.

## 8.2 구조화된 답변 우선
답변은 가능하면 아래 구조를 따른다.

1. 설계 요약
2. 변경/적용 포인트
3. 핵심 이유
4. 검증 또는 판단 기준
5. 남은 리스크 / 다음 단계

## 8.3 구현보다 판단 우선
구체 코드보다
- 범위가 적절한지
- 순서가 맞는지
- 위험이 무엇인지
- 문서화가 필요한지
를 먼저 본다.

## 8.4 과도한 범위 확대 금지
GPT Builder도 아래를 피해야 한다.

- 한 번에 전체 통합을 다 하려는 제안
- 검증 없이 낙관적인 완료 판단
- 기존 기능 보호를 무시한 구조 변경 제안

## 8.5 문서/프롬프트 재사용성 우선
한 번만 쓸 답변보다,
반복 사용 가능한 프롬프트/문서/템플릿 형태로 정리하는 것이 좋다.

---

# 9. GPT Builder용 권장 지식 세트

이 프로젝트에서 GPT Builder에 우선 넣을 지식은 아래와 같다.

## 최소 세트
- `README.md`
- `docs/overview/project-vision.md`
- `docs/overview/terminology.md`
- `.cursor/rules/00-project-charter.md`
- `.cursor/rules/10-architecture-boundaries.md`
- `.cursor/rules/20-migration-workflow.md`
- `.cursor/rules/30-validation-and-done.md`

## 확장 세트
- `docs/workflow/harness-engineering-guide.md`
- `docs/workflow/prompt-engineering-guide.md`
- `docs/workflow/context-engineering-guide.md`
- `docs/workflow/cursor-operating-guide.md`
- `.cursor/plans/office-unify-master-plan.template.md`
- `templates/report-template.md`
- `templates/migration-plan-template.md`
- `templates/risk-log-template.md`

즉,
처음에는 핵심 원칙 문서 중심으로 시작하고,
필요 시 운영/템플릿 문서를 추가하는 방식이 좋다.

---

# 10. GPT Builder 지침문 운영 원칙

GPT Builder의 instructions는 너무 길고 세세하게 쓰기보다,
핵심 판단 기준을 압축하는 편이 낫다.

좋은 지침문은 아래를 포함한다.

- 프로젝트 목적
- 최상위 제품 원칙
- 아키텍처 원칙
- 마이그레이션 원칙
- 판단 기준
- 출력 형식
- 금지 사항
- GPT의 역할 정의

반대로 아래는 지양한다.

- 로컬 경로 세부 정보
- 일시적 파일 목록
- 매 턴 달라지는 구현 메모
- 지나치게 세부적인 실행 절차

즉,
instructions는 축약된 원칙,
knowledge는 보조 문서 세트로 본다.

---

# 11. 실무 운영 예시

## 예시 1. 방향 검토
질문:
- 지금 통합 방향이 맞는지 검토해줘

GPT Builder 역할:
- 비전, 원칙, 아키텍처 경계 기준으로 판단
- 범위 과확장을 경고
- 다음 단계 제안

---

## 예시 2. Cursor 프롬프트 다듬기
질문:
- 분석 전용 프롬프트를 더 정교하게 만들어줘

GPT Builder 역할:
- 현재 단계 목적 확인
- 범위 제한/금지 사항/출력 형식 보강
- 하네스 원칙과 정합성 유지

---

## 예시 3. 결과 보고 정리
질문:
- 방금 작업 결과를 임원 보고 스타일로 정리해줘

GPT Builder 역할:
- 보고 형식 템플릿 기준으로 요약
- Done/Partial Done 구분
- 리스크와 다음 단계 정리

---

## 예시 4. GPT Builder 자체 개선
질문:
- 이 GPT 지침을 더 짧고 강하게 정리해줘

GPT Builder 역할:
- 중복 제거
- 핵심 원칙 압축
- 판단과 금지 사항 강조

---

# 12. GPT Builder를 쓸 때 주의할 점

## 12.1 실제 코드 상태와 분리될 수 있다
GPT Builder는 현재 로컬 코드 상태를 직접 알고 있지 않을 수 있다.
따라서 코드 현황이 필요한 질문은 Cursor 또는 실제 저장소 기준으로 다시 확인해야 한다.

## 12.2 너무 많은 문서를 한꺼번에 넣지 않는다
처음부터 너무 많은 템플릿과 세부 문서를 넣으면
핵심 비전보다 형식에 끌릴 수 있다.

## 12.3 실행 가능성과 설명 가능성을 구분한다
GPT Builder는 설명과 판단에는 강하지만,
실제 파일 수정/실행/검증은 별도 도구가 필요할 수 있다.

## 12.4 지침과 지식의 역할을 구분한다
- instructions: 압축된 행동 기준
- knowledge: 상세 보조 문서

이 구분을 유지해야 GPT Builder가 덜 혼란스럽다.

---

# 13. 권장 질문 패턴

GPT Builder에는 아래처럼 묻는 것이 좋다.

## 좋은 질문 예시
- 현재 단계에서 가장 먼저 해야 할 일을 정리해줘
- 이 통합 방향이 project charter와 맞는지 검토해줘
- Discord 결합 로직을 웹 치환 관점에서 분류해줘
- Cursor용 설계 프롬프트를 하네스 기준으로 다듬어줘
- 이번 결과를 Partial Done 기준으로 다시 정리해줘

## 덜 좋은 질문 예시
- 전체 프로젝트를 다 구현해줘
- 알아서 좋은 방향으로 다 바꿔줘
- 코드도 수정하고 검증도 끝내고 문서도 다 해줘

즉,
GPT Builder는 구체적 판단 요청에 더 잘 맞는다.

---

# 14. 이 문서의 역할

이 문서는 `office-unify` 프로젝트에서
GPT Builder를 어떤 역할로 두고,
어떤 문서를 knowledge로 넣으며,
어떤 질문에 활용해야 하는지 정리하는 운영 가이드다.

즉,
- GPT Builder의 위치
- Cursor와의 역할 분담
- knowledge 구성
- 운영 원칙
- 질문 방식

을 실무 기준으로 설명하는 문서다.

---

# 15. 결론

`office-unify` 프로젝트에서 GPT Builder는
실제 코드 통합의 주 엔진이 아니라,
**상위 원칙과 판단의 일관성을 유지하는 보조 계층**이다.

따라서 GPT Builder는
- 비전
- 용어
- 원칙
- 아키텍처 경계
- 작업 순서
- 완료 기준

을 중심으로 운영하고,

Cursor는
- 실제 코드베이스 분석
- 구현
- 검증
- 파일 단위 변경

을 중심으로 운영하는 것이 가장 안정적이다.

이 문서는 그 역할 분담을 고정하는 기준 문서다.
