import { assertEuEctdEnabled } from '@/lib/external/eu-ectd';
import { assertFdaEstarEnabled } from '@/lib/external/fda-estar';
import { FEATURE_FLAGS, FeatureNotAvailableError, isFeatureEnabled } from '@/lib/feature-flags';
import { describe, expect, it } from 'vitest';

// FEATURE_FLAGS is evaluated at module load time from env vars.
// In the test environment NEXT_PUBLIC_FEATURE_EU_ECTD and
// NEXT_PUBLIC_FEATURE_FDA_ESTAR are not set, so both flags are false by default.

describe('FEATURE_FLAGS', () => {
  it('EU_ECTD_CORPUS is a boolean', () => {
    expect(typeof FEATURE_FLAGS.EU_ECTD_CORPUS).toBe('boolean');
  });

  it('FDA_ESTAR_CORPUS is a boolean', () => {
    expect(typeof FEATURE_FLAGS.FDA_ESTAR_CORPUS).toBe('boolean');
  });

  it('EU_ECTD_CORPUS defaults to false when env var is absent', () => {
    // In CI the env var is not set, so the flag must be false.
    if (!process.env.NEXT_PUBLIC_FEATURE_EU_ECTD) {
      expect(FEATURE_FLAGS.EU_ECTD_CORPUS).toBe(false);
    }
  });

  it('FDA_ESTAR_CORPUS defaults to false when env var is absent', () => {
    if (!process.env.NEXT_PUBLIC_FEATURE_FDA_ESTAR) {
      expect(FEATURE_FLAGS.FDA_ESTAR_CORPUS).toBe(false);
    }
  });
});

describe('isFeatureEnabled', () => {
  it('returns FEATURE_FLAGS[EU_ECTD_CORPUS]', () => {
    expect(isFeatureEnabled('EU_ECTD_CORPUS')).toBe(FEATURE_FLAGS.EU_ECTD_CORPUS);
  });

  it('returns FEATURE_FLAGS[FDA_ESTAR_CORPUS]', () => {
    expect(isFeatureEnabled('FDA_ESTAR_CORPUS')).toBe(FEATURE_FLAGS.FDA_ESTAR_CORPUS);
  });

  it('returns a boolean for every known flag', () => {
    for (const flag of Object.keys(FEATURE_FLAGS) as (keyof typeof FEATURE_FLAGS)[]) {
      expect(typeof isFeatureEnabled(flag)).toBe('boolean');
    }
  });
});

describe('FeatureNotAvailableError', () => {
  it('has name FeatureNotAvailableError', () => {
    const err = new FeatureNotAvailableError('EU_ECTD_CORPUS');
    expect(err.name).toBe('FeatureNotAvailableError');
  });

  it('includes the flag name in the message', () => {
    const err = new FeatureNotAvailableError('FDA_ESTAR_CORPUS');
    expect(err.message).toContain('FDA_ESTAR_CORPUS');
  });

  it('is an instance of Error', () => {
    expect(new FeatureNotAvailableError('EU_ECTD_CORPUS')).toBeInstanceOf(Error);
  });

  it('message includes the env var hint for EU_ECTD_CORPUS', () => {
    const err = new FeatureNotAvailableError('EU_ECTD_CORPUS');
    expect(err.message).toContain('NEXT_PUBLIC_FEATURE_EU_ECTD_CORPUS');
  });

  it('message includes the env var hint for FDA_ESTAR_CORPUS', () => {
    const err = new FeatureNotAvailableError('FDA_ESTAR_CORPUS');
    expect(err.message).toContain('NEXT_PUBLIC_FEATURE_FDA_ESTAR_CORPUS');
  });
});

describe('assertEuEctdEnabled (eu-ectd gate)', () => {
  it('throws FeatureNotAvailableError when EU_ECTD_CORPUS flag is false', () => {
    // In test environment the flag is false by default.
    if (!FEATURE_FLAGS.EU_ECTD_CORPUS) {
      expect(() => assertEuEctdEnabled()).toThrow(FeatureNotAvailableError);
    }
  });

  it('thrown error name is FeatureNotAvailableError', () => {
    if (!FEATURE_FLAGS.EU_ECTD_CORPUS) {
      try {
        assertEuEctdEnabled();
      } catch (err) {
        expect((err as Error).name).toBe('FeatureNotAvailableError');
      }
    }
  });
});

describe('assertFdaEstarEnabled (fda-estar gate)', () => {
  it('throws FeatureNotAvailableError when FDA_ESTAR_CORPUS flag is false', () => {
    if (!FEATURE_FLAGS.FDA_ESTAR_CORPUS) {
      expect(() => assertFdaEstarEnabled()).toThrow(FeatureNotAvailableError);
    }
  });

  it('thrown error name is FeatureNotAvailableError', () => {
    if (!FEATURE_FLAGS.FDA_ESTAR_CORPUS) {
      try {
        assertFdaEstarEnabled();
      } catch (err) {
        expect((err as Error).name).toBe('FeatureNotAvailableError');
      }
    }
  });
});
