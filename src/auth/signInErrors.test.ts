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

});
