# `apps/web` — Office Unify 웹 앱

Next.js(App Router) + TypeScript + Tailwind입니다. **저장소 루트(`../..`)의 `README.md`**에 모노레포 구조·배포·Supabase·환경 변수 전체가 정리되어 있습니다.

## 이 폴더에서 하는 일

- **Dev Assistant** (`/`): Flow/ Mermaid, SQL, TypeScript 생성 — Gemini는 UI 설정 또는 서버 `GEMINI_API_KEY` 사용.
- **Persona chat**, **Private Banker**, **투자위원회**, **포트폴리오 원장** 등: Supabase + 서버 API 라우트.

## 로컬 실행

저장소 **루트**에서:

```bash
cd ../..
npm install
npm run dev
```

`apps/web`만 열어 `npm install` 하면 workspace 패키지가 없어 실패합니다.

## 환경 변수

`apps/web/.env.local` (Git 무시). 키 목록은 **루트 `README.md`** 참고.

## Windows 트러블슈팅

```powershell
npm run clean:win   # apps/web 전용 — .next / node_modules 정리
```

- `EPERM` / `ENOTEMPTY`: 프로세스 종료 후 `clean:win` → `npm install` 재시도
- `ERR_SSL_CIPHER_OPERATION_FAILED`: 프록시/네트워크·registry 확인

## localStorage (Dev Assistant)

- `dev_assistant_settings`: API Key 등(설정 모달)
- 기타 초안·최근 결과·피드백 키 — 상세는 기존 주석/코드 참고

민감 정보는 공용 PC에서 사용 후 설정에서 초기화를 권장합니다.
