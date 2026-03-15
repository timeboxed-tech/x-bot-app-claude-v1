import { jobRepository } from '../repositories/jobRepository.js';
import { log } from './activityLog.js';

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MINUTES = 10;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function recoverStaleLocks(): Promise<void> {
  try {
    const staleJobs = await jobRepository.findStaleRunningJobs(STALE_THRESHOLD_MINUTES);

    if (staleJobs.length === 0) return;

    log('staleLockRecovery', `Found ${staleJobs.length} stale running job(s)`);
    console.log(
      `[staleLockRecovery] Found ${staleJobs.length} stale running jobs: ${staleJobs.map((j: { id: string }) => j.id).join(', ')}`,
    );

    const result = await jobRepository.resetStaleRunning(STALE_THRESHOLD_MINUTES);

    log('staleLockRecovery', `Recovered ${result.count} stale running job(s)`, 'warn');
    console.log(`[staleLockRecovery] Recovered ${result.count} stale running jobs`);
  } catch (err) {
    console.error('[staleLockRecovery] Error recovering stale locks:', err);
  }
}

export function start(): void {
  log('staleLockRecovery', 'Starting stale lock recovery');
  console.log('[staleLockRecovery] Starting stale lock recovery');
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
