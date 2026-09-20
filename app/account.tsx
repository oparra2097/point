import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/store/useAuth';
import { useWallet } from '../src/store/useWallet';
import { Button, Card, SectionHeader } from '../src/ui/components';
import { radius, space, type as t, usePalette } from '../src/ui/theme';

export default function AccountScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const updateProfile = useAuth((s) => s.updateProfile);
  const signOut = useAuth((s) => s.signOut);
  const resetWallet = useWallet((s) => s.reset);

  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [saved, setSaved] = useState(false);

  const dirty = name !== profile?.name || email !== profile?.email;

  async function save() {
    const ok = await updateProfile({ name, email });
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Your cards, offers and balances stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/welcome');
        },
      },
    ]);
  }

  function confirmErase() {
    Alert.alert(
      'Erase wallet data?',
      'Removes every card, offer and balance on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => resetWallet() },
      ],
    );
  }

  const input = {
    color: p.text,
    backgroundColor: p.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={p.accent} />
        <Text style={[t.label, { color: p.accent }]}>More</Text>
      </Pressable>

      <Text style={[t.title, { color: p.text }]}>Account</Text>

      <Card style={{ gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Text style={[t.caption, { color: p.textMuted }]}>Name</Text>
          <TextInput value={name} onChangeText={setName} autoCapitalize="words" style={[t.body, input]} />
        </View>
        <View style={{ gap: space.xs }}>
          <Text style={[t.caption, { color: p.textMuted }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[t.body, input]}
          />
        </View>

        {error ? (
          <Text style={[t.label, { color: p.danger }]} accessibilityLiveRegion="polite">{error}</Text>
        ) : null}
        {saved ? (
          <Text style={[t.label, { color: p.positive }]} accessibilityLiveRegion="polite">Saved.</Text>
        ) : null}

        <Button label={busy ? 'Saving…' : 'Save changes'} onPress={save} disabled={!dirty || busy} />
      </Card>

      {profile ? (
        <Text style={[t.caption, { color: p.textFaint }]}>
          Account created {new Date(profile.createdAt).toLocaleDateString()}.
        </Text>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <MaterialCommunityIcons name="cellphone-lock" size={20} color={p.textMuted} />
          <Text style={[t.label, { color: p.text, flex: 1 }]}>Stored on this device</Text>
        </View>
        {/* Saying this plainly matters: an account screen implies a server, and
            there isn't one yet. */}
        <Text style={[t.caption, { color: p.textMuted, lineHeight: 18 }]}>
          Your profile, cards, offers and balances never leave this phone. There is no server, so
          nothing syncs to another device and signing in only needs an email already stored here.
          Deleting the app deletes everything.
        </Text>
      </Card>

      <SectionHeader title="Danger zone" />
      <View style={{ gap: space.sm }}>
        <Button label="Sign out" variant="secondary" icon="logout" onPress={confirmSignOut} />
        <Pressable onPress={confirmErase} accessibilityRole="button">
          <Text style={[t.label, { color: p.danger, textAlign: 'center', paddingVertical: space.md }]}>
            Erase wallet data
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
