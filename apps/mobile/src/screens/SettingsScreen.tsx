import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_URL } from '../api/client';
import { colors, font, radius, spacing } from '../theme';
import { Card, SectionHeader } from '../components/ui';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const gmail = useQuery({ queryKey: ['gmail-status'], queryFn: api.gmailStatus });

  const connect = useMutation({
    mutationFn: api.gmailAuthUrl,
    onSuccess: async (r) => {
      if (r.url) await Linking.openURL(r.url);
      else Alert.alert('Not configured', 'Add Google OAuth credentials to the API first.');
    },
    onError: (e) => Alert.alert('Error', (e as Error).message),
  });

  const sync = useMutation({
    mutationFn: api.gmailSync,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      Alert.alert('Synced', `${r.added} new email(s) from ${r.fetched} fetched.`);
    },
    onError: (e) => Alert.alert('Sync failed', (e as Error).message),
  });

  const g = gmail.data;
  const live = health.data?.storage === 'mongo' && health.data?.ai === 'gemini';

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing(5),
        paddingTop: insets.top + spacing(4),
        paddingBottom: spacing(10),
      }}
    >
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Connections & system</Text>

      {/* Connections */}
      <SectionHeader title="Connections" icon="link" />
      <Card>
        <View style={styles.row}>
          <View style={styles.iconBubble}>
            <Ionicons name="mail" size={20} color={colors.brandSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Gmail</Text>
            <Text style={styles.rowSub}>
              {!g
                ? 'Checking…'
                : !g.configured
                  ? 'Not set up yet — add Google credentials'
                  : g.connected
                    ? `Connected${g.email ? ' · ' + g.email : ''}`
                    : 'Ready to connect'}
            </Text>
          </View>
          <StatusPill
            color={
              !g?.configured ? colors.textFaint : g?.connected ? colors.success : colors.warning
            }
            label={!g?.configured ? 'OFF' : g?.connected ? 'LIVE' : 'READY'}
          />
        </View>

        {g?.configured && !g.connected ? (
          <Pressable onPress={() => connect.mutate()} style={{ marginTop: spacing(3) }}>
            <LinearGradient
              colors={['#9B82FF', '#5BD0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Ionicons name="log-in" size={16} color="#0A0A0F" />
              <Text style={styles.btnText}>
                {connect.isPending ? 'Opening…' : 'Connect Gmail'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        {g?.connected ? (
          <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
            <Pressable onPress={() => sync.mutate()} style={styles.outlineBtn}>
              <Ionicons name="sync" size={15} color={colors.brandSoft} />
              <Text style={styles.outlineText}>
                {sync.isPending ? 'Syncing…' : 'Sync now'}
              </Text>
            </Pressable>
            {g.lastSyncAt ? (
              <Text style={styles.note}>
                Last sync {new Date(g.lastSyncAt).toLocaleString()}
              </Text>
            ) : (
              <Text style={styles.note}>Auto-syncs in the background every 2 min.</Text>
            )}
          </View>
        ) : null}

        {g && !g.configured ? (
          <Text style={styles.note}>
            Add GOOGLE_CLIENT_ID / SECRET to the API .env, then Pulse will watch your
            inbox automatically.
          </Text>
        ) : null}
      </Card>

      {/* System */}
      <SectionHeader title="System" icon="hardware-chip" />
      <Card>
        <ModeRow
          icon="server"
          label="Storage"
          value={health.data?.storage === 'mongo' ? 'MongoDB Atlas' : 'In-memory (demo)'}
          ok={health.data?.storage === 'mongo'}
        />
        <View style={styles.divider} />
        <ModeRow
          icon="sparkles"
          label="AI engine"
          value={health.data?.ai === 'gemini' ? 'Gemini 2.5 Pro' : 'Mock (demo)'}
          ok={health.data?.ai === 'gemini'}
        />
        <View style={styles.divider} />
        <ModeRow icon="globe" label="API" value={API_URL} ok mono />
      </Card>

      <View style={[styles.banner, { borderColor: live ? colors.success : colors.warning }]}>
        <Ionicons
          name={live ? 'shield-checkmark' : 'flask'}
          size={16}
          color={live ? colors.success : colors.warning}
        />
        <Text style={[styles.bannerText, { color: live ? colors.success : colors.warning }]}>
          {live ? 'Running fully live' : 'Demo mode — add keys to go live'}
        </Text>
      </View>

      <Text style={styles.footer}>Pulse · Never miss what matters</Text>
    </ScrollView>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function ModeRow({
  icon,
  label,
  value,
  ok,
  mono,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  ok?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textDim} />
      <Text style={styles.modeLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text
        style={[
          styles.modeValue,
          mono && { fontSize: 12 },
          { color: ok ? colors.text : colors.warning },
        ]}
        numberOfLines={1}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.textDim, marginTop: spacing(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(124,92,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...font.h3, color: colors.text },
  rowSub: { ...font.small, color: colors.textDim, marginTop: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...font.tiny },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    paddingVertical: spacing(3),
  },
  btnText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing(3),
  },
  outlineText: { ...font.small, color: colors.brandSoft, fontWeight: '700' },
  note: { ...font.small, color: colors.textFaint, marginTop: spacing(2), lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(3) },
  modeLabel: { ...font.body, color: colors.textDim },
  modeValue: { ...font.small, color: colors.text, fontWeight: '600', maxWidth: '60%' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(3.5),
    marginTop: spacing(5),
  },
  bannerText: { ...font.small, fontWeight: '700' },
  footer: {
    ...font.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing(6),
  },
});
