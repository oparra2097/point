import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';

import { space, type as t } from './theme';

/**
 * Launch and loading screen.
 *
 * Shown while persisted state is read back and the session is restored. The
 * mark fades and springs in, then breathes on a slow loop so a slow restore
 * still looks alive rather than hung. All three animations run on the native
 * driver, so they keep running smoothly even while the JS thread is busy
 * parsing storage -- which is exactly when this screen is on display.
 */
export function Splash({ label }: { label?: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale, breathe]);

  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  return (
    <LinearGradient
      colors={['#2E7CF6', '#0B3D91']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}
    >
      <Animated.View style={{ opacity, transform: [{ scale }, { scale: breatheScale }] }}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={{ width: 132, height: 132 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="point"
        />
      </Animated.View>

      <Animated.View style={{ opacity }}>
        <Text style={[t.caption, { color: '#FFFFFFAA', letterSpacing: 2, textAlign: 'center' }]}>
          {(label ?? 'POINT').toUpperCase()}
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}
