import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARDS_BY_ID, creditsPerYear } from '../../src/data/cards';
import { offerCeiling, unactivatedOffers } from '../../src/engine/atStore';
import { daysUntil, isLive } from '../../src/engine/dates';
import { displayMerchant } from '../../src/engine/merchant';
import { aggregatePoints } from '../../src/engine/points';
import { bestUse, portfolioUpside } from '../../src/engine/redeem';
import { useAuth } from '../../src/store/useAuth';
import { useWallet } from '../../src/store/useWallet';
import { Card, Chip, Empty, SectionHeader } from '../../src/ui/components';
import { money, radius, space, type as t, usePalette } from '../../src/ui/theme';

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[t.heading, { color: tone ?? p.text }]}>{value}</Text>
      <Text style={[t.caption, { color: p.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const cards = useWallet((s) => s.cards);
  const offers = useWallet((s) => s.offers);
  const balances = useWallet((s) => s.balances);
  const cppOverrides = useWallet((s) => s.cppOverrides);

  const summary = useMemo(() => aggregatePoints(balances, cppOverrides), [balances, cppOverrides]);
  const uses = useMemo(() => bestUse(balances, cppOverrides), [balances, cppOverrides]);
  const upside = useMemo(() => portfolioUpside(uses), [uses]);

  const liveOffers = useMemo(() => offers.filter((o) => isLive(o.expiresAt)), [offers]);
  const pending = useMemo(() => unactivatedOffers(offers), [offers]);

  /**
   * Unclaimed value sitting in unactivated offers.
   *
   * Only offers with a bounded payout are totalled. An uncapped percent offer
   * has no ceiling without knowing the basket, and guessing one would inflate
   * the headline -- so those are counted separately and reported as "plus N
   * more" rather than folded in.
   */
  const atRisk = useMemo(() => {
    let total = 0;
    let unbounded = 0;
    for (const o of pending) {
      const card = CARDS_BY_ID[o.cardId];
      if (!card) continue;
      const ceiling = offerCeiling(o, card.currency, cppOverrides);
      if (ceiling === undefined) unbounded += 1;
      else total += ceiling;
    }
    return { total, unbounded };
  }, [pending, cppOverrides]);

  const expiringSoon = useMemo(
    () => pending.filter((o) => o.expiresAt && daysUntil(o.expiresAt) <= 7),
    [pending],
  );

  const annualFees = cards.reduce((s, id) => s + (CARDS_BY_ID[id]?.annualFee ?? 0), 0);
  const credits = cards.reduce((s, id) => {
    const c = CARDS_BY_ID[id];
    return s + (c ? creditsPerYear(c) : 0);
  }, 0);

  const empty = cards.length === 0 && balances.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
    >
      <View>
        <Text style={[t.body, { color: p.textMuted }]}>{greeting()},</Text>
        <Text style={[t.title, { color: p.text }]}>{profile?.name ?? 'there'}</Text>
      </View>

      {empty ? (
        <Card style={{ gap: space.md }}>
          <Empty
            icon="view-dashboard-outline"
            title="Nothing to show yet"
            body="Add the cards you carry and your point balances, and this fills in."
          />
          <Link href="/wallet" asChild>
            <Pressable accessibilityRole="button">
              <Text style={[t.label, { color: p.accent, textAlign: 'center', fontWeight: '600' }]}>
                Set up your wallet
              </Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      {balances.length > 0 ? (
        <LinearGradient
          colors={['#2E7CF6', '#0B3D91']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: space.xl, gap: space.sm }}
        >
          <Text style={[t.caption, { color: '#FFFFFFAA', fontWeight: '600', letterSpacing: 1 }]}>
            PORTFOLIO VALUE
          </Text>
          <Text style={[t.display, { color: '#FFFFFF' }]}>{money(summary.totalValue, false)}</Text>
          {upside.upside > 0 ? (
            <Text style={[t.label, { color: '#FFFFFFDD' }]}>
              Worth {money(upside.upside, false)} more if redeemed well
            </Text>
          ) : null}
        </LinearGradient>
      ) : null}

      {pending.length > 0 ? (
        <Card style={{ borderColor: p.warning, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <MaterialCommunityIcons name="alert-decagram-outline" size={22} color={p.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[t.heading, { color: p.text }]}>
                {atRisk.total > 0 ? `${money(atRisk.total, false)} unclaimed` : `${pending.length} unactivated`}
              </Text>
              <Text style={[t.caption, { color: p.textMuted }]}>
                {pending.length} offer{pending.length === 1 ? '' : 's'} not activated
                {atRisk.unbounded > 0 ? `, plus ${atRisk.unbounded} with no cap` : ''}
              </Text>
            </View>
          </View>

          {expiringSoon.length > 0 ? (
            <View style={{ gap: space.sm }}>
              {expiringSoon.slice(0, 3).map((o) => {
                const left = daysUntil(o.expiresAt!);
                return (
                  <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={p.warning} />
                    <Text style={[t.caption, { color: p.text, flex: 1 }]}>
                      {displayMerchant(o.merchant)}
                    </Text>
                    <Chip label={left <= 0 ? 'Today' : `${left}d left`} tone="warning" />
                  </View>
                );
              })}
            </View>
          ) : null}

          <Link href="/offers" asChild>
            <Pressable accessibilityRole="button">
              <Text style={[t.label, { color: p.accent, fontWeight: '600' }]}>Activate them →</Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      <SectionHeader title="Your wallet" />
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Cards" value={String(cards.length)} />
          <Stat label="Live offers" value={String(liveOffers.length)} />
          <Stat
            label="Not activated"
            value={String(pending.length)}
            tone={pending.length > 0 ? p.warning : undefined}
          />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Annual fees" value={money(annualFees, false)} />
          <Stat label="Credits available" value={money(credits, false)} tone={p.positive} />
          <Stat label="Programs" value={String(summary.lines.length)} />
        </View>
        {annualFees > 0 ? (
          <Text style={[t.caption, { color: p.textFaint }]}>
            {credits >= annualFees
              ? `Your credits more than cover your fees — if you actually use them.`
              : `Credits cover ${Math.round((credits / annualFees) * 100)}% of your annual fees.`}
          </Text>
        ) : null}
      </Card>

      {uses.length > 0 && uses[0].upside > 0 ? (
        <>
          <SectionHeader title="Biggest opportunity" />
          <Link href={`/program/${uses[0].currency.id}`} asChild>
            <Pressable accessibilityRole="button">
              <Card style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: uses[0].currency.color }} />
                  <Text style={[t.label, { color: p.text, fontWeight: '600', flex: 1 }]}>
                    {uses[0].currency.name}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={p.accent} />
                </View>
                <Text style={[t.caption, { color: p.textMuted }]}>
                  {money(uses[0].upside, false)} better via {uses[0].best.route.label.toLowerCase()} than{' '}
                  {uses[0].defaultRoute.route.label.toLowerCase()}.
                </Text>
              </Card>
            </Pressable>
          </Link>
        </>
      ) : null}
    </ScrollView>
  );
}
