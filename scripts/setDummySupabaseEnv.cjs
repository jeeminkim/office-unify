/** ts-node self-check용: Supabase 클라이언트 모듈 로드 전에 URL이 비어 있으면 안 됨 */
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'phase1-self-check-placeholder';
}
