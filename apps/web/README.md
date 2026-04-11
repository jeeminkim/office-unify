# K-Dev Assistant (dev_support)

`dev_support`는 Next.js App Router + TypeScript + Tailwind 기반의 내부 Dev Assistant MVP입니다.
자연어 요구사항을 바탕으로 아래 3가지 결과를 빠르게 생성합니다.

- Flow(업무 순서도 + Mermaid)
- SQL
- TypeScript 코드

이 프로젝트는 무료 유지보수 원칙에 맞춰 서버 DB 없이 동작하며, 로컬 브라우저 저장소(localStorage)를 중심으로 운영합니다.

## 핵심 동작 방식

- Provider는 현재 `gemini` 단일 구조입니다.
- Gemini API Key는 `.env`가 아니라 UI 설정 모달에서 입력합니다.
  - 경로: 우측 상단 `설정(톱니바퀴)` -> `Gemini API Key` 입력
  - 저장 위치: 브라우저 localStorage
  - 요청 시 `/api/generate`로 일회성 전달되며 서버에 영구 저장하지 않습니다.

## Windows 새 PC 온보딩

아래 순서를 그대로 실행하세요.

```powershell
cd C:\dev_support-main\dev_support-main
npm install
npm run lint
npm run typecheck
npm run build
npm run selfcheck
npm run dev
```

개발 서버 실행 후 [http://localhost:3000](http://localhost:3000) 에 접속합니다.

## 설치/실행 트러블슈팅 (Windows)

### 1) EPERM 오류

증상 예시: `EPERM: operation not permitted, unlink ...`

점검 순서:
1. 실행 중인 Node 프로세스 종료
2. 에디터/터미널에서 해당 폴더를 점유 중인지 확인
3. `npm run clean:win` 실행 후 `npm install` 재시도
4. 필요 시 백신/보안 소프트웨어의 실시간 감시 예외에 프로젝트 폴더 추가

### 2) ENOTEMPTY 오류

증상 예시: `ENOTEMPTY: directory not empty, rmdir ...`

점검 순서:
1. `npm run clean:win` 실행
2. `npm cache verify`
3. `npm install` 재시도

### 3) ERR_SSL_CIPHER_OPERATION_FAILED

증상 예시: `npm ERR! code ERR_SSL_CIPHER_OPERATION_FAILED`

점검 순서:
1. 사내 프록시/보안SW(SSL inspection) 여부 확인
2. 네트워크를 변경해 재시도(예: 사내망 -> 외부망)
3. `npm config get registry`로 registry 확인 (`https://registry.npmjs.org/`)
4. 문제가 지속되면 사내 보안 정책 담당자에게 OpenSSL/TLS 가로채기 여부 확인

## localStorage 저장 데이터

- `dev_assistant_settings`: API Key 설정
- `dev_assistant_draft`: 작성 중 초안 프롬프트
- `dev_assistant_recent`: 최근 결과(최대 5개)
- `dev_assistant_feedback`: 결과 피드백 집계(helpful / notHelpful)

## 보안 및 사용 주의

- API Key와 민감 프롬프트는 localStorage에 남을 수 있습니다.
- 공용 PC에서는 사용 후 설정 모달의 `전체 초기화`를 권장합니다.
- 개인정보/고객정보/운영 비밀이 포함된 프롬프트는 입력하지 마세요.
- 생성 결과(SQL/코드)는 반드시 사람이 검토 후 사용하세요.

## 제공 스크립트

- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 빌드 결과 실행
- `npm run lint`: ESLint 검사
- `npm run typecheck`: TypeScript 타입 검사
- `npm run selfcheck`: 프로젝트 구조/스크립트/키 정의 점검
- `npm run clean:win`: Windows 환경에서 `.next`, `node_modules` 정리
