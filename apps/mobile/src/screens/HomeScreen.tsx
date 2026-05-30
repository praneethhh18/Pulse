import React, { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, gradients, radius, spacing } from '../theme';
import {
  Card,
  EmptyState,
  ErrorState,
  Loader,
  SectionHeader,
  StatTile,
} from '../components/ui';
import { NudgeCard } from '../components/NudgeCard';
import { BriefingSheet } from '../components/BriefingSheet';
import { PeopleSheet } from '../components/PeopleSheet';
import { MoneySheet } from '../components/MoneySheet';
import { LearnSheet } from '../components/LearnSheet';
import { useI18n } from '../i18n';
import type { CalendarEvent, MatterEmail } from '../api/types';
import { API_URL } from '../config';

const EVENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  flight: 'airplane',
  meeting: 'people',
  doctor: 'medkit',
  interview: 'briefcase',
  exam: 'school',
  personal: 'person',
};

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [briefEventId, setBriefEventId] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['overview'], queryFn: api.overview });

  if (q.isLoading) return <Loader label="Reading your life…" />;
  if (q.isError || !q.data)
    return (
      <ErrorState
        message={(q.error as Error)?.message ?? 'Unknown error'}
        hint={`Is the API running at ${API_URL}? Start it with: cd apps/api && npm run start:prod`}
      />
    );

  const d = q.data;
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';

  return (
    <>
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: spacing(10) }}
      refreshControl={
        <RefreshControl
          refreshing={q.isFetching}
          onRefresh={q.refetch}
          tintColor={colors.brand}
        />
      }
    >
      {/* Hero */}
      <LinearGradient colors={gradients.hero} style={[styles.hero, { paddingTop: insets.top + spacing(4) }]}>
        <View style={styles.brandRow}>
          <View style={styles.logoDot}>
            <Ionicons name="flash" size={14} color="#0A0A0F" />
          </View>
          <Text style={styles.brandText}>PULSE</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setLearnOpen(true)} hitSlop={8} style={{ marginRight: spacing(3) }}>
            <Ionicons name="school" size={20} color={colors.brandSoft} />
          </Pressable>
          <Pressable onPress={() => setMoneyOpen(true)} hitSlop={8} style={{ marginRight: spacing(3) }}>
            <Ionicons name="wallet" size={20} color={colors.brandSoft} />
          </Pressable>
          <Pressable onPress={() => setPeopleOpen(true)} hitSlop={8} style={{ marginRight: spacing(3) }}>
            <Ionicons name="people" size={20} color={colors.brandSoft} />
          </Pressable>
          <ModeBadge
            storage={d.mode.storage}
            ai={d.mode.ai}
          />
        </View>
        <Text style={styles.greeting}>{t(greetingKey, { name: d.greetingName })}</Text>
        <Text style={styles.subGreeting}>
          {d.stats.nudges > 0
            ? t('home.caught', { n: d.stats.nudges })
            : t('home.allHandled')}
        </Text>

        <View style={styles.statsRow}>
          <StatTile value={d.stats.documents} label={t('home.documents')} icon="folder-open" />
          <StatTile value={d.stats.watching} label={t('home.watching')} icon="eye" />
          <StatTile value={d.stats.nudges} label={t('home.nudges')} icon="notifications" />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Nudges — the soul of Pulse */}
        <SectionHeader
          title={t('home.noticed')}
          icon="sparkles"
          caption={d.nudges.length ? `${d.nudges.length} active` : undefined}
        />
        {d.nudges.length ? (
          d.nudges.map((n) => <NudgeCard key={n._id} nudge={n} />)
        ) : (
          <EmptyState icon="checkmark-done-circle" text="Nothing needs you right now." />
        )}

        {/* Needs you */}
        <SectionHeader title={t('home.needsYou')} icon="mail-unread" />
        {d.matters.length ? (
          d.matters.map((m) => <MatterRow key={m._id} email={m} />)
        ) : (
          <EmptyState icon="mail-open" text="Inbox under control." />
        )}

        {/* Coming up */}
        <SectionHeader title={t('home.comingUp')} icon="calendar" />
        <Card>
          {d.upcoming.length ? (
            d.upcoming.map((e, i) => (
              <EventRow
                key={e._id}
                event={e}
                last={i === d.upcoming.length - 1}
                onPress={() => setBriefEventId(e._id)}
              />
            ))
          ) : (
            <Text style={styles.dim}>No upcoming events.</Text>
          )}
        </Card>
      </View>
    </ScrollView>
    <BriefingSheet eventId={briefEventId} onClose={() => setBriefEventId(null)} />
    <PeopleSheet visible={peopleOpen} onClose={() => setPeopleOpen(false)} />
    <MoneySheet visible={moneyOpen} onClose={() => setMoneyOpen(false)} />
    <LearnSheet visible={learnOpen} onClose={() => setLearnOpen(false)} />
    </>
  );
}

