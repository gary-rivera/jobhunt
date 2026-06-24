import { computeDedupeKey } from './dedupe';

describe('computeDedupeKey', () => {
  it('produces a deterministic sha256 hex digest', () => {
    const key = computeDedupeKey('Senior Engineer', 'Acme', 'Remote');
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(computeDedupeKey('Senior Engineer', 'Acme', 'Remote')).toBe(key);
  });

  it('is case-insensitive', () => {
    expect(computeDedupeKey('Senior Engineer', 'Acme', 'Remote'))
      .toBe(computeDedupeKey('senior engineer', 'ACME', 'remote'));
  });

  it('normalizes whitespace', () => {
    expect(computeDedupeKey('Senior  Engineer', 'Acme', 'Remote'))
      .toBe(computeDedupeKey('Senior Engineer', 'Acme', 'Remote'));
    expect(computeDedupeKey(' Senior Engineer ', 'Acme', 'Remote'))
      .toBe(computeDedupeKey('Senior Engineer', 'Acme', 'Remote'));
  });

  it('strips trailing punctuation in company names', () => {
    expect(computeDedupeKey('Engineer', 'Acme, Inc.', 'Remote'))
      .toBe(computeDedupeKey('Engineer', 'Acme Inc', 'Remote'));
  });

  it('produces different keys for genuinely different inputs', () => {
    expect(computeDedupeKey('Engineer', 'Acme', 'Remote'))
      .not.toBe(computeDedupeKey('Engineer', 'Acme', 'NYC'));
    expect(computeDedupeKey('Engineer', 'Acme', 'Remote'))
      .not.toBe(computeDedupeKey('Senior Engineer', 'Acme', 'Remote'));
  });
});
