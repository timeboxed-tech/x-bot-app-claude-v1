import { Request, Response } from 'express';
import { config } from '../config/index.js';

export const healthController = {
  check(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      version: config.app.version,
      timestamp: new Date().toISOString(),
    });
  },
};
