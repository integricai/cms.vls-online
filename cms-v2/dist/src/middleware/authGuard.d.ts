import { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../../shared/types';
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare function authGuard(req: Request, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: JwtPayload['role'][]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authGuard.d.ts.map