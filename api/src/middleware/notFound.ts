import { Request, Response } from 'express';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    statusCode: 404,
    message: `Route not found: ${_req.method} ${_req.path}`,
  });
}
