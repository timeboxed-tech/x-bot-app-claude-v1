import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getBotForUser(userId: string) {
  return prisma.bot.findFirst({
    where: { userId },
    select: {
      id: true,
      xAccountHandle: true,
      prompt: true,
      postMode: true,
      postsPerDay: true,
      minIntervalHours: true,
      preferredHoursStart: true,
      preferredHoursEnd: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function createBot(
  userId: string,
  data: {
    prompt: string;
    postMode: string;
    postsPerDay: number;
    minIntervalHours: number;
    preferredHoursStart: number;
    preferredHoursEnd: number;
  },
) {
  return prisma.bot.create({
    data: {
      userId,
      xAccessToken: '',
      xAccessSecret: '',
      xAccountHandle: '',
      ...data,
      active: true,
    },
    select: {
      id: true,
      xAccountHandle: true,
      prompt: true,
      postMode: true,
      postsPerDay: true,
      minIntervalHours: true,
      preferredHoursStart: true,
      preferredHoursEnd: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function updateBot(
  botId: string,
  userId: string,
  data: {
    prompt?: string;
    postMode?: string;
    postsPerDay?: number;
    minIntervalHours?: number;
    preferredHoursStart?: number;
    preferredHoursEnd?: number;
    active?: boolean;
  },
) {
  // Verify ownership
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId },
  });
  if (!bot) {
    throw new Error('BOT_NOT_FOUND');
  }

  return prisma.bot.update({
    where: { id: botId },
    data,
    select: {
      id: true,
      xAccountHandle: true,
      prompt: true,
      postMode: true,
      postsPerDay: true,
      minIntervalHours: true,
      preferredHoursStart: true,
      preferredHoursEnd: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function updateBotXCredentials(
  botId: string,
  userId: string,
  xAccessToken: string,
  xAccessSecret: string,
  xAccountHandle: string,
) {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId },
  });
  if (!bot) {
    throw new Error('BOT_NOT_FOUND');
  }

  return prisma.bot.update({
    where: { id: botId },
    data: {
      xAccessToken,
      xAccessSecret,
      xAccountHandle,
    },
    select: {
      id: true,
      xAccountHandle: true,
    },
  });
}
