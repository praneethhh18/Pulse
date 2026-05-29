import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, shadow, spacing } from '../theme';
import { Card, Chip, EmptyState, Loader } from '../components/ui';
import { AddEmailSheet } from '../components/AddEmailSheet';
import type { EmailItem, Urgency } from '../api/types';

const URGENCY: Record<Urgency, { color: string; label: string }> = {
  critical: { color: colors.critical, label: 'Critical' },
  action: { color: colors.warning, label: 'Action' },
  informational: { color: colors.info, label: 'Info' },
  promotional: { color: colors.textFaint, label: 'Promo' },
};

export function GuardianScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const emails = useQuery({ queryKey: ['emails'], queryFn: api.emails });
  const handle = useMutation({
    mutationFn: (id: string) => api.handleEmail(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  if (emails.isLoading) return <Loader label="Reading your inbox…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing(3) }}>
      <View style={styles.head}>
        <Text style={styles.title}>Guardian</Text>
        <Text style={styles.subtitle}>
          Every message read. Only what matters surfaced.
        </Text>
      </View>
      <FlatList
        data={emails.data ?? []}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ padding: spacing(5), gap: spacing(3) }}
        ListEmptyComponent={<EmptyState icon="mail" text="No messages." />}
        renderItem={({ item }) => (
          <EmailCard
            email={item}
            onHandle={() => handle.mutate(item._id)}
            handling={handle.isPending && handle.variables === item._id}
          />
        )}
      />

      <Pressable style={[styles.fab, shadow.glow]} onPress={() => setShowAdd(true)}>
        <LinearGradient
          colors={['#9B82FF', '#5BD0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={28} color="#0A0A0F" />
        </LinearGradient>
      </Pressable>

      <AddEmailSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

function EmailCard({
  email,
  onHandle,
  handling,
}: {
  email: EmailItem;
  onHandle: () => void;
  handling: boolean;
}) {
  const u = URGENCY[email.urgency];
  return (
    <Card style={{ opacity: email.handled ? 0.55 : 1 }}>
      <View style={styles.row}>
        <Chip label={u.label} color={u.color} filled={email.urgency === 'critical'} />
        {email.dismissed ? (
          <View style={styles.resurfaced}>
            <Ionicons name="refresh" size={11} color={colors.brandSoft} />
            <Text style={styles.resurfacedText}>resurfaced</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {email.deadline ? (
          <View style={styles.deadline}>
            <Ionicons name="alarm-outline" size={12} color={u.color} />
            <Text style={[styles.deadlineText, { color: u.color }]}>
              {new Date(email.deadline).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.from} numberOfLines={1}>
        {email.from}
      </Text>
      <Text style={styles.subject}>{email.subject}</Text>
      <Text style={styles.summary}>{email.summary}</Text>

      {email.actionRequired ? (
        <Pressable
          style={[styles.handleBtn, email.handled && { borderColor: colors.success }]}
          onPress={email.handled ? undefined : onHandle}
        >
          <Ionicons
            name={email.handled ? 'checkmark-circle' : 'checkmark-done'}
            size={15}
            color={email.handled ? colors.success : colors.brandSoft}
          />
          <Text
            style={[
              styles.handleText,
              { color: email.handled ? colors.success : colors.brandSoft },
            ]}
          >
            {email.handled ? 'Handled' : handling ? 'Saving…' : 'Mark handled'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing(5) },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.textDim, marginTop: spacing(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  from: { ...font.tiny, color: colors.textFaint, textTransform: 'none', marginTop: spacing(3) },
  subject: { ...font.h3, color: colors.text, marginTop: 2 },
  summary: { ...font.small, color: colors.textDim, marginTop: spacing(2), lineHeight: 19 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { ...font.tiny, textTransform: 'none' },
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
  handleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    marginTop: spacing(3),
  },
  handleText: { ...font.small, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing(5),
    bottom: spacing(6),
    borderRadius: 30,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
