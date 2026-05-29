import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signIn, signUp } from '../lib/firebase';
import { colors, font, radius, spacing } from '../theme';

export function SignInScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || password.length < 6)
      return setError('Enter an email and a password of at least 6 characters.');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      // onAuthStateChanged in App will swap to the app automatically.
    } catch (e) {
      setError(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#2E2470', '#141726']} style={styles.fill}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <View style={styles.logo}>
          <Ionicons name="flash" size={26} color="#0A0A0F" />
        </View>
        <Text style={styles.brand}>PULSE</Text>
        <Text style={styles.tagline}>Never miss what matters</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>
            {mode === 'in' ? 'Welcome back' : 'Create your account'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={submit} disabled={busy} style={{ marginTop: spacing(4) }}>
            <LinearGradient
              colors={['#9B82FF', '#5BD0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>
                {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ marginTop: spacing(4) }}>
            <Text style={styles.switch}>
              {mode === 'in'
                ? "New to Pulse? Create an account"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function friendly(msg: string): string {
  if (msg.includes('auth/invalid-credential') || msg.includes('wrong-password'))
    return 'Wrong email or password.';
  if (msg.includes('email-already-in-use')) return 'That email already has an account.';
  if (msg.includes('invalid-email')) return 'That email looks invalid.';
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { ...font.h1, color: colors.text, letterSpacing: 4, marginTop: spacing(4) },
  tagline: { ...font.body, color: colors.brandSoft, marginTop: spacing(1) },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing(5),
    marginTop: spacing(7),
  },
  heading: { ...font.h2, color: colors.text, marginBottom: spacing(4) },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    marginBottom: spacing(3),
  },
  error: { ...font.small, color: colors.critical, marginTop: spacing(1) },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  btnText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  switch: { ...font.small, color: colors.brandSoft, textAlign: 'center' },
});
