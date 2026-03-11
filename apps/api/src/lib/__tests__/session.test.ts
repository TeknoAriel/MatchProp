import { describe, it, expect } from 'vitest';
import {
  hashToken,
  generateRefreshToken,
  getRefreshExpiry,
  getAccessExpirySeconds,
} from '../session.js';

describe('session', () => {
  describe('hashToken', () => {
    it('returns deterministic hash for same input', () => {
      const token = 'abc123';
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('returns different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('returns hex string of 64 chars', () => {
      const hash = hashToken('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns base64url string', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
    });

    it('returns different tokens each call', () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a).not.toBe(b);
    });

    it('has sufficient length (32 bytes base64url ~43 chars)', () => {
      const token = generateRefreshToken();
      expect(token.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('getRefreshExpiry', () => {
    it('returns date ~30 days in future', () => {
      const now = new Date();
      const expiry = getRefreshExpiry();
      const diffDays = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe('getAccessExpirySeconds', () => {
    it('returns 900 (15 min)', () => {
      expect(getAccessExpirySeconds()).toBe(15 * 60);
    });
  });
});
