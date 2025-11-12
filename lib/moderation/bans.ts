import type { ActiveUserBan, BanDurationLabel, UserBan } from '@/lib/supabase/types';

const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = MS_IN_SECOND * 60;
const MS_IN_HOUR = MS_IN_MINUTE * 60;
const MS_IN_DAY = MS_IN_HOUR * 24;
const BAN_DURATION_MAP: Record<Exclude<BanDurationLabel, 'custom'>, number> = {
  '1d': MS_IN_DAY,
  '1w': MS_IN_DAY * 7,
  '1m': MS_IN_DAY * 30,
  '1y': MS_IN_DAY * 365,
};

export function isBanActive(ban: UserBan | null | undefined, now = Date.now()): ban is ActiveUserBan {
  if (!ban || ban.lifted_at) return false;
  const start = new Date(ban.starts_at).getTime();
  const end = new Date(ban.ends_at).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}

export function getBanRemainingMs(ban: UserBan | null | undefined, now = Date.now()): number | null {
  if (!isBanActive(ban, now)) return null;
  const end = new Date(ban.ends_at).getTime();
  return Math.max(end - now, 0);
}

export function getBanRemainingSeconds(ban: UserBan | null | undefined): number | null {
  const ms = getBanRemainingMs(ban);
  if (ms === null) return null;
  return Math.ceil(ms / MS_IN_SECOND);
}

export function resolveBanWindow(
  durationLabel: BanDurationLabel,
  options: { customEndsAt?: string; startsAt?: Date } = {}
): { startsAt: string; endsAt: string } {
  const startsAtDate = options.startsAt ?? new Date();

  if (durationLabel === 'custom') {
    if (!options.customEndsAt) {
      throw new Error('Custom bans require a customEndsAt value');
    }
    const customEnd = new Date(options.customEndsAt);
    if (Number.isNaN(customEnd.getTime()) || customEnd <= startsAtDate) {
      throw new Error('Invalid custom ban end time');
    }
    return { startsAt: startsAtDate.toISOString(), endsAt: customEnd.toISOString() };
  }

  const durationMs = BAN_DURATION_MAP[durationLabel];
  if (!durationMs) {
    throw new Error(`Unsupported ban duration label: ${durationLabel}`);
  }

  const end = new Date(startsAtDate.getTime() + durationMs);
  return { startsAt: startsAtDate.toISOString(), endsAt: end.toISOString() };
}
