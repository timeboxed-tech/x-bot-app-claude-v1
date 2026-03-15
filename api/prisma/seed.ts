import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.post.deleteMany();
  await prisma.job.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.user.deleteMany();

  // Create users from two allowed domains
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@thestartupfactory.tech',
      name: 'Alice Johnson',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@ehe.ai',
      name: 'Bob Smith',
    },
  });

  // Create a bot for each user
  const bot1 = await prisma.bot.create({
    data: {
      userId: user1.id,
      xAccessToken: 'fake-access-token-1',
      xAccessSecret: 'fake-access-secret-1',
      xAccountHandle: '@alice_bot',
      prompt:
        'You are a friendly tech commentator. Write short, insightful tweets about software engineering trends.',
      postMode: 'auto',
      postsPerDay: 4,
      minIntervalHours: 3,
      preferredHoursStart: 8,
      preferredHoursEnd: 22,
      active: true,
    },
  });

  const bot2 = await prisma.bot.create({
    data: {
      userId: user2.id,
      xAccessToken: 'fake-access-token-2',
      xAccessSecret: 'fake-access-secret-2',
      xAccountHandle: '@bob_bot',
      prompt:
        'You are a witty startup founder. Write engaging tweets about entrepreneurship and startup culture.',
      postMode: 'manual',
      postsPerDay: 2,
      minIntervalHours: 4,
      preferredHoursStart: 9,
      preferredHoursEnd: 20,
      active: true,
    },
  });

  // Create jobs for bot1
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const job1 = await prisma.job.create({
    data: {
      type: 'draft',
      status: 'completed',
      scheduledAt: oneHourAgo,
      startedAt: oneHourAgo,
      completedAt: new Date(oneHourAgo.getTime() + 30 * 1000),
    },
  });

  const job2 = await prisma.job.create({
    data: {
      type: 'draft',
      status: 'pending',
      scheduledAt: oneHourFromNow,
    },
  });

  const job3 = await prisma.job.create({
    data: {
      type: 'publish',
      status: 'pending',
      scheduledAt: twoHoursFromNow,
    },
  });

  // Create posts
  await prisma.post.create({
    data: {
      botId: bot1.id,
      jobId: job1.id,
      content:
        'TypeScript 6.0 just dropped and the type inference improvements are mind-blowing. The future of full-stack type safety is here. 🚀',
      status: 'published',
      rating: 4,
      publishedAt: new Date(oneHourAgo.getTime() + 30 * 1000),
    },
  });

  await prisma.post.create({
    data: {
      botId: bot1.id,
      jobId: job2.id,
      content: 'Hot take: most microservices should have been monoliths. Fight me.',
      status: 'draft',
      scheduledAt: oneHourFromNow,
    },
  });

  await prisma.post.create({
    data: {
      botId: bot1.id,
      jobId: job2.id,
      content:
        'The best code review feedback is the one that teaches something new, not just catches bugs.',
      status: 'scheduled',
      rating: 5,
      scheduledAt: oneHourFromNow,
    },
  });

  await prisma.post.create({
    data: {
      botId: bot2.id,
      jobId: job3.id,
      content:
        "Lesson #47 of startup life: your MVP should be embarrassingly simple. If you're not embarrassed, you launched too late.",
      status: 'draft',
      scheduledAt: twoHoursFromNow,
    },
  });

  console.log('Seed data created successfully:');
  console.log(`  Users: ${user1.email}, ${user2.email}`);
  console.log(`  Bots: ${bot1.xAccountHandle}, ${bot2.xAccountHandle}`);
  console.log(`  Jobs: ${3} created`);
  console.log(`  Posts: ${4} created`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
