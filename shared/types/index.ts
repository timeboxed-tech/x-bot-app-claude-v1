// Shared types matching the Prisma data model

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'discarded' | 'approved';
export type PostMode = 'auto' | 'manual' | 'with-approval';
export type JobType = 'draft' | 'publish' | 'cleanup';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Bot {
  id: string;
  userId: string;
  xAccessToken: string;
  xAccessSecret: string;
  xAccountHandle: string;
  prompt: string;
  postMode: PostMode;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  active: boolean;
  createdAt: Date;
}

export interface Post {
  id: string;
  botId: string;
  jobId: string;
  content: string;
  status: PostStatus;
  rating: number | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface Job {
  id: string;
  type: JobType;
  botId: string | null;
  status: JobStatus;
  lockToken: string | null;
  lockedAt: Date | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// API request/response types
export interface CreateBotRequest {
  prompt: string;
  postMode: PostMode;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
}

export interface UpdateBotRequest {
  prompt?: string;
  postMode?: PostMode;
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  active?: boolean;
}

export interface UpdatePostRequest {
  content?: string;
  rating?: number | null;
  status?: 'scheduled' | 'discarded' | 'approved';
  scheduledAt?: Date;
}

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  message: string;
  magicLink?: string; // Only in dev mode
}

// Allowed email domains
export const ALLOWED_DOMAINS = ['thestartupfactory.tech', 'ehe.ai'] as const;
