import { describe, expect, it } from 'vitest';
import {
  collectCollapsiblePaths,
  collapsibleChildCount,
  formatJson,
  tryParseJson,
} from '@yanshuf/shared';

describe('tryParseJson', () => {
  it('parses valid JSON objects', () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses valid JSON arrays', () => {
    expect(tryParseJson('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns null for invalid JSON', () => {
    expect(tryParseJson('{invalid')).toBeNull();
    expect(tryParseJson('')).toBeNull();
  });
});

describe('formatJson', () => {
  it('pretty-prints valid JSON', () => {
    expect(formatJson('{"a":1,"b":[2,3]}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
    );
  });

  it('returns null for invalid JSON', () => {
    expect(formatJson('not-json')).toBeNull();
  });
});

describe('collectCollapsiblePaths', () => {
  it('collects paths for nested objects and arrays', () => {
    const value = {
      users: [{ id: 1 }, { id: 2 }],
      meta: { ok: true },
    };

    expect(collectCollapsiblePaths(value)).toEqual([
      '$',
      '$.users',
      '$.users[0]',
      '$.users[1]',
      '$.meta',
    ]);
  });
});

describe('collapsibleChildCount', () => {
  it('counts object keys and array items', () => {
    expect(collapsibleChildCount({ a: 1, b: 2 })).toBe(2);
    expect(collapsibleChildCount([1, 2, 3])).toBe(3);
  });
});
