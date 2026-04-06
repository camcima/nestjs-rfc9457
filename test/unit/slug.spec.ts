import { toSlug } from '../../src/utils/slug';

describe('toSlug', () => {
  it('converts "Not Found" to "not-found"', () => {
    expect(toSlug('Not Found')).toBe('not-found');
  });

  it('converts "Internal Server Error" to "internal-server-error"', () => {
    expect(toSlug('Internal Server Error')).toBe('internal-server-error');
  });

  it('converts "Unprocessable Entity" to "unprocessable-entity"', () => {
    expect(toSlug('Unprocessable Entity')).toBe('unprocessable-entity');
  });

  it('converts "OK" to "ok"', () => {
    expect(toSlug('OK')).toBe('ok');
  });

  it('handles single word', () => {
    expect(toSlug('Forbidden')).toBe('forbidden');
  });

  it('trims whitespace', () => {
    expect(toSlug('  Not Found  ')).toBe('not-found');
  });

  it('collapses multiple spaces', () => {
    expect(toSlug('Internal  Server   Error')).toBe('internal-server-error');
  });

  it('strips punctuation', () => {
    expect(toSlug("I'm a Teapot")).toBe('im-a-teapot');
  });

  it('handles empty string', () => {
    expect(toSlug('')).toBe('');
  });
});
