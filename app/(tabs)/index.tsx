import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayMerchant } from '../../src/engine/merchant';
import { atStore, type CardAtStore } from '../../src/engine/atStore';
import { useWallet } from '../../src/store/useWallet';
import { Button, Card, Chip, Empty } from '../../src/ui/components';
import { money, radius, space, type as t, usePalette } from '../../src/ui/theme';

const PRESETS = [25, 50, 100, 250];

export default function NowScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const cards = useWallet((s) => s.cards);
  const offers = useWallet((s) => s.offers);
  const cppOverrides = useWallet((s) => s.cppOverrides);
  const setActivated = useWallet((s) => s.setActivated);

  const [merchant, setMerchant] = useState('Mango');
  const [amount, setAmount] = useState('100');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const basket = Number.parseFloat(amount) || 0;

  const ranked = useMemo(
    () => (merchant.trim() ? atStore(merchant, basket, cards, offers, { cppOverrides }) : []),
    [merchant, basket, cards, offers, cppOverrides],
  );

  /**
   * Suggest a merchant from GPS.
   *
   * Reverse geocoding returns an address, and only sometimes a point-of-
   * interest name -- it cannot reliably identify "the Mango in this mall".
   * Real merchant detection needs a places provider; until then this fills the
   * field with a best guess the user is expected to correct.
   */
  async function useMyLocation() {
    setLocating(true);
    setLocationNote(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationNote('Location permission denied. Type the store name instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      if (place?.name) {
        setMerchant(place.name);
        setLocationNote('Best guess from your location - correct it if wrong.');
      } else {
        setLocationNote('Could not identify a store here. Type the name instead.');
      }
    } catch {
      setLocationNote('Location unavailable. Type the store name instead.');
    } finally {
      setLocating(false);
    }
  }

  /**
   * Hand off to the issuer so the offer can be enrolled.
   *
   * There is no way to verify enrolment from outside the issuer's app, so the
   * offer is marked activated optimistically and stays togglable on the Offers
   * tab if the user backs out.
   */
  async function activate(entry: CardAtStore) {
    const offer = entry.bestOffer?.offer;
    if (!offer) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { appScheme, webFallback } = entry.issuer;
    try {
      if (appScheme && (await Linking.canOpenURL(appScheme))) await Linking.openURL(appScheme);
      else await Linking.openURL(webFallback);
    } catch {
      await Linking.openURL(webFallback).catch(() => undefined);
    }
    setActivated(offer.id, true);
  }

  const winner = ranked[0];
  const rest = ranked.slice(1);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[t.title, { color: p.text }]}>Where are you?</Text>
        <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
          Find the card with an offer here before you pay.
        </Text>
      </View>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <MaterialCommunityIcons name="storefront-outline" size={20} color={p.textMuted} />
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Store name"
            placeholderTextColor={p.textFaint}
            autoCorrect={false}
            style={[t.heading, { color: p.text, flex: 1, paddingVertical: space.sm }]}
          />
          <Pressable
            onPress={useMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Use my location"
            hitSlop={8}
          >
            {locating ? (
              <ActivityIndicator size="small" color={p.accent} />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={p.accent} />
            )}
          </Pressable>
        </View>

        {locationNote ? (
          <Text style={[t.caption, { color: p.textMuted }]}>{locationNote}</Text>
        ) : null}

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[t.heading, { color: p.textMuted }]}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={p.textFaint}
            style={[t.heading, { color: p.text, flex: 1, paddingVertical: space.sm }]}
          />
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {PRESETS.map((v) => (
              <Pressable
                key={v}
                onPress={() => setAmount(String(v))}
                accessibilityRole="button"
                style={{
                  paddingHorizontal: space.sm,
                  paddingVertical: space.xs,
                  borderRadius: radius.sm,
                  backgroundColor: basket === v ? p.accent : p.surfaceAlt,
                }}
              >
                <Text style={[t.caption, { color: basket === v ? p.accentText : p.textMuted, fontWeight: '600' }]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {cards.length === 0 ? (
        <Card>
          <Empty
            icon="credit-card-plus-outline"
            title="No cards yet"
            body="Add the cards you carry and point will tell you which one to pull out."
          />
          <Link href="/wallet" asChild>
            <Pressable accessibilityRole="button">
              <Text style={[t.label, { color: p.accent, textAlign: 'center', fontWeight: '600' }]}>
                Go to Wallet
              </Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      {winner ? (
        <View style={{ gap: space.md }}>
          <LinearGradient
            colors={winner.card.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.xl, padding: space.xl, gap: space.md }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[t.caption, { color: '#FFFFFFAA', fontWeight: '600', letterSpacing: 1 }]}>
                  USE THIS CARD
                </Text>
                <Text style={[t.heading, { color: '#FFFFFF', marginTop: space.xs }]}>{winner.card.name}</Text>
              </View>
              {winner.offerValue > 0 ? <Chip label="OFFER" tone="accent" /> : null}
            </View>

            <View>
              <Text style={[t.display, { color: '#FFFFFF' }]}>{money(winner.totalValue)}</Text>
              <Text style={[t.label, { color: '#FFFFFFCC' }]}>
                back at {displayMerchant(merchant)} - {(winner.effectiveRate * 100).toFixed(1)}% of {money(basket, false)}
              </Text>
            </View>

            <View style={{ gap: space.xs }}>
              {winner.reasons.map((r) => (
                <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <MaterialCommunityIcons name="circle-small" size={16} color="#FFFFFFAA" />
                  <Text style={[t.caption, { color: '#FFFFFFDD', flex: 1 }]}>{r}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {winner.needsActivation ? (
            <Card style={{ gap: space.md, borderColor: p.warning }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={p.warning} />
                <Text style={[t.label, { color: p.text, flex: 1 }]}>
                  This offer pays nothing until you activate it
                  {winner.expiresInDays !== undefined ? ` - ${winner.expiresInDays} days left` : ''}.
                </Text>
              </View>
              <Button
                label={`Activate in ${winner.issuer.shortName}`}
                icon="open-in-new"
                onPress={() => activate(winner)}
              />
            </Card>
          ) : null}
        </View>
      ) : null}

      {rest.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={[t.label, { color: p.textMuted }]}>Your other cards here</Text>
          {rest.map((entry) => (
            <Card key={entry.card.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: entry.card.colors[0] }} />
              <View style={{ flex: 1 }}>
                <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>{entry.card.name}</Text>
                <Text style={[t.caption, { color: p.textMuted, marginTop: 2 }]}>{entry.reasons[0]}</Text>
                {entry.bestOffer?.shortfall !== undefined ? (
                  <Text style={[t.caption, { color: p.warning, marginTop: 2 }]}>
                    Spend {money(entry.bestOffer.shortfall)} more for {money(entry.bestOffer.potentialValue)} back
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[t.heading, { color: p.text }]}>{money(entry.totalValue)}</Text>
                <Text style={[t.caption, { color: p.textFaint }]}>
                  {(entry.effectiveRate * 100).toFixed(1)}%
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
