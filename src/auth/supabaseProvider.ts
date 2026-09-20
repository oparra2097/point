/**
 * Supabase-backed accounts using email one-time codes.
 *
 * One flow covers sign-up and sign-in: `signInWithOtp` creates the user if the
 * address is new, so there is no separate register path and no way to land on
 * the wrong one. `name` rides along in user metadata, which the database
 * trigger copies into public.profiles when the auth user is created.
 *
 * Codes rather than magic links: a link has to deep-link back into the app,
 * which is fragile under Expo Go's exp:// URLs and breaks differently on every
 * email client. A typed code behaves the same everywhere.
 */

import { supabase } from '../lib/supabase';
import {
  AuthError, isValidEmail, normalizeEmail,
  type AccessResult, type AuthProvider, type Profile, type UpdateResult,
} from './types';

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

function client() {
  if (!supabase) {
    throw new AuthError('Server is not configured on this build.', 'unsupported');
  }
  return supabase;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email,
    createdAt: row.created_at,
  };
}

/**
 * Translate Supabase errors into something a person can act on.
 *
 * Supabase reports these as HTTP statuses and prose; the raw message is often
 * either too technical or too vague to show, so the cases worth distinguishing
 * are mapped explicitly and everything else falls back to a generic message.
 */
function translate(error: { message?: string; status?: number } | null, fallback: string): never {
  const message = error?.message ?? '';
  const status = error?.status;

  if (status === 429 || /rate limit|too many/i.test(message)) {
    throw new AuthError('Too many attempts. Wait a minute and try again.', 'rate_limited');
  }
  if (/expired/i.test(message)) {
    throw new AuthError('That code expired. Request a new one.', 'expired_code');
  }
  if (/invalid|incorrect|token/i.test(message)) {
    throw new AuthError('That code is not right. Check and try again.', 'invalid_code');
  }
  if (/network|fetch/i.test(message)) {
    throw new AuthError('Could not reach the server. Check your connection.', 'network');
  }
  throw new AuthError(fallback, 'network');
}

/**
 * Read the signed-in user's profile row, creating it if absent.
 *
 * The trigger normally creates it at sign-up. The upsert fallback covers a
 * project where the migration has not been applied yet, so a missing row shows
 * up as a working app rather than a blank screen.
 */
async function loadProfile(): Promise<Profile | null> {
  const sb = client();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('id, name, email, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) translate(error, 'Could not load your profile.');
  if (data) return toProfile(data as ProfileRow);

  const fallback = {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string | undefined) ?? '',
  };
  const { data: created, error: insertError } = await sb
    .from('profiles')
    .upsert(fallback, { onConflict: 'id' })
    .select('id, name, email, created_at')
    .single();

  if (insertError) translate(insertError, 'Could not create your profile.');
  return toProfile(created as ProfileRow);
}

export const supabaseAuthProvider: AuthProvider = {
  kind: 'supabase',

  async current() {
    const sb = client();
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    return loadProfile();
  },

  async requestAccess({ email, name }): Promise<AccessResult> {
    if (!isValidEmail(email)) throw new AuthError('That email does not look right.', 'invalid_email');

    const { error } = await client().auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        // Default is true; stated explicitly because it is what makes this one
        // flow serve both new and returning users.
        shouldCreateUser: true,
        data: name?.trim() ? { name: name.trim() } : undefined,
      },
    });

    if (error) translate(error, 'Could not send a code. Try again.');
    return { needsCode: true };
  },

  async verifyCode({ email, code }): Promise<Profile> {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new AuthError('Enter the 6-digit code from your email.', 'invalid_code');
    }

    const { error } = await client().auth.verifyOtp({
      email: normalizeEmail(email),
      token: trimmed,
      type: 'email',
    });
    if (error) translate(error, 'Could not verify that code.');

    const profile = await loadProfile();
    if (!profile) throw new AuthError('Signed in, but no profile was found.', 'not_found');
    return profile;
  },

  async signOut() {
    await client().auth.signOut();
  },

  async updateProfile(patch): Promise<UpdateResult> {
    const sb = client();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) throw new AuthError('Not signed in.', 'not_found');

    let emailConfirmationSent = false;

    if (patch.email !== undefined) {
      if (!isValidEmail(patch.email)) {
        throw new AuthError('That email does not look right.', 'invalid_email');
      }
      const normalized = normalizeEmail(patch.email);
      if (normalized !== user.email) {
        // Supabase mails a confirmation to the NEW address and only applies
        // the change once it is confirmed -- so profiles.email deliberately
        // still holds the old value when this returns.
        const { error } = await sb.auth.updateUser({ email: normalized });
        if (error) translate(error, 'Could not start the email change.');
        emailConfirmationSent = true;
      }
    }

    if (patch.name !== undefined) {
      if (patch.name.trim().length < 1) throw new AuthError('Enter your name.', 'invalid_name');
      const { error } = await sb
        .from('profiles')
        .update({ name: patch.name.trim() })
        .eq('id', user.id);
      if (error) translate(error, 'Could not save your name.');
    }

    const profile = await loadProfile();
    if (!profile) throw new AuthError('Not signed in.', 'not_found');
    return { profile, emailConfirmationSent };
  },
};
