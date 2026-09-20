/**
 * Account layer.
 *
 * Two implementations satisfy this interface: a real Supabase-backed provider
 * (supabaseProvider.ts) and a device-local one (localProvider.ts) used when no
 * backend is configured. The store picks between them at startup, so the rest
 * of the app never knows which is running.
 *
 * The shape is built around one-time codes rather than passwords. Access is
 * two steps -- request a code, then verify it -- because that is how email OTP
 * works, and it is the flow worth optimising for: nothing to leak, nothing to
 * reuse across sites, and no deep-link round trip like a magic link needs.
 * A provider that can sign in without a code (the local one) reports
 * `needsCode: false` and returns the profile immediately.
 */

export interface Profile {
  id: string;
  name: string;
  email: string;
  /** ISO timestamp. */
  createdAt: string;
}

export type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_name'
  | 'invalid_code'
  | 'expired_code'
  | 'rate_limited'
  | 'network'
  | 'not_found'
  | 'email_taken'
  | 'unsupported';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AccessResult {
  /** True when a code was sent and `verifyCode` must follow. */
  needsCode: boolean;
  /** Set only when the provider signed in without a code step. */
  profile?: Profile;
}

export interface UpdateResult {
  profile: Profile;
  /**
   * True when an email change is pending confirmation. The address only
   * changes once the user confirms from the new inbox, so the returned profile
   * still carries the old one.
   */
  emailConfirmationSent?: boolean;
}

export interface AuthProvider {
  readonly kind: 'local' | 'supabase';
  /** The signed-in profile, or null. Called once at launch. */
  current(): Promise<Profile | null>;
  /** Begin sign-in or sign-up. `name` is used only when creating an account. */
  requestAccess(input: { email: string; name?: string }): Promise<AccessResult>;
  /** Complete a code-based sign-in. */
  verifyCode(input: { email: string; code: string }): Promise<Profile>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, 'name' | 'email'>>): Promise<UpdateResult>;
}

/**
 * Good-enough email shape check.
 *
 * Deliberately permissive: the only authoritative test of an address is
 * sending mail to it -- which the OTP flow does anyway -- and over-strict
 * patterns reject valid addresses (plus-addressing, new TLDs, apostrophes) far
 * more often than they catch typos.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
