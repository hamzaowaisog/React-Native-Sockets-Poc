/**
 * Auth service - login and user state (mock API)
 */

import { CONFIG } from '../../constants/config';
import type { UserRole } from '../../types/realtime.types';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface LoginCredentials {
  userId: string;
  password: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Login failed');
  }
  return res.json();
}

export async function fetchClients(packageName: string): Promise<{ id: string; name: string; online: boolean }[]> {
  const pkg = packageName && ['socketio', 'mqtt', 'webrtc'].includes(packageName) ? packageName : 'socketio';
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/clients?package=${encodeURIComponent(pkg)}`);
  if (!res.ok) throw new Error('Failed to fetch clients');
  const data = await res.json();
  return data.clients || [];
}

export async function reportPresence(userId: string, packageName: string): Promise<void> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/presence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, package: packageName }),
  });
  if (!res.ok) throw new Error('Failed to report presence');
}
