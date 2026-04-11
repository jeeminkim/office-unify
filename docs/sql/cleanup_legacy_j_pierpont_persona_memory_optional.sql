-- 선택(수동 실행): PB 장기 기억을 `j-pierpont-lt`로 이전한 뒤, 예전 `j-pierpont` 전용 persona_memory 행을 정리할 때
--
-- 배경:
-- - 채팅 세션 키: persona_key = `j-pierpont` (web_persona_chat_*)
-- - 현재 장기 기억 쓰기: persona_name = `j-pierpont-lt` (persona_memory)
-- - 과거에는 장기 기억이 `j-pierpont` 행에만 있을 수 있음(읽기 시 LT로 이관되지만 행이 남을 수 있음)
--
-- 주의:
-- - 반드시 백업·스테이징에서 SELECT로 확인 후 운영에 적용한다.
-- - 자동 삭제 스크립트는 두지 않았다. 아래는 운영자가 검토 후 실행한다.
-- - `discord_user_id` = OfficeUserKey(웹), `persona_name` = 텍스트 슬러그

-- 1) 확인: 레거시 후보 행만 조회 (삭제 전)
-- SELECT discord_user_id, persona_name, left(last_feedback_summary, 120) AS head, updated_at
-- FROM persona_memory
-- WHERE persona_name = 'j-pierpont'
-- ORDER BY updated_at DESC;

-- 2) 같은 사용자에 대해 `j-pierpont-lt` 행이 이미 있고 내용이 비어 있지 않은지 확인한 뒤
--    레거시 행 삭제를 검토한다. (조건은 운영 정책에 맞게 조정)

-- 예시(주석 해제 후 실행 — 위험하므로 운영 승인 필수):
-- DELETE FROM persona_memory
-- WHERE persona_name = 'j-pierpont'
--   AND discord_user_id = '<OfficeUserKey 문자열>';
