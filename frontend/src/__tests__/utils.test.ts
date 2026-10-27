import { describe, expect, it } from 'vitest';
import { safeHref, formatDate } from '../utils';
import { translate } from '../i18n';
import en from '../i18n/en';
import hi from '../i18n/hi';

describe('safeHref', () => {
  it('allows https and rejects other protocols', () => {
    expect(safeHref('https://www.myscheme.gov.in/')).toBe('https://www.myscheme.gov.in/');
    expect(safeHref('http://example.com')).toBeUndefined();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>')).toBeUndefined();
    expect(safeHref('not a url')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });
});

describe('i18n', () => {
  it('returns Hindi when present and falls back to English when missing', () => {
    expect(translate('hi', 'nav.home')).toBe(hi['nav.home']);
    expect(translate('hi', 'nav.home')).not.toBe(en['nav.home']);
    expect(translate('hi', 'admin.audit')).toBe(en['admin.audit']);
  });
  it('Hindi dictionary only uses keys that exist in English', () => {
    for (const k of Object.keys(hi)) expect(k in en).toBe(true);
  });
  it('formats empty dates as empty string', () => {
    expect(formatDate(null)).toBe('');
  });
});
