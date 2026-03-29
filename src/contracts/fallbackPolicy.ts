export type FallbackPolicyScope = 'provider' | 'db_persist' | 'quote';

export type FallbackPolicyResult = {
  scope: FallbackPolicyScope;
  applied: boolean;
  degradedMode: boolean;
  reason: string | null;
};

export function providerFallbackResult(applied: boolean, reason: string | null): FallbackPolicyResult {
  return { scope: 'provider', applied, degradedMode: applied, reason };
}

export function dbPersistFallbackResult(applied: boolean, reason: string | null): FallbackPolicyResult {
  return { scope: 'db_persist', applied, degradedMode: false, reason };
}

export function quoteFallbackResult(applied: boolean, reason: string | null): FallbackPolicyResult {
  return { scope: 'quote', applied, degradedMode: applied, reason };
}

