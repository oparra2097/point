/**
 * Supabase client.
 *
 * Absent when the environment is not configured, which is deliberate: the app
 * falls back to the device-local account provider so it still runs with no
 * backend. That keeps `npx expo start` working for anyone who clones this
 * without credentials.
 */

// Must come before the client: supabase-js builds request URLs with the WHATWG
// URL API, which React Native only partially implements.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // Sessions persist across launches in AsyncStorage, and the refresh
        // token is rotated automatically while the app is foregrounded.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Web-only: there is no URL bar to read a session out of in a native
        // app, and leaving it on makes the client wait on something that never
        // arrives.
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase) {
  // Refreshing while backgrounded is wasted work and can fire on a dead
  // socket, so the timer follows the app's foreground state.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
