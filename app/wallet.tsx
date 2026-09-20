import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARD_CATALOG, CARDS_BY_ID, creditsPerYear } from '../src/data/cards';
import { ISSUERS } from '../src/data/issuers';
import { useWallet } from '../src/store/useWallet';
import { Button, Card, Chip, Empty, SectionHeader } from '../src/ui/components';
import { money, radius, space, type as t, usePalette } from '../src/ui/theme';

export default function WalletScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const cards = useWallet((s) => s.cards);
  const offers = useWallet((s) => s.offers);
  const addCard = useWallet((s) => s.addCard);
  const removeCard = useWallet((s) => s.removeCard);
  const loadDemo = useWallet((s) => s.loadDemo);
  const reset = useWallet((s) => s.reset);

  const available = CARD_CATALOG.filter((c) => !cards.includes(c.id));

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}
    >
      <View>
        <Text style={[t.title, { color: p.text }]}>Wallet</Text>
        <Text style={[t.body, { color: p.textMuted, marginTop: space.xs }]}>
          The cards you carry.
        </Text>
      </View>

      {cards.length === 0 ? (
        <Card style={{ gap: space.md }}>
          <Empty
            icon="credit-card-outline"
            title="Empty wallet"
            body="Add your cards below, or load sample data to see how the flow works."
          />
          <Button label="Load sample wallet" icon="flask-outline" onPress={loadDemo} variant="secondary" />
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        {cards.map((id) => {
          const card = CARDS_BY_ID[id];
          if (!card) return null;
          const issuer = ISSUERS[card.issuer];
          const credits = creditsPerYear(card);
          const offerCount = offers.filter((o) => o.cardId === id).length;

          return (
            <LinearGradient
              key={id}
              colors={card.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: radius.lg, padding: space.lg, gap: space.md }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[t.caption, { color: '#FFFFFFAA', fontWeight: '600', letterSpacing: 1 }]}>
                    {issuer.name.toUpperCase()}
                  </Text>
                  <Text style={[t.heading, { color: '#FFFFFF', marginTop: 2 }]}>{card.name}</Text>
                </View>
                <Pressable onPress={() => removeCard(id)} accessibilityRole="button" hitSlop={10}>
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color="#FFFFFFAA" />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: space.xl }}>
                <View>
                  <Text style={[t.caption, { color: '#FFFFFF99' }]}>Annual fee</Text>
                  <Text style={[t.label, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {card.annualFee === 0 ? 'None' : money(card.annualFee, false)}
                  </Text>
                </View>
                {credits > 0 ? (
                  <View>
                    <Text style={[t.caption, { color: '#FFFFFF99' }]}>Credits / yr</Text>
                    <Text style={[t.label, { color: '#FFFFFF', fontWeight: '600' }]}>{money(credits, false)}</Text>
                  </View>
                ) : null}
                <View>
                  <Text style={[t.caption, { color: '#FFFFFF99' }]}>Offers</Text>
                  <Text style={[t.label, { color: '#FFFFFF', fontWeight: '600' }]}>{offerCount}</Text>
                </View>
              </View>

              <Text style={[t.caption, { color: '#FFFFFF77' }]}>Terms as of {card.asOf}</Text>
            </LinearGradient>
          );
        })}
      </View>

      {available.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionHeader title="Add a card" />
          {available.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => addCard(card.id)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${card.name}`}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 28, height: 20, borderRadius: 4, backgroundColor: card.colors[0] }} />
                <View style={{ flex: 1 }}>
                  <Text style={[t.label, { color: p.text, fontWeight: '600' }]}>{card.name}</Text>
                  <Text style={[t.caption, { color: p.textMuted }]}>
                    {ISSUERS[card.issuer].shortName}
                    {card.annualFee > 0 ? ` - ${money(card.annualFee, false)}/yr` : ' - no annual fee'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="plus-circle-outline" size={22} color={p.accent} />
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      {cards.length > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Chip label="Sample data is illustrative, not real targeted offers" />
          <Button label="Clear everything" variant="secondary" icon="delete-outline" onPress={reset} />
        </View>
      ) : null}
    </ScrollView>
  );
}
