import { Request, Response, NextFunction } from 'express';
import { verifyUser } from '../lib/auth.js';

declare global { namespace Express { interface Request { user?: { id: string; email: string; name: string; avatarUrl?: string | null } } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.reachinbox_token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    req.user = verifyUser(token);
    next();
  } catch { return res.status(401).json({ message: 'Invalid or expired session' }); }
}
