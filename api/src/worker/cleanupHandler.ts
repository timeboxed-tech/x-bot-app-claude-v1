import { prisma } from '../utils/prisma.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { log } from './activityLog.js';

const RETENTION_DAYS = 7;

export async function handleCleanupJob(_jobId: string): Promise<string> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // 1. Expire drafts older than 7 days -> discarded
  const expiredDrafts = await prisma.post.updateMany({
    where: {
      status: 'draft',
      createdAt: { lt: cutoff },
    },
    data: { status: 'discarded' },
  });
  if (expiredDrafts.count > 0) {
    log('cleanup', `Expired ${expiredDrafts.count} stale draft(s) to discarded`);
  }

  // 2. Hard-delete discarded posts older than 7 days (and their reviews/evaluations)
  const oldDiscarded = await prisma.post.findMany({
    where: {
      status: 'discarded',
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  if (oldDiscarded.length > 0) {
    const postIds = oldDiscarded.map((p) => p.id);
    await prisma.$transaction(async (tx) => {
      await tx.postReview.deleteMany({ where: { postId: { in: postIds } } });
      await tx.postEvaluation.deleteMany({ where: { postId: { in: postIds } } });
      await tx.post.deleteMany({ where: { id: { in: postIds } } });
    });
    log('cleanup', `Hard-deleted ${oldDiscarded.length} old discarded post(s)`);
  }

  // 3. Hard-delete old completed/failed/cancelled jobs
  const result = await jobRepository.deleteOldJobs(RETENTION_DAYS);
  log('cleanup', `Deleted ${result.count} old job(s)`);

  const message = `Expired ${expiredDrafts.count} draft(s), deleted ${oldDiscarded.length} discarded post(s), deleted ${result.count} old job(s)`;
  return message;
}
