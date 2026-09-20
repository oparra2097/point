import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '../src/store/useAuth';
import { useWallet } from '../src/store/useWallet';
import { Splash } from '../src/ui/Splash';

/** Hold the logo briefly so a fast restore does not flash it and vanish. */
const MIN_SPLASH_MS = 900;

export default function RootLayout() {
  const restore = useAuth((s) => s.restore);
  const authReady = useAuth((s) => s.ready);
  const walletHydrated = useWallet((s) => s.hydrated);

  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const booted = authReady && walletHydrated && minElapsed;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {booted ? <Stack screenOptions={{ headerShown: false }} /> : <Splash />}
    </SafeAreaProvider>
  );
}
