import type { AccessLevel, User, PublicUser } from '../../shared/types';
export declare function findUserByEmail(email: string): Promise<User | null>;
export declare function findUserByUsername(username: string): Promise<User | null>;
export declare function findUserByLogin(login: string): Promise<User | null>;
export declare function findUserById(id: number): Promise<User | null>;
export declare function findUserByResetToken(token: string): Promise<User | null>;
export declare function updatePasswordHash(userId: number, hash: string): Promise<void>;
export declare function saveResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
export declare function listUsers(): Promise<PublicUser[]>;
export declare function createUser(input: {
    username: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    accessLevel: AccessLevel;
}): Promise<PublicUser>;
export declare function updateUser(userId: number, input: {
    firstName?: string;
    lastName?: string;
    accessLevel?: AccessLevel;
    isBlocked?: boolean;
}): Promise<PublicUser | null>;
export declare function deleteUser(userId: number): Promise<boolean>;
export declare function toPublicUser(user: User): PublicUser;
//# sourceMappingURL=user.d.ts.map