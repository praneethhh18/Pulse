import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { EmptyState } from './ui';
import type { LearningCard } from '../api/types';

export function LearnSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['learning-goals'], queryFn: api.learningGoals, enabled: visible });

  const [queue, setQueue] = useState<LearningCard[] | null>(null); // null = list mode
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [topic, setTopic] = useState('');
  const [adding, setAdding] = useState(false);

  const totalDue = (goals.data ?? []).reduce((s, g) => s + g.due, 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['learning-goals'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
  };

  const startReview = async () => {
    const due = await api.dueCards();
    if (due.length) {
      setQueue(due);
      setIdx(0);
      setRevealed(false);
    }
  };

  const grade = useMutation({
    mutationFn: ({ id, g }: { id: string; g: 'again' | 'good' }) => api.reviewCard(id, g),
    onSuccess: () => {
      if (!queue) return;
      if (idx + 1 < queue.length) {
        setIdx(idx + 1);
        setRevealed(false);
      } else {
        setQueue(null); // session done
        refresh();
      }
    },
  });

  const addGoal = useMutation({
    mutationFn: () => api.createGoal(topic.trim()),
    onSuccess: () => {
      setTopic('');
      setAdding(false);
      refresh();
    },
  });

  const close = () => {
    setQueue(null);
    setAdding(false);
    onClose();
  };

  const card = queue?.[idx];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={queue ? () => setQueue(null) : close}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing(3) }]}>
        <View style={styles.header}>
          {queue ? (
            <Pressable onPress={() => setQueue(null)} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.logoDot}>
              <Ionicons name="school" size={14} color="#0A0A0F" />
            </View>
          )}
          <Text style={styles.title}>{t('learn.title')}</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDim} />
          </Pressable>
        </View>

        {queue && card ? (
          // ── Spaced-repetition quiz ──
          <View style={styles.quizWrap}>
            <Text style={styles.progress}>
              {idx + 1} / {queue.length}
            </Text>
            <View style={styles.flashcard}>
              <Text style={styles.front}>{card.front}</Text>
              {revealed ? <Text style={styles.back}>{card.back}</Text> : null}
            </View>
            {!revealed ? (
              <Pressable onPress={() => setRevealed(true)}>
                <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.revealBtn}>
                  <Text style={styles.revealText}>{t('learn.reveal')}</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.gradeRow}>
                <Pressable
                  style={[styles.gradeBtn, { borderColor: colors.critical }]}
                  onPress={() => grade.mutate({ id: card._id, g: 'again' })}
                >
                  <Ionicons name="refresh" size={16} color={colors.critical} />
                  <Text style={[styles.gradeText, { color: colors.critical }]}>{t('learn.again')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.gradeBtn, { borderColor: colors.success }]}
                  onPress={() => grade.mutate({ id: card._id, g: 'good' })}
                >
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={[styles.gradeText, { color: colors.success }]}>{t('learn.good')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          // ── Goals list ──
          <ScrollView contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}>
            <Text style={styles.subtitle}>{t('learn.subtitle')}</Text>

            <Pressable
              onPress={startReview}
              disabled={totalDue === 0}
              style={{ opacity: totalDue === 0 ? 0.5 : 1, marginBottom: spacing(5) }}
            >
              <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reviewBtn}>
                <Ionicons name="flash" size={18} color="#0A0A0F" />
                <Text style={styles.reviewText}>
                  {totalDue > 0 ? t('learn.reviewDue', { n: totalDue }) : t('learn.noDue')}
                </Text>
              </LinearGradient>
            </Pressable>

            {(goals.data ?? []).length === 0 ? (
              <EmptyState icon="school" text={t('learn.subtitle')} />
            ) : (
              (goals.data ?? []).map((g) => (
                <View key={g._id} style={styles.goalRow}>
                  <View style={styles.goalIcon}>
                    <Ionicons name="book" size={18} color={colors.brandSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalTopic}>{g.topic}</Text>
                    <Text style={styles.goalMeta}>{t('learn.cards', { due: g.due, total: g.total })}</Text>
                  </View>
                  {g.due > 0 ? <View style={styles.dueDot} /> : null}
                </View>
              ))
            )}

            {adding ? (
              <View style={{ marginTop: spacing(4) }}>
                <TextInput
                  style={styles.input}
                  placeholder={t('learn.goalPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={topic}
                  onChangeText={setTopic}
                />
                <Pressable onPress={() => topic.trim() && addGoal.mutate()}>
                  <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reviewBtn}>
                    <Text style={styles.reviewText}>{addGoal.isPending ? '…' : t('learn.addGoal')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
                <Ionicons name="add" size={18} color={colors.brandSoft} />
                <Text style={styles.addText}>{t('learn.addGoal')}</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h2, color: colors.text, flex: 1 },
  subtitle: { ...font.body, color: colors.textDim, marginBottom: spacing(4) },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    paddingVertical: spacing(3.5),
  },
  reviewText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(124,92,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTopic: { ...font.h3, color: colors.text },
  goalMeta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  dueDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing(4),
    marginTop: spacing(5),
  },
  addText: { ...font.body, color: colors.brandSoft, fontWeight: '600' },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginBottom: spacing(3),
  },
  quizWrap: { flex: 1, padding: spacing(5), alignItems: 'center', justifyContent: 'center', gap: spacing(5) },
  progress: { ...font.small, color: colors.textFaint },
  flashcard: {
    width: '100%',
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(4),
  },
  front: { ...font.h1, color: colors.text, textAlign: 'center' },
  back: { ...font.h2, color: colors.brandSoft, textAlign: 'center', fontWeight: '600' },
  revealBtn: { borderRadius: radius.pill, paddingVertical: spacing(3.5), paddingHorizontal: spacing(10), alignItems: 'center' },
  revealText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  gradeRow: { flexDirection: 'row', gap: spacing(3), width: '100%' },
  gradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing(3.5),
  },
  gradeText: { ...font.body, fontWeight: '700' },
});