function ModeBadge({ storage, ai }: { storage: string; ai: string }) {
  const live = storage === 'mongo' && ai === 'gemini';
  return (
    <View style={[styles.modeBadge, { borderColor: live ? colors.success : colors.warning }]}>
      <View style={[styles.modeDot, { backgroundColor: live ? colors.success : colors.warning }]} />
      <Text style={[styles.modeText, { color: live ? colors.success : colors.warning }]}>
        {live ? 'LIVE' : 'DEMO'}
      </Text>
    </View>
  );
}

function MatterRow({ email }: { email: MatterEmail }) {
  const color =
    email.urgency === 'critical' ? colors.critical : colors.warning;
  return (
    <Card style={styles.matterCard}>
      <View style={[styles.matterBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.matterTop}>
          <Text style={styles.matterFrom} numberOfLines={1}>
            {email.from}
          </Text>
          {email.dismissed ? (
            <View style={styles.resurfaced}>
              <Ionicons name="refresh" size={10} color={colors.brandSoft} />
              <Text style={styles.resurfacedText}>resurfaced</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.matterSubject} numberOfLines={1}>
          {email.subject}
        </Text>
        <Text style={styles.matterSummary} numberOfLines={2}>
          {email.summary}
        </Text>
      </View>
    </Card>
  );
}

function EventRow({
  event,
  last,
  onPress,
}: {
  event: CalendarEvent;
  last: boolean;
  onPress: () => void;
}) {
  const d = new Date(event.startsAt);
  const { t } = useI18n();
  return (
    <Pressable
      style={[styles.eventRow, !last && styles.eventDivider]}
      onPress={onPress}
    >
      <View style={styles.eventIcon}>
        <Ionicons
          name={EVENT_ICON[event.type] ?? 'time'}
          size={16}
          color={colors.brandSoft}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventBrief}>{t('home.tapPrepare')}</Text>
      </View>
      <Text style={styles.eventTime}>
        {d.toLocaleDateString('en-IN', { weekday: 'short' })}{'\n'}
        <Text style={styles.eventTimeBold}>
          {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(6),
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  logoDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { ...font.h3, color: colors.text, letterSpacing: 3 },
  greeting: { ...font.h1, color: colors.text, marginTop: spacing(5) },
  subGreeting: { ...font.body, color: colors.brandSoft, marginTop: spacing(1.5) },
  statsRow: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(5) },
  body: { paddingHorizontal: spacing(5), marginTop: spacing(2) },
  dim: { ...font.body, color: colors.textFaint },

  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { ...font.tiny },

  matterCard: {
    flexDirection: 'row',
    gap: spacing(3),
    marginBottom: spacing(2.5),
    overflow: 'hidden',
  },
  matterBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  matterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matterFrom: { ...font.tiny, color: colors.textFaint, textTransform: 'none', flex: 1 },
  matterSubject: { ...font.h3, color: colors.text, marginTop: 2 },
  matterSummary: { ...font.small, color: colors.textDim, marginTop: spacing(1.5), lineHeight: 18 },
  resurfaced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(124,92,255,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  resurfacedText: { ...font.tiny, color: colors.brandSoft, textTransform: 'none' },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
  },
  eventDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(124,92,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: { ...font.body, color: colors.text, fontWeight: '600' },
  eventMeta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  eventBrief: { ...font.tiny, color: colors.brandSoft, textTransform: 'none', marginTop: 2 },
  eventTime: { ...font.tiny, color: colors.textFaint, textAlign: 'right', textTransform: 'none' },
  eventTimeBold: { ...font.small, color: colors.textDim },
});
