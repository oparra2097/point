import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CURRENCIES, type CurrencyId } from '../../src/data/currencies';
import { PARTNERS_AS_OF } from '../../src/data/redemptions';
import { bestUse, effortLabel } from '../../src/engine/redeem';
import { useWallet } from '../../src/store/useWallet';
import { Card, Chip, Empty, SectionHeader } from '../../src/ui/components';
import { money, points as fmtPoints, radius, space, type as t, usePalette } from '../../src/ui/theme';

export default function ProgramScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const balances = useWallet((s) => s.balances);
  const cppOverrides = useWallet((s) => s.cppOverrides);

  const use = useMemo(
    () => bestUse(balances, cppOverrides).find((u) => u.currency.id === id),
    [balances, cppOverrides, id],
  );

  const currency = CURRENCIES[id as CurrencyId];

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, paddingBottom: space.xxl, gap: space.lg }}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={p.accent} />
        <Text style={[t.label, { color: p.accent }]}>Points</Text>
      </Pressable>

      {!use || !currency ? (
        <Card>
          <Empty icon="help-circle-outline" title="No balance" body="Add a balance for this program to see how best to use it." />
        </Card>
      ) : (
        <>
          <View>
            <Text style={[t.title, { color: p.text }]}>{currency.name}</Text>
            <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
              {fmtPoints(use.amount)} points
            </Text>
          </View>

          <Card style={{ gap: space.sm }}>
            <Text style={[t.label, { color: p.textMuted }]}>What they are worth</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={[t.display, { color: p.text }]}>
                {money(use.defaultRoute.typical, false)}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={22} color={p.textFaint} />
              <Text style={[t.display, { color: p.positive }]}>{money(use.best.high, false)}</Text>
            </View>
            <Text style={[t.caption, { color: p.textMuted }]}>
              The same balance, depending entirely on how you redeem it.
            </Text>

            {use.upside > 0 ? (
              <View
                style={{
                  marginTop: space.sm,
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: `${p.positive}18`,
                  gap: 2,
                }}
              >
                <Text style={[t.label, { color: p.positive, fontWeight: '700' }]}>
                  {money(use.upside, false)} better
                </Text>
                <Text style={[t.caption, { color: p.textMuted }]}>
                  by choosing {use.best.route.label.toLowerCase()} over {use.defaultRoute.route.label.toLowerCase()}.
                </Text>
              </View>
            ) : null}
          </Card>

          <SectionHeader title="Every way to use them" />

          <View style={{ gap: space.sm }}>
            {use.routes.map((rv, index) => {
              const isBest = index === 0;
              const isDefault = rv.route.id === use.defaultRoute.route.id;
              return (
                <Card
                  key={rv.route.id}
                  style={{ gap: space.sm, borderColor: isBest ? p.positive : p.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                        <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>{rv.route.label}</Text>
                        {isBest ? <Chip label="BEST" tone="positive" /> : null}
                        {isDefault && !isBest ? <Chip label="MOST PEOPLE" tone="warning" /> : null}
                      </View>
                      <Text style={[t.caption, { color: p.textFaint }]}>
                        {rv.route.cpp.low === rv.route.cpp.high
                          ? `${rv.route.cpp.typical.toFixed(2)}¢ per point`
                          : `${rv.route.cpp.low.toFixed(2)}–${rv.route.cpp.high.toFixed(2)}¢ per point`}
                        {' · '}
                        {effortLabel(rv.route.effort)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[t.heading, { color: isBest ? p.positive : p.text }]}>
                        {money(rv.typical, false)}
                      </Text>
                      {rv.low !== rv.high ? (
                        <Text style={[t.caption, { color: p.textFaint }]}>
                          {money(rv.low, false)}–{money(rv.high, false)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {rv.route.note ? (
                    <Text style={[t.caption, { color: p.textMuted }]}>{rv.route.note}</Text>
                  ) : null}
                </Card>
              );
            })}
          </View>

          {use.partners.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <SectionHeader title="Transfer partners" />
              <Card style={{ gap: space.md }}>
                {(['airline', 'hotel'] as const).map((kind) => {
                  const group = use.partners.filter((x) => x.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <View key={kind} style={{ gap: space.sm }}>
                      <Text style={[t.caption, { color: p.textFaint, textTransform: 'uppercase', letterSpacing: 1 }]}>
                        {kind === 'airline' ? 'Airlines' : 'Hotels'}
                      </Text>
                      {group.map((partner) => (
                        <View
                          key={partner.name}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                        >
                          <Text style={[t.body, { color: p.text, flex: 1 }]}>{partner.name}</Text>
                          <Text style={[t.caption, { color: partner.ratio === 1 ? p.textMuted : p.warning, fontWeight: '600' }]}>
                            1:{partner.ratio}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
                <Text style={[t.caption, { color: p.textFaint, fontStyle: 'italic' }]}>
                  A higher ratio is not automatically better — Hilton&apos;s 1:2 buys points worth
                  about a quarter as much each. Partners as of {PARTNERS_AS_OF}; verify before
                  transferring, since transfers are irreversible.
                </Text>
              </Card>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
