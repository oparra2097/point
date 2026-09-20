import { create } from 'zustand';

import { localAuthProvider } from '../auth/localProvider';
import { AuthError, type AuthProvider, type Profile } from '../auth/types';

/**
 * Swap this for a real backend's implementation of AuthProvider and the rest
 * of the app is unchanged.
 */
const provider: AuthProvider = localAuthProvider;

interface AuthState {
  profile: Profile | null;
  /** False until the launch session lookup has finished. */
  ready: boolean;
  busy: boolean;
  error: string | null;

  restore: () => Promise<void>;
  signUp: (input: { name: string; email: string }) => Promise<boolean>;
  signIn: (input: { email: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'email'>>) => Promise<boolean>;
  clearError: () => void;
}

/** Surface the provider's own message when it has one, never a raw stack. */
function messageOf(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  return 'Something went wrong. Try again.';
}

export const useAuth = create<AuthState>()((set) => ({
  profile: null,
  ready: false,
  busy: false,
  error: null,

  restore: async () => {
    try {
      const profile = await provider.current();
      set({ profile, ready: true });
    } catch {
      // Ready regardless: a failed restore means signed out, not broken.
      set({ profile: null, ready: true });
    }
  },

  signUp: async (input) => {
    set({ busy: true, error: null });
    try {
      const profile = await provider.signUp(input);
      set({ profile, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  signIn: async (input) => {
    set({ busy: true, error: null });
    try {
      const profile = await provider.signIn(input);
      set({ profile, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  signOut: async () => {
    await provider.signOut().catch(() => undefined);
    set({ profile: null, error: null });
  },

  updateProfile: async (patch) => {
    set({ busy: true, error: null });
    try {
      const profile = await provider.updateProfile(patch);
      set({ profile, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
