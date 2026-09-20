import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ISSUERS } from '../../src/data/issuers';
import { describeOffer } from '../../src/engine/atStore';
import { daysUntil } from '../../src/engine/dates';
import { displayMerchant } from '../../src/engine/merchant';
import { offerMerchants, searchOffers } from '../../src/engine/search';
import { useWallet } from '../../src/store/useWallet';
import { Card, Chip, Empty } from '../../src/ui/components';
import { radius, space, type as t, usePalette } from '../../src/ui/theme';

export default function SearchScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const offers = useWallet((s) => s.offers);
  const [query, setQuery] = useState('');

  const hits = useMemo(() => searchOffers(query, offers), [query, offers]);
  const suggestions = useMemo(() => offerMerchants(offers).slice(0, 8), [offers]);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[t.title, { color: p.text }]}>Search</Text>
        <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
          Find an offer, or check a store before you go.
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <MaterialCommunityIcons name="magnify" size={20} color={p.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchants"
          placeholderTextColor={p.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          style={[t.heading, { color: p.text, flex: 1, paddingVertical: space.sm }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={p.textFaint} />
          </Pressable>
        ) : null}
      </Card>

      {!query && suggestions.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={[t.label, { color: p.textMuted }]}>Stores with offers</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => setQuery(displayMerchant(name))}
                accessibilityRole="button"
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.sm,
                  backgroundColor: p.surfaceAlt,
                }}
              >
                <Text style={[t.caption, { color: p.text }]}>{displayMerchant(name)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {query && hits.length === 0 ? (
        <Card>
          <Empty
            icon="magnify-close"
            title="No offers here"
            body={`Nothing in your wallet matches "${query}". You can still check which card earns most there.`}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/', params: { merchant: query } })}
          >
            <Text style={[t.label, { color: p.accent, textAlign: 'center', fontWeight: '600' }]}>
              Check best card at {query}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        {hits.map(({ offer, card }) => {
          const left = offer.expiresAt ? daysUntil(offer.expiresAt) : undefined;
          return (
            <Pressable
              key={offer.id}
              accessibilityRole="button"
              accessibilityLabel={`Check ${displayMerchant(offer.merchant)}`}
              onPress={() =>
                router.push({ pathname: '/', params: { merchant: displayMerchant(offer.merchant) } })
              }
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: card.colors[0] }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>
                    {displayMerchant(offer.merchant)}
                  </Text>
                  <Text style={[t.caption, { color: p.positive, fontWeight: '600' }]}>
                    {describeOffer(offer)}
                  </Text>
                  <Text style={[t.caption, { color: p.textMuted }]}>
                    {card.name} · {ISSUERS[card.issuer].offerProgram}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  {!offer.activated ? <Chip label="NOT ACTIVE" tone="warning" /> : null}
                  {left !== undefined ? (
                    <Text style={[t.caption, { color: left <= 7 ? p.warning : p.textFaint }]}>
                      {left < 0 ? 'Expired' : left === 0 ? 'Today' : `${left}d`}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
