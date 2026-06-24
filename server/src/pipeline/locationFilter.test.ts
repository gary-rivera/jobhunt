import {
  DEFAULT_LOCATION_ALLOWLIST,
  getLocationAllowlist,
  matchesLocation,
} from './locationFilter';

describe('matchesLocation', () => {
  it('matches SF variants', () => {
    expect(matchesLocation('San Francisco, CA', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('San Francisco, CA, USA', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('SAN FRANCISCO', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('South San Francisco, CA', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
  });

  it('matches Remote variants', () => {
    expect(matchesLocation('Remote', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('Remote, USA', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('US - Remote', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
    expect(matchesLocation('Anywhere (Remote)', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
  });

  it('matches when both SF and Remote appear', () => {
    expect(matchesLocation('San Francisco, CA / Remote', DEFAULT_LOCATION_ALLOWLIST)).toBe(true);
  });

  it('rejects non-matching locations', () => {
    expect(matchesLocation('Paris, France', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation('Madrid, Spain', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation('New York, NY', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation('Seattle, WA', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation('San Jose, CA', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
  });

  it('rejects null/empty', () => {
    expect(matchesLocation(null, DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation('', DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
    expect(matchesLocation(undefined, DEFAULT_LOCATION_ALLOWLIST)).toBe(false);
  });

  it('uses provided allowlist, not the default', () => {
    expect(matchesLocation('New York, NY', ['new york'])).toBe(true);
    expect(matchesLocation('San Francisco, CA', ['new york'])).toBe(false);
  });
});

describe('getLocationAllowlist', () => {
  const original = process.env.LOCATION_ALLOWLIST;
  afterEach(() => {
    if (original === undefined) delete process.env.LOCATION_ALLOWLIST;
    else process.env.LOCATION_ALLOWLIST = original;
  });

  it('returns default when env is unset', () => {
    delete process.env.LOCATION_ALLOWLIST;
    expect(getLocationAllowlist()).toEqual(DEFAULT_LOCATION_ALLOWLIST);
  });

  it('parses comma-separated env, trims, lowercases', () => {
    process.env.LOCATION_ALLOWLIST = 'New York, Boston ,REMOTE';
    expect(getLocationAllowlist()).toEqual(['new york', 'boston', 'remote']);
  });

  it('falls back to default when env is empty / all whitespace', () => {
    process.env.LOCATION_ALLOWLIST = '   , ,  ';
    expect(getLocationAllowlist()).toEqual(DEFAULT_LOCATION_ALLOWLIST);
  });
});
