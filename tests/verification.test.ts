import { describe, it, expect } from 'vitest';
import {
  mapStripeStatus,
  profileNeedsVerification,
} from '@/lib/verification';
import type { Profile } from '@/lib/supabase/types';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    verification_status: 'unverified',
    verification_required: true,
    ...overrides,
  } as Profile;
}

describe('mapStripeStatus', () => {
  it('maps every Stripe status we handle', () => {
    expect(mapStripeStatus('verified')).toBe('verified');
    expect(mapStripeStatus('processing')).toBe('pending');
    expect(mapStripeStatus('requires_input')).toBe('requires_input');
    expect(mapStripeStatus('canceled')).toBe('failed');
  });

  it('fails closed on a status Stripe adds later', () => {
    // Unknown statuses must not read as verified.
    expect(
      mapStripeStatus('something_new' as Parameters<typeof mapStripeStatus>[0])
    ).toBe('failed');
  });
});

describe('profileNeedsVerification', () => {
  it('requires verification when there is no profile', () => {
    expect(profileNeedsVerification(null)).toBe(true);
    expect(profileNeedsVerification(undefined)).toBe(true);
  });

  it('requires verification for every non-verified status', () => {
    for (const status of [
      'unverified',
      'pending',
      'requires_input',
      'failed',
    ] as const) {
      expect(
        profileNeedsVerification(profile({ verification_status: status }))
      ).toBe(true);
    }
  });

  it('clears once verified', () => {
    expect(
      profileNeedsVerification(profile({ verification_status: 'verified' }))
    ).toBe(false);
  });

  it('honours the verification_required bypass', () => {
    // This flag is an unconditional bypass. The test exists to make that
    // visible: two live accounts carry it.
    expect(
      profileNeedsVerification(
        profile({ verification_status: 'unverified', verification_required: false })
      )
    ).toBe(false);
  });
});
