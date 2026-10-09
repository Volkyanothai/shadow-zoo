import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, onLocaleChange, setLocale, t } from './i18n';

afterEach(() => { vi.unstubAllGlobals(); setLocale('th'); });
describe('interface language', () => {
  it('switches translated status text and named values without notifying twice', () => {
    setLocale('th');
    const changed = vi.fn(), unsubscribe = onLocaleChange(changed);
    expect(t('roundStatus', { round: 2, status: t('getReady') })).toBe('ยกที่ 2 · เตรียมพร้อม');
    setLocale('en'); setLocale('en');
    expect(t('roundStatus', { round: 2, status: t('getReady') })).toBe('ROUND 2 · GET READY');
    expect(changed).toHaveBeenCalledExactlyOnceWith('en');
    unsubscribe();
  });
  it('persists a selection and still switches if browser storage is unavailable', () => {
    const save = vi.fn();
    vi.stubGlobal('localStorage', { setItem: save });
    setLocale('en');
    expect(save).toHaveBeenCalledWith('shadow-zoo-locale', 'en');
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('Storage disabled'); } });
    expect(() => setLocale('th')).not.toThrow();
    expect(getLocale()).toBe('th');
    expect(t('start')).toBe('เข้าเกม');
  });
});
