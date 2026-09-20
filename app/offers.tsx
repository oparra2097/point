import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARDS_BY_ID } from '../src/data/cards';
import { ISSUERS } from '../src/data/issuers';
import { describeOffer, unactivatedOffers } from '../src/engine/atStore';
import { daysUntil } from '../src/engine/dates';
import { displayMerchant } from '../src/engine/merchant';
import { parseOffer } from '../src/engine/parseOffer';
import { useWallet } from '../src/store/useWallet';
import { Button, Card, Chip, Empty, SectionHeader } from '../src/ui/components';
import { radius, space, type as t, usePalette } from '../src/ui/theme';

export default function OffersScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const cards = useWallet((s) => s.cards);
  const offers = useWallet((s) => s.offers);
  const setActivated = useWallet((s) => s.setActivated);
  const removeOffer = useWallet((s) => s.removeOffer);
  const addOffer = useWallet((s) => s.addOffer);

  const [adding, setAdding] = useState(false);
  const [draftCard, setDraftCard] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftMerchant, setDraftMerchant] = useState('');

  const pending = useMemo(() => unactivatedOffers(offers), [offers]);

  const sorted = useMemo(
    () =>
      [...offers].sort((a, b) => {
        if (a.activated !== b.activated) return a.activated ? 1 : -1;
        if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
        return a.expiresAt ? -1 : 1;
      }),
    [offers],
  );

  // Live parse preview, so the user sees what was understood before saving.
  const parsed = useMemo(
    () => (draftText.trim() ? parseOffer(draftText, draftMerchant) : null),
    [draftText, draftMerchant],
  );

  function saveDraft() {
    if (!parsed || !draftCard || parsed.kind === 'unknown') return;
    addOffer({
      cardId: draftCard,
      merchant: draftMerchant || parsed.merchant,
      kind: parsed.kind,
      minSpend: parsed.minSpend,
      amountBack: parsed.amountBack,
      percentBack: parsed.percentBack,
      maxBack: parsed.maxBack,
      pointsBack: parsed.pointsBack,
      expiresAt: parsed.expiresAt,
      activated: false,
      source: 'manual',
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraftText('');
    setDraftMerchant('');
    setAdding(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[t.title, { color: p.text }]}>Offers</Text>
        <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
          Every offer across every card, in one place.
        </Text>
      </View>

      {pending.length > 0 ? (
        <Card style={{ borderColor: p.warning, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <MaterialCommunityIcons name="alert-decagram-outline" size={22} color={p.warning} />
            <Text style={[t.heading, { color: p.text, flex: 1 }]}>
              {pending.length} offer{pending.length === 1 ? '' : 's'} not activated
            </Text>
          </View>
          <Text style={[t.caption, { color: p.textMuted }]}>
            An offer pays nothing until it is enrolled in the issuer&apos;s app. This is where most
            of the money leaks.
          </Text>
        </Card>
      ) : null}

      <SectionHeader
        title="All offers"
        action={
          <Pressable onPress={() => setAdding((v) => !v)} accessibilityRole="button" hitSlop={8}>
            <Text style={[t.label, { color: p.accent, fontWeight: '600' }]}>
              {adding ? 'Cancel' : '+ Add'}
            </Text>
          </Pressable>
        }
      />

      {adding ? (
        <Card style={{ gap: space.md }}>
          <Text style={[t.label, { color: p.textMuted }]}>Which card?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {cards.map((id) => {
              const card = CARDS_BY_ID[id];
              if (!card) return null;
              const selected = draftCard === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setDraftCard(id)}
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.sm,
                    backgroundColor: selected ? p.accent : p.surfaceAlt,
                  }}
                >
                  <Text style={[t.caption, { color: selected ? p.accentText : p.text, fontWeight: '600' }]}>
                    {card.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={draftMerchant}
            onChangeText={setDraftMerchant}
            placeholder="Merchant (e.g. Mango)"
            placeholderTextColor={p.textFaint}
            style={[t.body, { color: p.text, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: space.md }]}
          />
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            placeholder="Paste the offer, e.g. Spend $100 or more, get $25 back. Expires 12/31/26"
            placeholderTextColor={p.textFaint}
            multiline
            style={[t.body, { color: p.text, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: space.md, minHeight: 72 }]}
          />

          {parsed ? (
            <View style={{ gap: space.xs }}>
              <Text style={[t.caption, { color: p.textMuted }]}>Understood as</Text>
              {parsed.kind === 'unknown' ? (
                <Text style={[t.label, { color: p.danger }]}>
                  Could not read those terms. Try including the dollar amount or percent.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>
                    {describeOffer(parsed)}
                  </Text>
                  {parsed.expiresAt ? <Chip label={`Expires ${parsed.expiresAt}`} /> : null}
                  {parsed.confidence < 0.6 ? <Chip label="Low confidence" tone="warning" /> : null}
                </View>
              )}
            </View>
          ) : null}

          <Button
            label="Save offer"
            onPress={saveDraft}
            disabled={!parsed || parsed.kind === 'unknown' || !draftCard}
          />
        </Card>
      ) : null}

      {sorted.length === 0 ? (
        <Card>
          <Empty
            icon="tag-off-outline"
            title="No offers yet"
            body="Add offers from your issuer apps and point will surface the right one when you are standing in the store."
          />
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        {sorted.map((offer) => {
          const card = CARDS_BY_ID[offer.cardId];
          if (!card) return null;
          const issuer = ISSUERS[card.issuer];
          const left = offer.expiresAt ? daysUntil(offer.expiresAt) : undefined;
          const urgent = left !== undefined && left <= 7;

          return (
            <Card key={offer.id} style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: card.colors[0] }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[t.heading, { color: p.text }]}>{displayMerchant(offer.merchant)}</Text>
                  <Text style={[t.label, { color: p.positive, fontWeight: '600' }]}>{describeOffer(offer)}</Text>
                  <Text style={[t.caption, { color: p.textMuted }]}>
                    {card.name} - {issuer.offerProgram}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  {left !== undefined ? (
                    <Chip
                      label={left < 0 ? 'Expired' : left === 0 ? 'Today' : `${left}d left`}
                      tone={left < 0 ? 'neutral' : urgent ? 'warning' : 'neutral'}
                    />
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Switch
                  value={offer.activated}
                  onValueChange={(v) => {
                    void Haptics.selectionAsync();
                    setActivated(offer.id, v);
                  }}
                  trackColor={{ true: p.positive, false: p.border }}
                />
                <Text style={[t.caption, { color: offer.activated ? p.positive : p.warning, flex: 1, fontWeight: '600' }]}>
                  {offer.activated ? 'Activated' : 'Not activated'}
                </Text>

                {!offer.activated ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      Linking.openURL(issuer.webFallback).catch(() => undefined)
                    }
                    hitSlop={8}
                  >
                    <Text style={[t.caption, { color: p.accent, fontWeight: '600' }]}>
                      Open {issuer.shortName}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={() => removeOffer(offer.id)} accessibilityRole="button" hitSlop={8}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={p.textFaint} />
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
