"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByEmail = findUserByEmail;
exports.findUserByUsername = findUserByUsername;
exports.findUserByLogin = findUserByLogin;
exports.findUserById = findUserById;
exports.findUserByResetToken = findUserByResetToken;
exports.updatePasswordHash = updatePasswordHash;
exports.saveResetToken = saveResetToken;
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.toPublicUser = toPublicUser;
const client_1 = require("../db/client");
function isMissingUserManagementColumn(err) {
    return typeof err === 'object'
        && err !== null
        && 'code' in err
        && err.code === '42703';
}
function rowToUser(row) {
    return {
        id: row.id,
        email: row.email,
        username: row.username ?? row.email,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        passwordHash: row.password_hash,
        role: row.role,
        isBlocked: row.is_blocked ?? false,
        resetToken: row.reset_token,
        resetTokenExpiresAt: row.reset_token_expires_at ? new Date(row.reset_token_expires_at) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
async function findUserByEmail(email) {
    const rows = await (0, client_1.sql) `SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    return rows[0] ? rowToUser(rows[0]) : null;
}
async function findUserByUsername(username) {
    const rows = await (0, client_1.sql) `SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    return rows[0] ? rowToUser(rows[0]) : null;
}
async function findUserByLogin(login) {
    try {
        const rows = await (0, client_1.sql) `
      SELECT * FROM users
      WHERE username = ${login} OR email = ${login}
      LIMIT 1
    `;
        return rows[0] ? rowToUser(rows[0]) : null;
    }
    catch (err) {
        if (!isMissingUserManagementColumn(err))
            throw err;
        return findUserByEmail(login);
    }
}
async function findUserById(id) {
    const rows = await (0, client_1.sql) `SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToUser(rows[0]) : null;
}
async function findUserByResetToken(token) {
    const rows = await (0, client_1.sql) `
    SELECT * FROM users
    WHERE reset_token = ${token}
      AND reset_token_expires_at > NOW()
    LIMIT 1
  `;
    return rows[0] ? rowToUser(rows[0]) : null;
}
async function updatePasswordHash(userId, hash) {
    await (0, client_1.sql) `
    UPDATE users
    SET password_hash = ${hash},
        reset_token = NULL,
        reset_token_expires_at = NULL,
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}
async function saveResetToken(userId, token, expiresAt) {
    await (0, client_1.sql) `
    UPDATE users
    SET reset_token = ${token},
        reset_token_expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}
async function listUsers() {
    const rows = await (0, client_1.sql) `
    SELECT * FROM users
    ORDER BY created_at DESC
  `;
    return rows.map(row => toPublicUser(rowToUser(row)));
}
async function createUser(input) {
    const rows = await (0, client_1.sql) `
    INSERT INTO users (email, username, first_name, last_name, password_hash, role)
    VALUES (
      ${input.username},
      ${input.username},
      ${input.firstName},
      ${input.lastName},
      ${input.passwordHash},
      ${input.accessLevel}
    )
    RETURNING *
  `;
    return toPublicUser(rowToUser(rows[0]));
}
async function updateUser(userId, input) {
    const current = await findUserById(userId);
    if (!current)
        return null;
    const rows = await (0, client_1.sql) `
    UPDATE users
    SET first_name = ${input.firstName ?? current.firstName},
        last_name = ${input.lastName ?? current.lastName},
        role = ${input.accessLevel ?? current.role},
        is_blocked = ${input.isBlocked ?? current.isBlocked},
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
    return rows[0] ? toPublicUser(rowToUser(rows[0])) : null;
}
async function deleteUser(userId) {
    const rows = await (0, client_1.sql) `
    DELETE FROM users
    WHERE id = ${userId}
    RETURNING id
  `;
    return rows.length > 0;
}
function toPublicUser(user) {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
    };
}
//# sourceMappingURL=user.js.map