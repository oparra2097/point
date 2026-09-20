import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authKind, useAuth } from '../src/store/useAuth';
import { Button } from '../src/ui/components';
import { radius, space, type as t, usePalette } from '../src/ui/theme';

export default function WelcomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const pendingEmail = useAuth((s) => s.pendingEmail);
  const requestAccess = useAuth((s) => s.requestAccess);
  const verifyCode = useAuth((s) => s.verifyCode);
  const cancelPending = useAuth((s) => s.cancelPending);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (profile) return <Redirect href="/" />;

  async function submitEmail() {
    const ok = await requestAccess({ email, name });
    // Local provider signs in outright; Supabase moves to the code step and
    // the redirect above fires once the profile lands.
    if (ok && authKind === 'local') router.replace('/');
  }

  async function submitCode() {
    const ok = await verifyCode(code);
    if (ok) router.replace('/');
  }

  function changeEmail() {
    cancelPending();
    setCode('');
  }

  const input = {
    color: p.text,
    backgroundColor: p.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#2E7CF6', '#0B3D91']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + space.xxl,
            paddingBottom: space.xxl,
            paddingHorizontal: space.lg,
            alignItems: 'center',
            gap: space.md,
          }}
        >
          <Image
            source={require('../assets/splash-icon.png')}
            style={{ width: 84, height: 84 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="point"
          />
          <Text style={[t.title, { color: '#FFFFFF' }]}>point</Text>
          <Text style={[t.body, { color: '#FFFFFFCC', textAlign: 'center', maxWidth: 300 }]}>
            Every card offer, every point, and which card to pull out right now.
          </Text>
        </LinearGradient>

        {pendingEmail ? (
          <View style={{ padding: space.lg, gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[t.heading, { color: p.text }]}>Check your email</Text>
              <Text style={[t.body, { color: p.textMuted }]}>
                We sent a 6-digit code to {pendingEmail}.
              </Text>
            </View>

            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={p.textFaint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              onSubmitEditing={submitCode}
              style={[
                t.title,
                input,
                { textAlign: 'center', letterSpacing: 10, fontVariant: ['tabular-nums'] },
              ]}
            />

            {error ? (
              <Text style={[t.label, { color: p.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Button label="Verify and continue" onPress={submitCode} disabled={code.length < 6} />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable onPress={changeEmail} accessibilityRole="button" hitSlop={8}>
                <Text style={[t.label, { color: p.accent }]}>Use a different email</Text>
              </Pressable>
              <Pressable
                onPress={() => requestAccess({ email: pendingEmail, name })}
                accessibilityRole="button"
                hitSlop={8}
                disabled={busy}
              >
                <Text style={[t.label, { color: p.accent }]}>Resend code</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ padding: space.lg, gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[t.heading, { color: p.text }]}>Sign in or create an account</Text>
              <Text style={[t.caption, { color: p.textMuted }]}>
                {authKind === 'supabase'
                  ? 'One email, one code. No password to remember or leak.'
                  : 'No backend configured, so this creates a profile on this device.'}
              </Text>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name (new accounts only)"
              placeholderTextColor={p.textFaint}
              autoCapitalize="words"
              autoComplete="name"
              style={[t.body, input]}
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={p.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              onSubmitEditing={submitEmail}
              style={[t.body, input]}
            />

            {error ? (
              <Text style={[t.label, { color: p.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Button
                label={authKind === 'supabase' ? 'Email me a code' : 'Continue'}
                onPress={submitEmail}
                disabled={!email.trim()}
              />
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <MaterialCommunityIcons
                name={authKind === 'supabase' ? 'cloud-check-outline' : 'cellphone-lock'}
                size={16}
                color={p.textFaint}
              />
              <Text style={[t.caption, { color: p.textFaint, flex: 1, lineHeight: 17 }]}>
                {authKind === 'supabase'
                  ? 'Your account is verified by email and syncs across your devices.'
                  : 'Stored on this device only — nothing is verified and nothing syncs. Add Supabase credentials to enable real accounts.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
