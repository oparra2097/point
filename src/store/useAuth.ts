import { create } from 'zustand';

import { localAuthProvider } from '../auth/localProvider';
import { supabaseAuthProvider } from '../auth/supabaseProvider';
import { AuthError, type AuthProvider, type Profile } from '../auth/types';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Real accounts when the backend is configured, device-local otherwise.
 *
 * Resolved once at module load rather than per call, so the whole app agrees
 * on which provider is live and the account screen can say which one it is.
 */
const provider: AuthProvider = isSupabaseConfigured ? supabaseAuthProvider : localAuthProvider;

export const authKind = provider.kind;

interface AuthState {
  profile: Profile | null;
  /** False until the launch session lookup has finished. */
  ready: boolean;
  busy: boolean;
  error: string | null;
  /** Set once a code has been sent; the UI switches to the code step. */
  pendingEmail: string | null;
  notice: string | null;

  restore: () => Promise<void>;
  requestAccess: (input: { email: string; name?: string }) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  cancelPending: () => void;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'email'>>) => Promise<boolean>;
  clearError: () => void;
}

/** Surface the provider's own message when it has one, never a raw stack. */
function messageOf(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  return 'Something went wrong. Try again.';
}

export const useAuth = create<AuthState>()((set, get) => ({
  profile: null,
  ready: false,
  busy: false,
  error: null,
  pendingEmail: null,
  notice: null,

  restore: async () => {
    try {
      const profile = await provider.current();
      set({ profile, ready: true });
    } catch {
      // Ready regardless: a failed restore means signed out, not broken. A
      // network blip at launch must not trap the user on the splash screen.
      set({ profile: null, ready: true });
    }
  },

  requestAccess: async (input) => {
    set({ busy: true, error: null, notice: null });
    try {
      const result = await provider.requestAccess(input);
      if (result.needsCode) {
        set({ busy: false, pendingEmail: input.email.trim().toLowerCase() });
      } else {
        set({ busy: false, profile: result.profile ?? null, pendingEmail: null });
      }
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  verifyCode: async (code) => {
    const email = get().pendingEmail;
    if (!email) {
      set({ error: 'Start again — no code was requested.' });
      return false;
    }
    set({ busy: true, error: null });
    try {
      const profile = await provider.verifyCode({ email, code });
      set({ busy: false, profile, pendingEmail: null });
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  cancelPending: () => set({ pendingEmail: null, error: null }),

  signOut: async () => {
    await provider.signOut().catch(() => undefined);
    set({ profile: null, error: null, pendingEmail: null, notice: null });
  },

  updateProfile: async (patch) => {
    set({ busy: true, error: null, notice: null });
    try {
      const { profile, emailConfirmationSent } = await provider.updateProfile(patch);
      set({
        busy: false,
        profile,
        notice: emailConfirmationSent
          ? `Confirm the change from your new inbox — your email stays ${profile.email} until then.`
          : null,
      });
      return true;
    } catch (e) {
      set({ busy: false, error: messageOf(e) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
