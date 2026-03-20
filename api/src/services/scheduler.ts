export type BotScheduleConfig = {
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number; // 0-23
  preferredHoursEnd: number; // 1-24
  timezone: string; // IANA timezone e.g. "America/New_York"
};

export type PostingContext = {
  lastPublishedOrScheduledAt: Date | null;
  existingPostDates: Date[];
};

/**
 * Returns the fractional hour (e.g., 14.5 for 2:30 PM) in the given timezone.
 */
function getLocalHour(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  // Intl may return hour=24 for midnight in some locales; normalize to 0
  const normalizedHour = hour === 24 ? 0 : hour;
  return normalizedHour + minute / 60;
}

/**
 * Returns a YYYY-MM-DD string for the given date in the given timezone.
 */
function getLocalDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Scans forward from NOW() in 1-hour increments to find the first valid slot.
 * Returns null if no valid slot found within searchWindowHours.
 */
export function findNextScheduledSlot(
  config: BotScheduleConfig,
  context: PostingContext,
  searchWindowHours: number,
): Date | null {
  const { postsPerDay, minIntervalHours, preferredHoursStart, preferredHoursEnd, timezone } =
    config;
  const { lastPublishedOrScheduledAt, existingPostDates } = context;

  const now = new Date();

  // Compute jitter factors once per call
  const windowJitterFactor = 0.9 + Math.random() * 0.2;
  const gapJitterFactor = 0.9 + Math.random() * 0.2;
  const capJitterFactor = 0.9 + Math.random() * 0.2;

  // Jittered min interval in milliseconds
  const jitteredMinIntervalMs = minIntervalHours * gapJitterFactor * 60 * 60 * 1000;

  // Jittered daily cap
  const jitteredCap = Math.max(1, Math.round(postsPerDay * capJitterFactor));

  // Jittered allowed-hours window
  const windowWidth = preferredHoursEnd - preferredHoursStart; // in hours
  const allHoursAllowed = preferredHoursStart === 0 && preferredHoursEnd === 24;

  let jitteredStart = preferredHoursStart;
  let jitteredEnd = preferredHoursEnd;

  if (!allHoursAllowed) {
    const windowMinutes = windowWidth * 60;
    const jitteredWindowMinutes = windowMinutes * windowJitterFactor;
    const deltaMinutes = (jitteredWindowMinutes - windowMinutes) / 2;
    jitteredStart = preferredHoursStart - deltaMinutes / 60;
    jitteredEnd = preferredHoursEnd + deltaMinutes / 60;
  }

  for (let i = 0; i <= searchWindowHours; i++) {
    const candidate = new Date(now.getTime() + i * 60 * 60 * 1000);

    // 1. Allowed hours check
    if (!allHoursAllowed) {
      const localHour = getLocalHour(candidate, timezone);
      if (localHour < jitteredStart || localHour >= jitteredEnd) {
        continue;
      }
    }

    // 2. Min gap check
    if (lastPublishedOrScheduledAt) {
      const gap = candidate.getTime() - lastPublishedOrScheduledAt.getTime();
      if (gap < jitteredMinIntervalMs) {
        continue;
      }
    }

    // 3. Daily cap check — count existing posts on the same calendar day
    const candidateDayStr = getLocalDateString(candidate, timezone);
    const dailyCount = existingPostDates.filter(
      (d) => getLocalDateString(d, timezone) === candidateDayStr,
    ).length;
    if (dailyCount >= jitteredCap) {
      continue;
    }

    // All checks passed — apply ±5 minute random offset
    const offsetMs = (Math.random() * 10 - 5) * 60 * 1000;
    return new Date(candidate.getTime() + offsetMs);
  }

  return null;
}
