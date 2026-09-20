/**
 * Device-local account storage.
 *
 * Profiles live in AsyncStorage on this device only. This exists so the
 * account flow, the dashboard and per-user state can be built and used now,
 * and so the seam a real backend plugs into is already load-bearing rather
 * than hypothetical.
 *
 * What it is NOT: authentication. Nothing is verified, nothing syncs, and
 * signing in only requires knowing an email already stored on this phone.
 * The UI says so plainly rather than implying a real account exists.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthError, isValidEmail, normalizeEmail, type AuthProvider, type Profile } from './types';

const ACCOUNTS_KEY = 'point-accounts-v1';
const SESSION_KEY = 'point-session-v1';

async function readAccounts(): Promise<Profile[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    // A corrupt or unreadable store must not brick the app; an empty list
    // sends the user to the sign-up screen, which is recoverable.
    return [];
  }
}

async function writeAccounts(accounts: Profile[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export const localAuthProvider: AuthProvider = {
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

  async signUp({ name, email }) {
    const cleanName = name.trim();
    if (cleanName.length < 1) throw new AuthError('Enter your name.', 'invalid_name');
    if (!isValidEmail(email)) throw new AuthError('That email does not look right.', 'invalid_email');

    const normalized = normalizeEmail(email);
    const accounts = await readAccounts();
    if (accounts.some((a) => a.email === normalized)) {
      throw new AuthError('An account already exists for that email.', 'email_taken');
    }

    const profile: Profile = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      email: normalized,
      createdAt: new Date().toISOString(),
    };

    await writeAccounts([...accounts, profile]);
    await AsyncStorage.setItem(SESSION_KEY, profile.id);
    return profile;
  },

  async signIn({ email }) {
    if (!isValidEmail(email)) throw new AuthError('That email does not look right.', 'invalid_email');
    const normalized = normalizeEmail(email);
    const accounts = await readAccounts();
    const found = accounts.find((a) => a.email === normalized);
    if (!found) throw new AuthError('No account on this device for that email.', 'not_found');

    await AsyncStorage.setItem(SESSION_KEY, found.id);
    return found;
  },

  async signOut() {
    await AsyncStorage.removeItem(SESSION_KEY);
  },

  async updateProfile(patch) {
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) throw new AuthError('Not signed in.', 'not_found');

    const accounts = await readAccounts();
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) throw new AuthError('Not signed in.', 'not_found');

    if (patch.email !== undefined) {
      if (!isValidEmail(patch.email)) throw new AuthError('That email does not look right.', 'invalid_email');
      const normalized = normalizeEmail(patch.email);
      if (accounts.some((a) => a.email === normalized && a.id !== id)) {
        throw new AuthError('An account already exists for that email.', 'email_taken');
      }
      patch = { ...patch, email: normalized };
    }
    if (patch.name !== undefined && patch.name.trim().length < 1) {
      throw new AuthError('Enter your name.', 'invalid_name');
    }

    const updated: Profile = {
      ...accounts[index],
      ...patch,
      name: patch.name?.trim() ?? accounts[index].name,
    };
    accounts[index] = updated;
    await writeAccounts(accounts);
    return updated;
  },
};
