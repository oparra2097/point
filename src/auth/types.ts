/**
 * Account layer.
 *
 * Deliberately behind an interface. The shipped implementation is device-local
 * (see localProvider.ts) and is NOT authentication: there is no server, so
 * nothing is verified and nothing syncs between devices. Swapping in Supabase,
 * Clerk, Firebase or a custom backend means implementing this interface and
 * changing one line in src/store/useAuth.ts.
 *
 * Password handling is intentionally absent from the local provider rather
 * than stubbed. A password checked on-device protects nothing -- anyone
 * holding the phone can read the stored value -- so implementing one would be
 * security theatre that makes the app look safer than it is. Real credentials
 * arrive with a real backend.
 */

export interface Profile {
  id: string;
  name: string;
  email: string;
  /** ISO timestamp. */
  createdAt: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'email_taken' | 'not_found' | 'invalid_email' | 'invalid_name',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthProvider {
  /** The signed-in profile, or null. Called once on launch. */
  current(): Promise<Profile | null>;
  signUp(input: { name: string; email: string }): Promise<Profile>;
  signIn(input: { email: string }): Promise<Profile>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, 'name' | 'email'>>): Promise<Profile>;
}

/**
 * Good-enough email shape check.
 *
 * Deliberately permissive: the only authoritative test of an address is
 * sending mail to it, and over-strict patterns reject valid addresses
 * (plus-addressing, new TLDs, apostrophes) far more often than they catch
 * typos.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
