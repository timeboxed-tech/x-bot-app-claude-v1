import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const ALLOWED_DOMAINS = ['thestartupfactory.tech', 'ehe.ai'] as const;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const prisma = new PrismaClient();

function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

export async function generateMagicLink(email: string): Promise<{
  message: string;
  magicLink?: string;
}> {
  if (!isAllowedDomain(email)) {
    throw new Error('DOMAIN_NOT_ALLOWED');
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
      },
    });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '15m',
  });

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const magicLink = `${baseUrl}/auth/verify?token=${token}`;

  // In production, send email here. For now, return the link.
  return {
    message: 'Magic link generated! Check the API response.',
    magicLink,
  };
}

export async function verifyToken(token: string): Promise<{
  token: string;
  user: { id: string; email: string; name: string };
}> {
  const payload = jwt.verify(token, JWT_SECRET) as {
    userId: string;
    email: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Issue a longer-lived session token
  const sessionToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });

  return { token: sessionToken, user };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return user;
}
