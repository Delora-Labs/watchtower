import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne, execute } from "./db";
import bcrypt from "bcryptjs";

const SESSION_COOKIE_NAME = "watchtower_session";
const SESSION_DURATION_DAYS = 7;

export type UserRole = "system_admin" | "team_lead" | "user";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Role hierarchy: system_admin > team_lead > user
export function canManageUsers(role: UserRole): boolean {
  return role === "system_admin";
}

export function canManageTeams(role: UserRole): boolean {
  return role === "system_admin";
}

export function canManageServers(role: UserRole): boolean {
  return role === "system_admin";
}

export function canRestartApps(role: UserRole): boolean {
  return role === "system_admin" || role === "team_lead";
}

export function canViewAllApps(role: UserRole): boolean {
  return role === "system_admin";
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export async function validateCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await queryOne<User & { password_hash: string }>(
    "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
    [email]
  );

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  // Return user without password_hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const sessionId = generateUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await execute(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
    [sessionId, userId, token, expiresAt.toISOString().slice(0, 19).replace("T", " ")]
  );

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function getUserFromSession(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  // Clean up expired sessions first (opportunistically)
  await execute("DELETE FROM sessions WHERE expires_at < NOW()").catch(() => {});

  const session = await queryOne<Session>(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()",
    [token]
  );

  if (!session) {
    return null;
  }

  const user = await queryOne<User>(
    "SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ? AND is_active = TRUE",
    [session.user_id]
  );

  return user;
}

export async function deleteSession(token: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE token = ?", [token]);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Get user's team IDs
export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await query<{ team_id: string }>(
    `SELECT team_id FROM team_members WHERE user_id = ?`,
    [userId]
  );
  return rows.map(r => r.team_id);
}

// Check if user is team lead for a specific team
export async function isTeamLead(userId: string, teamId: string): Promise<boolean> {
  const row = await queryOne<{ role: string }>(
    `SELECT role FROM team_members WHERE user_id = ? AND team_id = ?`,
    [userId, teamId]
  );
  return row?.role === "lead";
}
