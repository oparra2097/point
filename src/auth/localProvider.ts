/**
 * Device-local accounts, used when no backend is configured.
 *
 * Profiles live in AsyncStorage on this device only. This is NOT
 * authentication: nothing is verified, nothing syncs, and "signing in" only
 * requires knowing an email already stored on this phone. It exists so the app
 * runs without credentials and so the seam a real backend plugs into stays
 * exercised. The UI says which provider is active.
 *
 * No password, deliberately. One checked on-device protects nothing, since
 * anyone holding the phone can read the stored value -- implementing one would
 * be security theatre. Real verification arrives with Supabase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AuthError, isValidEmail, normalizeEmail,
  type AccessResult, type AuthProvider, type Profile, type UpdateResult,
} from './types';

const ACCOUNTS_KEY = 'point-accounts-v1';
const SESSION_KEY = 'point-session-v1';

async function readAccounts(): Promise<Profile[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    // A corrupt store must not brick the app; an empty list sends the user to
    // the welcome screen, which is recoverable.
    return [];
  }
}

async function writeAccounts(accounts: Profile[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export const localAuthProvider: AuthProvider = {
  kind: 'local',

  async current() {
    try {
      const id = await AsyncStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const accounts = await readAccounts();
      return accounts.find((a) => a.id === id) ?? null;
    } catch {
      return null;
    }
  },

  /** Signs in an existing local profile, or creates one. No code step. */
  async requestAccess({ email, name }): Promise<AccessResult> {
    if (!isValidEmail(email)) throw new AuthError('That email does not look right.', 'invalid_email');

    const normalized = normalizeEmail(email);
    const accounts = await readAccounts();
    const existing = accounts.find((a) => a.email === normalized);

    if (existing) {
      await AsyncStorage.setItem(SESSION_KEY, existing.id);
      return { needsCode: false, profile: existing };
    }

    const profile: Profile = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: (name ?? '').trim(),
      email: normalized,
      createdAt: new Date().toISOString(),
    };
    await writeAccounts([...accounts, profile]);
    await AsyncStorage.setItem(SESSION_KEY, profile.id);
    return { needsCode: false, profile };
  },

  async verifyCode() {
    throw new AuthError('This device is not connected to a server.', 'unsupported');
  },

  async signOut() {
    await AsyncStorage.removeItem(SESSION_KEY);
  },

  async updateProfile(patch): Promise<UpdateResult> {
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) throw new AuthError('Not signed in.', 'not_found');

    const accounts = await readAccounts();
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) throw new AuthError('Not signed in.', 'not_found');

    let next = { ...patch };
    if (next.email !== undefined) {
      if (!isValidEmail(next.email)) throw new AuthError('That email does not look right.', 'invalid_email');
      const normalized = normalizeEmail(next.email);
      if (accounts.some((a) => a.email === normalized && a.id !== id)) {
        throw new AuthError('An account already exists for that email.', 'email_taken');
      }
      next = { ...next, email: normalized };
    }
    if (next.name !== undefined && next.name.trim().length < 1) {
      throw new AuthError('Enter your name.', 'invalid_name');
    }

    const updated: Profile = {
      ...accounts[index],
      ...next,
      name: next.name?.trim() ?? accounts[index].name,
    };
    accounts[index] = updated;
    await writeAccounts(accounts);
    // Local has no inbox to confirm against, so the change is immediate.
    return { profile: updated };
  },
};
