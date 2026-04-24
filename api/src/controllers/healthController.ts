import { Request, Response } from 'express';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';

export const healthController = {
  async check(_req: Request, res: Response): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        version: config.app.version,
        gitSha: config.app.gitSha,
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'error',
        version: config.app.version,
        gitSha: config.app.gitSha,
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  },

  ping(_req: Request, res: Response): void {
    res.status(200).json({ status: 'ok' });
  },
};
