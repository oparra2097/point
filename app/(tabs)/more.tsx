import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isLive } from '../../src/engine/dates';
import { useAuth } from '../../src/store/useAuth';
import { useWallet } from '../../src/store/useWallet';
import { Card, SectionHeader } from '../../src/ui/components';
import { space, type as t, usePalette } from '../../src/ui/theme';

type Row = {
  href: '/wallet' | '/offers' | '/points' | '/account';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
};

export default function MoreScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const cards = useWallet((s) => s.cards);
  const offers = useWallet((s) => s.offers);
  const balances = useWallet((s) => s.balances);

  const live = offers.filter((o) => isLive(o.expiresAt)).length;
  const pending = offers.filter((o) => !o.activated && isLive(o.expiresAt)).length;

  const rows: Row[] = [
    {
      href: '/wallet',
      icon: 'credit-card-multiple-outline',
      title: 'Wallet',
      subtitle: `${cards.length} card${cards.length === 1 ? '' : 's'}`,
    },
    {
      href: '/offers',
      icon: 'tag-multiple-outline',
      title: 'Offers',
      subtitle: pending > 0 ? `${live} live · ${pending} not activated` : `${live} live`,
    },
    {
      href: '/points',
      icon: 'star-four-points-outline',
      title: 'Points',
      subtitle: `${balances.length} program${balances.length === 1 ? '' : 's'}`,
    },
    {
      href: '/account',
      icon: 'account-circle-outline',
      title: 'Account',
      subtitle: profile?.email ?? 'Not signed in',
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
    >
      <Text style={[t.title, { color: p.text }]}>More</Text>

      <View style={{ gap: space.sm }}>
        {rows.map((row) => (
          <Link key={row.href} href={row.href} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={row.title}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <MaterialCommunityIcons name={row.icon} size={24} color={p.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>{row.title}</Text>
                  <Text style={[t.caption, { color: p.textMuted, marginTop: 2 }]}>{row.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={p.textFaint} />
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>

      <SectionHeader title="About" />
      <Card style={{ gap: space.sm }}>
        <Text style={[t.caption, { color: p.textMuted, lineHeight: 18 }]}>
          Card earn rates, credits and transfer partners are a curated snapshot and change
          without notice. Each card shows the date its terms were last checked — verify against
          your issuer before relying on a number.
        </Text>
        <Text style={[t.caption, { color: p.textFaint, lineHeight: 18 }]}>
          Offers and point balances are entered by hand. No issuer publishes an API for targeted
          offers, and no aggregator returns loyalty balances.
        </Text>
      </Card>
    </ScrollView>
  );
}
