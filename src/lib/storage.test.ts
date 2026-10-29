import { readJSON, removeKey, writeJSON } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('storage', () => {
  it('writes and reads JSON under the wissel. prefix', () => {
    writeJSON('thing', { a: 1, b: ['x'] });
    expect(localStorage.getItem('wissel.thing')).toBe('{"a":1,"b":["x"]}');
    expect(readJSON('thing', null)).toEqual({ a: 1, b: ['x'] });
  });

  it('returns the fallback for missing keys and corrupt JSON', () => {
    expect(readJSON('missing', 'fallback')).toBe('fallback');
    localStorage.setItem('wissel.bad', '{not json');
    expect(readJSON('bad', 7)).toBe(7);
  });

  it('removes a key', () => {
    writeJSON('gone', 1);
    removeKey('gone');
    expect(localStorage.getItem('wissel.gone')).toBeNull();
  });

  it('swallows storage errors (private mode, quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => writeJSON('x', 1)).not.toThrow();
    expect(readJSON('x', 'fb')).toBe('fb');
    expect(() => removeKey('x')).not.toThrow();
  });
});
