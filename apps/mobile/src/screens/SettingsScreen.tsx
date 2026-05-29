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
import { authEnabled, currentEmail, signOutUser } from '../lib/firebase';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { Card, SectionHeader } from '../components/ui';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { t, lang, setLang, languages } = useI18n();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const gmail = useQuery({ queryKey: ['gmail-status'], queryFn: api.gmailStatus });
  const calendar = useQuery({ queryKey: ['calendar-status'], queryFn: api.calendarStatus });

  const syncCal = useMutation({
    mutationFn: api.calendarSync,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['overview'] });
      Alert.alert('Calendar synced', `${r.added} new event(s) from ${r.fetched} fetched.`);
    },
    onError: (e) => Alert.alert('Sync failed', (e as Error).message),
  });

  const dataSummary = useQuery({ queryKey: ['data-summary'], queryFn: api.dataSummary });
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile });

  const exportMut = useMutation({
    mutationFn: api.exportData,
    onSuccess: (r) =>
      Alert.alert(
        'Your data is ready',
        `Exported ${r.totalRecords} records across ${r.categories} categories. (Full file export via the web companion.)`,
      ),
    onError: (e) => Alert.alert('Export failed', (e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteAllData,
    onSuccess: (r) => {
      qc.invalidateQueries();
      Alert.alert('Everything deleted', `${r.total} records permanently removed.`);
    },
    onError: (e) => Alert.alert('Delete failed', (e as Error).message),
  });

  const confirmDelete = () =>
    Alert.alert(
      'Delete everything?',
      'This permanently erases all your documents, emails, calendar and history from Pulse. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => deleteMut.mutate() },
      ],
    );

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
      <Text style={styles.title}>{t('settings.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>

      {/* Language — Pulse speaks your language */}
      <SectionHeader title={t('settings.language')} icon="language" />
      <Card>
        <Text style={[styles.dataNote, { marginBottom: spacing(3) }]}>
          {t('settings.languageHint')}
        </Text>
        <View style={styles.langRow}>
          {languages.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => setLang(l.code)}
              style={[styles.langChip, lang === l.code && styles.langChipActive]}
            >
              <Text
                style={[styles.langText, lang === l.code && styles.langTextActive]}
              >
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {authEnabled ? (
        <>
          <SectionHeader title={t('settings.account')} icon="person-circle" />
          <Card>
            <View style={styles.row}>
              <View style={styles.iconBubble}>
                <Ionicons name="person" size={20} color={colors.brandSoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Signed in</Text>
                <Text style={styles.rowSub}>{currentEmail() ?? 'your account'}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => signOutUser()}
              style={[styles.outlineBtn, { marginTop: spacing(3) }]}
            >
              <Ionicons name="log-out" size={15} color={colors.brandSoft} />
              <Text style={styles.outlineText}>{t('settings.signOut')}</Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      {/* Connections */}
      <SectionHeader title={t('settings.connections')} icon="link" />
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

      <View style={{ height: spacing(3) }} />

      <Card>
        <View style={styles.row}>
          <View style={styles.iconBubble}>
            <Ionicons name="calendar" size={20} color={colors.brandSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Google Calendar</Text>
            <Text style={styles.rowSub}>
              {!calendar.data
                ? 'Checking…'
                : !calendar.data.configured
                  ? 'Not set up yet — add Google credentials'
                  : calendar.data.connected
                    ? 'Connected · powers scheduling nudges'
                    : 'Connect Gmail above (same Google account)'}
            </Text>
          </View>
          <StatusPill
            color={
              !calendar.data?.configured
                ? colors.textFaint
                : calendar.data?.connected
                  ? colors.success
                  : colors.warning
            }
            label={
              !calendar.data?.configured ? 'OFF' : calendar.data?.connected ? 'LIVE' : 'READY'
            }
          />
        </View>

        {calendar.data?.connected ? (
          <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
            <Pressable onPress={() => syncCal.mutate()} style={styles.outlineBtn}>
              <Ionicons name="sync" size={15} color={colors.brandSoft} />
              <Text style={styles.outlineText}>
                {syncCal.isPending ? 'Syncing…' : 'Sync calendar'}
              </Text>
            </Pressable>
            <Text style={styles.note}>Auto-syncs in the background every 5 min.</Text>
          </View>
        ) : null}
      </Card>

      {/* System */}
      <SectionHeader title={t('settings.system')} icon="hardware-chip" />
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

      {/* What Pulse has learned — the grow-with-you memory */}
      <SectionHeader title={t('settings.learned')} icon="sparkles" />
      <Card>
        {profile.data && profile.data.facts.length ? (
          <View style={{ gap: spacing(2) }}>
            {profile.data.facts.map((f, i) => (
              <View key={i} style={styles.factRow}>
                <Ionicons name="ellipse" size={6} color={colors.brandSoft} />
                <Text style={styles.factText}>{f.replace(/^[-•]\s*/, '')}</Text>
              </View>
            ))}
            <Text style={styles.note}>
              Pulse learns this quietly as you chat — it never stops getting to know you.
            </Text>
          </View>
        ) : (
          <Text style={styles.dataNote}>
            Still getting to know you. Chat in Ask Pulse — try "remember I'm vegetarian"
            — and it'll appear here.
          </Text>
        )}
      </Card>

      {/* Your data — privacy controls */}
      <SectionHeader title={t('settings.yourData')} icon="lock-closed" />
      <Card>
        <Text style={styles.dataLine}>
          {dataSummary.data
            ? `Pulse holds ${dataSummary.data.total} record${dataSummary.data.total === 1 ? '' : 's'} across ${Object.keys(dataSummary.data.counts).length} categor${Object.keys(dataSummary.data.counts).length === 1 ? 'y' : 'ies'}.`
            : 'Your data, in your control.'}
        </Text>
        <Text style={styles.dataNote}>
          Your data is yours. Export it anytime, or erase it permanently.
        </Text>

        <Pressable onPress={() => exportMut.mutate()} style={[styles.outlineBtn, { marginTop: spacing(3) }]}>
          <Ionicons name="download" size={15} color={colors.brandSoft} />
          <Text style={styles.outlineText}>
            {exportMut.isPending ? 'Preparing…' : t('settings.export')}
          </Text>
        </Pressable>

        <Pressable onPress={confirmDelete} style={[styles.dangerBtn, { marginTop: spacing(2) }]}>
          <Ionicons name="trash" size={15} color={colors.critical} />
          <Text style={styles.dangerText}>
            {deleteMut.isPending ? 'Deleting…' : t('settings.delete')}
          </Text>
        </Pressable>
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
  dataLine: { ...font.body, color: colors.text, fontWeight: '600' },
  dataNote: { ...font.small, color: colors.textDim, marginTop: spacing(1), lineHeight: 18 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  langChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  langChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { ...font.body, color: colors.textDim },
  langTextActive: { color: '#0A0A0F', fontWeight: '700' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  factText: { ...font.body, color: colors.text, flex: 1 },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,107,134,0.5)',
    paddingVertical: spacing(3),
  },
  dangerText: { ...font.small, color: colors.critical, fontWeight: '700' },
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
