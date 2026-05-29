import {
  resolveTimezone,
  fmtTime,
  hourInTz,
} from '../src/common/time.util';

describe('time.util', () => {
  describe('resolveTimezone', () => {
    it('accepts a valid IANA zone', () => {
      expect(resolveTimezone('America/New_York')).toBe('America/New_York');
    });
    it('falls back to the default for an invalid zone', () => {
      expect(resolveTimezone('Not/AZone')).toBe('Asia/Kolkata');
    });
    it('falls back to the default when missing', () => {
      expect(resolveTimezone(undefined)).toBe('Asia/Kolkata');
      expect(resolveTimezone('')).toBe('Asia/Kolkata');
    });
  });

  describe('fmtTime', () => {
    it('renders the same instant differently per timezone', () => {
      const iso = '2026-01-01T00:30:00Z';
      expect(fmtTime(iso, 'UTC')).not.toBe(fmtTime(iso, 'Asia/Kolkata'));
    });
  });

  describe('hourInTz', () => {
    it('shifts the hour by the zone offset', () => {
      const d = new Date('2026-01-01T05:30:00Z');
      expect(hourInTz('UTC', d)).toBe(5);
      expect(hourInTz('Asia/Kolkata', d)).toBe(11); // +5:30
    });
  });
});
