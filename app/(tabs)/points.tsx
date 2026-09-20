import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CURRENCY_LIST, CURRENCIES, type CurrencyId } from '../../src/data/currencies';
import { aggregatePoints } from '../../src/engine/points';
import { bestUse, portfolioUpside } from '../../src/engine/redeem';
import { useWallet } from '../../src/store/useWallet';
import { Card, Empty, SectionHeader } from '../../src/ui/components';
import { money, points as fmtPoints, radius, space, type as t, usePalette } from '../../src/ui/theme';

function monthsSince(iso: string, now = new Date()): number {
  const [y, m] = iso.split('-').map(Number);
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

export default function PointsScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const balances = useWallet((s) => s.balances);
  const cppOverrides = useWallet((s) => s.cppOverrides);
  const setBalance = useWallet((s) => s.setBalance);

  const [editing, setEditing] = useState<CurrencyId | null>(null);
  const [draft, setDraft] = useState('');

  const summary = useMemo(() => aggregatePoints(balances, cppOverrides), [balances, cppOverrides]);
  const uses = useMemo(() => bestUse(balances, cppOverrides), [balances, cppOverrides]);
  const useByCurrency = useMemo(() => new Map(uses.map((u) => [u.currency.id, u])), [uses]);
  const upside = useMemo(() => portfolioUpside(uses), [uses]);

  const held = new Set(summary.lines.map((l) => l.currency.id));
  const addable = CURRENCY_LIST.filter((c) => !held.has(c.id));

  function commit(id: CurrencyId) {
    const n = Number.parseFloat(draft.replace(/[^0-9.]/g, ''));
    setBalance(id, Number.isFinite(n) ? n : 0);
    setEditing(null);
    setDraft('');
  }

  const stale = summary.stalestUpdate ? monthsSince(summary.stalestUpdate) : 0;

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[t.title, { color: p.text }]}>Points</Text>
        <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
          Every program, valued in dollars.
        </Text>
      </View>

      <Card style={{ gap: space.sm }}>
        <Text style={[t.label, { color: p.textMuted }]}>Portfolio value</Text>
        <Text style={[t.display, { color: p.text }]}>{money(summary.totalValue, false)}</Text>
        <Text style={[t.caption, { color: p.textFaint }]}>
          {fmtPoints(summary.totalPoints)} points across {summary.lines.length} program
          {summary.lines.length === 1 ? '' : 's'}
        </Text>
        {/* Raw point totals span incomparable currencies, so the dollar figure
            leads and the count is deliberately secondary. */}
        <Text style={[t.caption, { color: p.textFaint, fontStyle: 'italic' }]}>
          Points across programs are not interchangeable - value is the comparable number.
        </Text>
      </Card>

      {upside.upside > 0 ? (
        <Card style={{ borderColor: p.positive, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <MaterialCommunityIcons name="trending-up" size={22} color={p.positive} />
            <Text style={[t.heading, { color: p.text, flex: 1 }]}>
              {money(upside.upside, false)} on the table
            </Text>
          </View>
          <Text style={[t.caption, { color: p.textMuted }]}>
            Taking the easy route on every program gives {money(upside.defaultTotal, false)}.
            Redeeming each at its best typical rate gives {money(upside.bestTotal, false)}, and up
            to {money(upside.bestCeiling, false)} at the top end.
          </Text>
        </Card>
      ) : null}

      {stale >= 3 ? (
        <Card style={{ borderColor: p.warning, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <MaterialCommunityIcons name="clock-alert-outline" size={20} color={p.warning} />
          <Text style={[t.caption, { color: p.textMuted, flex: 1 }]}>
            A balance has not been updated in {stale} months. Balances are entered by hand - no
            aggregator exposes rewards balances.
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="By program" />

      {summary.lines.length === 0 ? (
        <Card>
          <Empty
            icon="star-off-outline"
            title="No balances yet"
            body="Add a balance below to see what your points are actually worth."
          />
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        {summary.lines.map((line) => {
          const isEditing = editing === line.currency.id;
          return (
            <Card key={line.currency.id} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: line.currency.color }} />
                <View style={{ flex: 1 }}>
                  <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>{line.currency.name}</Text>
                  <Text style={[t.caption, { color: p.textMuted }]}>
                    {line.cpp.toFixed(2)}¢ per point
                    {line.currency.transferable ? ' - transferable' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[t.heading, { color: p.text }]}>{money(line.value, false)}</Text>
                  {isEditing ? (
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      onBlur={() => commit(line.currency.id)}
                      onSubmitEditing={() => commit(line.currency.id)}
                      keyboardType="number-pad"
                      autoFocus
                      style={[t.caption, { color: p.accent, minWidth: 90, textAlign: 'right', padding: 0 }]}
                    />
                  ) : (
                    <Pressable
                      onPress={() => {
                        setEditing(line.currency.id);
                        setDraft(String(line.amount));
                      }}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Text style={[t.caption, { color: p.accent }]}>{fmtPoints(line.amount)} pts</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Share of portfolio value, not of point count. */}
              <View style={{ height: 4, backgroundColor: p.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.max(2, line.share * 100)}%`,
                    height: '100%',
                    backgroundColor: line.currency.color,
                  }}
                />
              </View>

              {(() => {
                const u = useByCurrency.get(line.currency.id);
                if (!u) return null;
                return (
                  <Link href={`/program/${line.currency.id}`} asChild>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Best ways to use ${line.currency.name}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
                    >
                      <Text style={[t.caption, { color: p.accent, flex: 1, fontWeight: '600' }]}>
                        {u.upside > 0
                          ? `${money(u.upside, false)} better than cashing out`
                          : `Best use: ${u.best.route.label}`}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={p.accent} />
                    </Pressable>
                  </Link>
                );
              })()}
            </Card>
          );
        })}
      </View>

      {addable.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={[t.label, { color: p.textMuted }]}>Add a program</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {addable.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => {
                  setBalance(c.id, 1);
                  setEditing(c.id);
                  setDraft('');
                }}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.sm,
                  backgroundColor: p.surfaceAlt,
                }}
              >
                <Text style={[t.caption, { color: p.text }]}>{CURRENCIES[c.id].shortName}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
