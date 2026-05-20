import Module from 'node:module';

type CliOptions = {
  confirm: boolean;
  dryRun: boolean;
  wait: boolean;
};

type RepairModule = typeof import('../lib/server/googleSheetsRepair');

const CLI_COMMAND = 'npm run google-finance-repair --workspace=apps/web -- --confirm --wait';

function installServerOnlyShim(): void {
  const moduleWithLoad = Module as unknown as {
    _load: (request: string, parent?: unknown, isMain?: boolean) => unknown;
  };
  const originalLoad = moduleWithLoad._load;
  moduleWithLoad._load = function patchedLoad(request: string, parent?: unknown, isMain?: boolean) {
    if (request === 'server-only') return {};
    return originalLoad.call(this, request, parent, isMain);
  };
}

export function parseGoogleFinanceRepairArgs(argv: string[]): CliOptions {
  const confirm = argv.includes('--confirm');
  const explicitDryRun = argv.includes('--dry-run');
  return {
    confirm,
    dryRun: explicitDryRun || !confirm,
    wait: argv.includes('--wait'),
  };
}

function line(label: string, value: unknown): string {
  return `${label}: ${String(value ?? 'unknown')}`;
}

export async function runGoogleFinanceRepairCli(
  argv = process.argv.slice(2),
  io: { write: (text: string) => void } = { write: (text) => process.stdout.write(text) },
): Promise<number> {
  const options = parseGoogleFinanceRepairArgs(argv);
  installServerOnlyShim();
  const repair = (await import('../lib/server/googleSheetsRepair')) as RepairModule;
  const result = await repair.runGoogleSheetsRepairCore({
    confirm: options.confirm,
    dryRun: options.dryRun,
    wait: options.wait,
    overwrite: false,
  });
  const plan = result.repairPlan;
  const post = result.postCheck;
  const operations = result.appliedOperations.length > 0 ? result.appliedOperations.join(', ') : '(none)';
  const appended = result.appendedAnchorSymbols?.length ? result.appendedAnchorSymbols.join(', ') : '(none)';
  const portfolioQuotesStatus =
    post?.parsedRowsOk != null
      ? post.parsedRowsOk > 0 || (post.anchorMatched ?? 0) > 0
        ? 'found'
        : 'missing_or_empty'
      : plan?.status === 'write_not_available'
        ? 'not_configured'
        : 'unknown';

  io.write(
    [
      '[Google Finance Repair]',
      line('mode', options.confirm ? 'confirm' : 'dry-run'),
      line('serviceAccount', plan?.credential.serviceAccountEmailMasked ?? 'not_configured'),
      line('portfolio_quotes', portfolioQuotesStatus),
      line('operations applied', operations),
      line('appended anchors', appended),
      'postCheck:',
      `  parsedRowsOk: ${post?.parsedRowsOk ?? 0}`,
      `  anchorMatched: ${post?.anchorMatched ?? 0}`,
      `  anchorOk: ${post?.anchorOk ?? 0}`,
      `  missingAnchors: ${(post?.missingAnchors ?? []).join(', ') || '(none)'}`,
      `  formulaPendingCount: ${result.formulaPendingCount ?? 0}`,
      'next:',
      `  ${result.recommendedNextAction ?? post?.recommendedNextAction ?? plan?.actionHint ?? '상태 확인이 필요합니다.'}`,
      'copy:',
      `  ${CLI_COMMAND}`,
      '',
    ].join('\n'),
  );

  return result.ok || options.dryRun ? 0 : 1;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/google-finance-repair-live.ts')) {
  runGoogleFinanceRepairCli().then((code) => {
    process.exitCode = code;
  });
}
