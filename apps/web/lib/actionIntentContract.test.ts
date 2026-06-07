import { describe, expect, it } from 'vitest';
import { ACTION_INTENT_LABELS, actionIntentLabel, assertNoForbiddenActionIntentCopy } from '@/lib/actionIntentContract';

describe('actionIntentContract', () => {
  it('maps every intent to deterministic user-facing copy', () => {
    expect(actionIntentLabel('navigate_only')).toContain('화면 이동');
    expect(actionIntentLabel('read_only_check')).toContain('변경하지 않습니다');
    expect(actionIntentLabel('confirmed_write')).toContain('확인 후');
    expect(actionIntentLabel('copy_only')).toContain('복사');
    expect(actionIntentLabel('disabled')).toContain('사용할 수 없습니다');
    expect(Object.keys(ACTION_INTENT_LABELS)).toHaveLength(10);
  });

  it('does not include forbidden automatic execution wording', () => {
    expect(assertNoForbiddenActionIntentCopy()).toBe(true);
  });
});
