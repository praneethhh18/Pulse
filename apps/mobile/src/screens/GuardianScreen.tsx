import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, shadow, spacing } from '../theme';
import { Card, Chip, EmptyState, Loader } from '../components/ui';
import { AddEmailSheet } from '../components/AddEmailSheet';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ open: false, loading: false, subject: '', text: '' });
  const emails = useQuery({ queryKey: ['emails'], queryFn: api.emails });

  const openDraft = async (id: string) => {
    setDraft({ open: true, loading: true, subject: '', text: '' });
    try {
      const r = await api.draftReply(id);
      setDraft({ open: true, loading: false, subject: r.subject, text: r.draft });
    } catch (e) {
      setDraft({ open: false, loading: false, subject: '', text: '' });
      Alert.alert('Draft failed', (e as Error).message);
    }
  };
  const copyDraft = async () => {
    await Clipboard.setStringAsync(draft.text);
    Alert.alert('Copied', 'Draft copied — paste it into your mail app to send.');
  };
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
        <Text style={styles.title}>{t('guardian.title')}</Text>
        <Text style={styles.subtitle}>{t('guardian.subtitle')}</Text>
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
            onDraft={() => openDraft(item._id)}
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

      <Modal
        visible={draft.open}
        animationType="slide"
        transparent
        onRequestClose={() => setDraft((d) => ({ ...d, open: false }))}
      >
        <View style={styles.draftBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDraft((d) => ({ ...d, open: false }))}
          />
          <View style={[styles.draftSheet, { paddingBottom: insets.bottom + spacing(4) }]}>
            <View style={styles.handle} />
            <View style={styles.draftHeader}>
              <Ionicons name="create" size={18} color={colors.brandSoft} />
              <Text style={styles.draftTitle} numberOfLines={1}>
                {draft.loading ? 'Drafting…' : draft.subject}
              </Text>
            </View>
            {draft.loading ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing(8) }} />
            ) : (
              <>
                <TextInput
                  style={styles.draftInput}
                  value={draft.text}
                  onChangeText={(t) => setDraft((d) => ({ ...d, text: t }))}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.draftNote}>
                  Pulse drafted this in your voice. Edit it, then copy to send from your mail app.
                </Text>
                <Pressable onPress={copyDraft}>
                  <LinearGradient
                    colors={['#9B82FF', '#5BD0FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.draftCopyBtn}
                  >
                    <Ionicons name="copy" size={16} color="#0A0A0F" />
                    <Text style={styles.draftCopyText}>Copy reply</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EmailCard({
  email,
  onHandle,
  handling,
  onDraft,
}: {
  email: EmailItem;
  onHandle: () => void;
  handling: boolean;
  onDraft: () => void;
}) {
  const { t } = useI18n();
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
        <View style={styles.actionRow}>
          <Pressable style={styles.draftBtn} onPress={onDraft}>
            <Ionicons name="create-outline" size={15} color={colors.accent} />
            <Text style={[styles.handleText, { color: colors.accent }]}>{t('guardian.draft')}</Text>
          </Pressable>
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
              {email.handled ? t('guardian.handled') : handling ? 'Saving…' : t('guardian.markHandled')}
            </Text>
          </Pressable>
        </View>
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
  actionRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderColor: 'rgba(77,226,255,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing(3),
  },
  draftBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  draftSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
  },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(3) },
  draftTitle: { ...font.h3, color: colors.text, flex: 1 },
  draftInput: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    minHeight: 160,
    lineHeight: 21,
  },
  draftNote: { ...font.small, color: colors.textFaint, marginTop: spacing(3), lineHeight: 18 },
  draftCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    paddingVertical: spacing(3.5),
    marginTop: spacing(4),
  },
  draftCopyText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
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
