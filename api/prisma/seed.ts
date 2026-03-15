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

  // Seed system prompts (upsert to avoid duplicates)
  await prisma.systemPrompt.upsert({
    where: { key: 'tweet_generation' },
    update: {},
    create: {
      key: 'tweet_generation',
      name: 'Tweet Generation',
      content: `You are a social media expert and skilled copywriter. Given a user's prompt, research and consider relevant topics, trends, and context, then draft a single tweet.

Rules:
- The tweet MUST be under 280 characters
- Make it engaging, authentic-sounding, and conversational
- Do not use hashtags excessively — one or two at most
- Do not include quotation marks around the tweet
- Output ONLY the tweet text, nothing else`,
    },
  });

  await prisma.systemPrompt.upsert({
    where: { key: 'tweet_tweak' },
    update: {},
    create: {
      key: 'tweet_tweak',
      name: 'Tweet Tweaking',
      content: `You are a collaborative social media editor helping refine a tweet. Have a natural conversation with the user — explain your changes, ask clarifying questions, suggest alternatives, and be a helpful creative partner.

IMPORTANT: Always end your response with the revised tweet on its own line after the marker "---TWEET---". The tweet must be under 280 characters.

Example format:
Great idea to make it punchier! I shortened the opening and added a hook question at the end. Want me to try a different angle?

---TWEET---
The actual revised tweet text here`,
    },
  });

  await prisma.systemPrompt.upsert({
    where: { key: 'tip_extraction' },
    update: {},
    create: {
      key: 'tip_extraction',
      name: 'Tip Extraction',
      content: `Analyze this conversation where a user refined a tweet draft. Extract 1-3 concise tips/preferences that should guide future tweet generation for this account. Each tip should be a single sentence. Output only the tips, one per line.`,
    },
  });

  await prisma.systemPrompt.upsert({
    where: { key: 'judge_review' },
    update: {},
    create: {
      key: 'judge_review',
      name: 'Judge Review',
      content: `You are {name}. {personalityPrompt}. \nReview the following tweet draft. Evaluate it on the following criteria:\n1. Originality — does it feel repetitive compared to recent posts?\n2. Timeliness & Relevance — does the post reference current events, recent news, or up-to-date facts? Flag any references to outdated news, old events, deprecated technologies, or information that is no longer accurate. A post that presents stale information as if it were new should be scored lower.\n3. AI Transparency — if any sentence describes the research process, explains why the topic was chosen, or reveals how the post was generated (e.g. "I found this interesting because...", "After researching...", "This caught my attention..."), heavily mark down the post. This is a clear sign of AI generation and should result in a very low score.\nIf timeliness is a concern, explicitly mention it in your opinion (e.g. "This references news from [date/period] which is no longer timely").\nProvide a concise opinion (2-3 sentences max) and rate it 1-5.\nFormat your response as: your opinion text, then on a new line exactly "Rating: X/5"`,
    },
  });

  // Seed job configs (upsert to avoid duplicates)
  await prisma.jobConfig.upsert({
    where: { jobType: 'draft' },
    update: {},
    create: { jobType: 'draft', intervalMs: 120000, enabled: true },
  });

  await prisma.jobConfig.upsert({
    where: { jobType: 'publish' },
    update: {},
    create: { jobType: 'publish', intervalMs: 60000, enabled: true },
  });

  await prisma.jobConfig.upsert({
    where: { jobType: 'cleanup' },
    update: {},
    create: { jobType: 'cleanup', intervalMs: 10800000, enabled: true },
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
