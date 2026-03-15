import { jobRepository } from '../repositories/jobRepository.js';
import { log } from './activityLog.js';

const RETENTION_DAYS = 7;

/**
 * Cleanup handler: deletes all completed/failed/cancelled jobs
 * older than 7 days.
 */
export async function handleCleanupJob(_jobId: string): Promise<void> {
  log('cleanup', `Cleaning jobs older than ${RETENTION_DAYS} days`);

  const result = await jobRepository.deleteOldJobs(RETENTION_DAYS);

  log('cleanup', `Deleted ${result.count} old job(s)`);
}
