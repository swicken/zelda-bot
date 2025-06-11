import { getSourceFromUrl } from '../src/app.js';

describe('getSourceFromUrl', () => {
  it('returns domain for valid urls', () => {
    expect(getSourceFromUrl('https://example.com/page')).toBe('example');
    expect(getSourceFromUrl('http://www.google.com')).toBe('google');
  });

  it('returns Unknown Source for invalid urls', () => {
    expect(getSourceFromUrl('not a url')).toBe('Unknown Source');
  });
});
