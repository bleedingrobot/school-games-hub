import { describe, expect, it } from 'vitest';
import { readSignInError } from './signInErrors';

const BASE = 'https://bleedingrobot.github.io/school-games-hub/';

describe('readSignInError', () => {
  it('ignores normal addresses', () => {
    expect(readSignInError(`${BASE}#/lobby`)).toBeNull();
    expect(readSignInError(`${BASE}?code=abc#/`)).toBeNull();
  });

  it('explains a non-school account', () => {
    const result = readSignInError(
      `${BASE}?error=access_denied&error_code=hook_error&error_description=Please+sign+in+with+your+school+Google+account.#/`,
    );
    expect(result?.message).toMatch(/isn't a Douglas Park school account/);
    expect(result?.cleanHref).toBe(`${BASE}#/sign-in`);
  });

  it('reads errors from the # part too', () => {
    expect(readSignInError(`${BASE}#error=server_error&error_description=Database+error`)?.message).toMatch(
      /Something went wrong/,
    );
  });

  it('treats a cancelled Google screen kindly', () => {
    expect(readSignInError(`${BASE}?error=access_denied#/`)?.message).toMatch(/cancelled/);
  });

  it('never shows technical details', () => {
    const result = readSignInError(`${BASE}?error=server_error&error_description=pq:+relation+auth.users+xyz`);
    expect(result?.message).not.toMatch(/relation|auth\.users|pq/);
  });
});
