import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/store/useAuth';
import { Button } from '../src/ui/components';
import { radius, space, type as t, usePalette } from '../src/ui/theme';

export default function WelcomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const signUp = useAuth((s) => s.signUp);
  const signIn = useAuth((s) => s.signIn);
  const clearError = useAuth((s) => s.clearError);

  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (profile) return <Redirect href="/" />;

  async function submit() {
    const ok =
      mode === 'signUp' ? await signUp({ name, email }) : await signIn({ email });
    if (ok) router.replace('/');
  }

  function switchMode(next: 'signUp' | 'signIn') {
    setMode(next);
    clearError();
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

        <View style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
            {(['signUp', 'signIn'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  paddingVertical: space.sm,
                  borderRadius: radius.sm,
                  backgroundColor: mode === m ? p.surface : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={[t.label, { color: mode === m ? p.text : p.textMuted, fontWeight: '600' }]}>
                  {m === 'signUp' ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'signUp' ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={p.textFaint}
              autoCapitalize="words"
              autoComplete="name"
              style={[t.body, input]}
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={p.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            onSubmitEditing={submit}
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
            <Button label={mode === 'signUp' ? 'Create account' : 'Sign in'} onPress={submit} />
          )}

          {/* Being straight about what this is. There is no server yet, so
              nothing is verified and nothing leaves the device. */}
          <Text style={[t.caption, { color: p.textFaint, textAlign: 'center', lineHeight: 17 }]}>
            Your profile is stored on this device only. There is no server yet, so nothing syncs
            between devices and no password is required — adding a backend is a one-file change.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
