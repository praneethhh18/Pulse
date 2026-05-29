import React from 'react';
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

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
