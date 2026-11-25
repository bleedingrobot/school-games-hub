import { describe, expect, it } from 'vitest';
import { parseOnlineNow } from './onlineNow';

describe('parseOnlineNow', () => {
  it('reads the school and class counts', () => {
    expect(parseOnlineNow({ school: 12, class: 3 })).toEqual({ school: 12, class: 3 });
    expect(parseOnlineNow({ school: 4 })).toEqual({ school: 4 });
  });
  it('refuses anything that is not a count', () => {
    expect(parseOnlineNow(null)).toBeNull();
    expect(parseOnlineNow({ school: -1 })).toBeNull();
    expect(parseOnlineNow({ school: '5' })).toBeNull();
  });
});
