import { cleanDescription } from './html';

describe('cleanDescription', () => {
  it('returns empty string for empty input', () => {
    expect(cleanDescription('')).toBe('');
  });

  it('strips HTML tags', () => {
    expect(cleanDescription('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes common HTML entities', () => {
    expect(cleanDescription('A &amp; B')).toBe('A & B');
    expect(cleanDescription('Cafe&nbsp;Acme')).toBe('Cafe Acme');
    expect(cleanDescription('quote&apos;s and &quot;quotes&quot;')).toBe('quote\'s and "quotes"');
    expect(cleanDescription('a&lt;b&gt;c')).toBe('a<b>c');
  });

  it('collapses whitespace and trims', () => {
    expect(cleanDescription('  hello   \n\n   world  ')).toBe('hello world');
  });

  it('replaces unknown entities with a space', () => {
    expect(cleanDescription('foo&unknownentity;bar')).toBe('foo bar');
  });

  it('strips tags and decodes entities together', () => {
    expect(cleanDescription('<p>Acme&nbsp;Inc. &amp; Co.</p>')).toBe('Acme Inc. & Co.');
  });
});
