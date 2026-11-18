import type { Reporter, TestCase } from 'vitest/node';

/**
 * In the PR checks a failed test gets one more go (vite.config.ts `retry`), so a random failure doesn't block the PR.
 * But a test that needed that second go is flaky and must still be fixed: this puts a yellow warning on the PR's checks
 * naming it, so it can't hide.
 */
export default class FlakyReporter implements Reporter {
  onTestCaseResult(test: TestCase) {
    if (!test.diagnostic()?.flaky) return;
    const where = test.module.relativeModuleId;
    console.log(`::warning file=${where},title=Flaky test (failed, then passed on a second go)::${test.fullName}: fix it (docs/TESTING.md)`);
  }
}
