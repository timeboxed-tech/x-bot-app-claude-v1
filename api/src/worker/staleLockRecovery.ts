import { jobRepository } from '../repositories/jobRepository.js';
import { log } from './activityLog.js';

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MINUTES = 10;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function recoverStaleLocks(): Promise<void> {
  try {
    const staleJobs = await jobRepository.findStaleLockedJobs(STALE_THRESHOLD_MINUTES);

    log('staleLockRecovery', `Poll: found ${staleJobs.length} stale lock(s)`);

    if (staleJobs.length === 0) {
      return;
    }

    console.log(
      `[staleLockRecovery] Found ${staleJobs.length} stale locked jobs: ${staleJobs.map((j: { id: string }) => j.id).join(', ')}`,
    );

    const result = await jobRepository.resetStaleLocks(STALE_THRESHOLD_MINUTES);

    log('staleLockRecovery', `Recovered ${result.count} stale locked job(s)`, 'warn');
    console.log(`[staleLockRecovery] Recovered ${result.count} stale locked jobs`);
  } catch (err) {
    console.error('[staleLockRecovery] Error recovering stale locks:', err);
  }
}

export function start(): void {
  console.log('[staleLockRecovery] Starting stale lock recovery');
  // Run immediately on start
  void recoverStaleLocks();
  intervalHandle = setInterval(() => void recoverStaleLocks(), RECOVERY_INTERVAL_MS);
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[staleLockRecovery] Stopped');
}
