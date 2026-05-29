import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from './src/theme';
import { HomeScreen } from './src/screens/HomeScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { GuardianScreen } from './src/screens/GuardianScreen';
import { AskScreen } from './src/screens/AskScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { authEnabled, watchAuth, getIdToken } from './src/lib/firebase';
import { setAuthTokenGetter } from './src/api/client';
import { I18nProvider, useI18n } from './src/i18n';
import type { TranslationKey } from './src/i18n/translations';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.border,
    primary: colors.brand,
  },
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Vault: 'folder-open',
  Guardian: 'shield-checkmark',
  Ask: 'sparkles',
  Settings: 'settings',
};

function MainTabs() {
  const { t } = useI18n();
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.brandSoft,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarLabel: t(`tabs.${route.name.toLowerCase()}` as TranslationKey),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICONS[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Vault" component={VaultScreen} />
        <Tab.Screen name="Guardian" component={GuardianScreen} />
        <Tab.Screen name="Ask" component={AskScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function Root() {
  // undefined = still resolving auth; null = signed out; object = signed in.
  const [user, setUser] = useState<unknown>(authEnabled ? undefined : null);

  useEffect(() => {
    setAuthTokenGetter(getIdToken);
    if (!authEnabled) return;
    return watchAuth((u) => setUser(u));
  }, []);

  if (authEnabled && user === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (authEnabled && !user) return <SignInScreen />;

  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Root />
        </QueryClientProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
