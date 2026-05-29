import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, shadow, spacing, severityColor } from '../theme';
import type { Nudge } from '../api/types';

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'schedule-conflict': 'airplane',
  deadline: 'alarm',
  expiry: 'hourglass',
  pattern: 'pulse',
  'needs-action': 'mail-unread',
  'busy-day': 'calendar',
  'profile-prep': 'person-circle',
};

export function NudgeCard({ nudge }: { nudge: Nudge }) {
  const [showWhy, setShowWhy] = useState(false);
  const accent = severityColor(nudge.severity);
  const critical = nudge.severity === 'critical';
  const qc = useQueryClient();
  const dismiss = useMutation({
    mutationFn: () => api.ackNudge(nudge.key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['nudges'] });
    },
  });

  return (
    <View style={[styles.wrap, critical && shadow.glow]}>
      <LinearGradient
        colors={critical ? ['#3A2742', '#251F39'] : ['#262C46', '#1E2338']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={styles.headerRow}>
          <View style={[styles.iconBubble, { backgroundColor: accent + '22' }]}>
            <Ionicons
              name={ICON[nudge.kind] ?? 'sparkles'}
              size={18}
              color={accent}
            />
          </View>
          <Text style={styles.title}>{nudge.title}</Text>
          {critical ? (
            <View style={[styles.tag, { backgroundColor: accent }]}>
              <Text style={styles.tagText}>NOW</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => dismiss.mutate()}
            hitSlop={10}
            style={styles.dismiss}
          >
            <Ionicons name="close" size={16} color={colors.textFaint} />
          </Pressable>
        </View>

        <Text style={styles.message}>{nudge.message}</Text>

        {nudge.suggestedAction ? (
          <Pressable style={[styles.action, { borderColor: accent }]}>
            <Ionicons name="flash" size={14} color={accent} />
            <Text style={[styles.actionText, { color: accent }]}>
              {nudge.suggestedAction.label}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.whyToggle}
          onPress={() => setShowWhy((v) => !v)}
        >
          <Ionicons
            name={showWhy ? 'chevron-up' : 'information-circle-outline'}
            size={14}
            color={colors.textFaint}
          />
          <Text style={styles.whyToggleText}>
            {showWhy ? 'Hide reasoning' : 'Why did Pulse flag this?'}
          </Text>
        </Pressable>

        {showWhy ? (
          <View style={styles.whyBox}>
            <Text style={styles.whyText}>{nudge.reason}</Text>
            <View style={styles.sourceRow}>
              {nudge.sources.map((s) => (
                <View key={s.id} style={styles.source}>
                  <Ionicons name="link" size={11} color={colors.textFaint} />
                  <Text style={styles.sourceText}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, marginBottom: spacing(3) },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(2.5),
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h3, color: colors.text, flex: 1 },
  tag: {
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tagText: { ...font.tiny, color: '#0A0A0F' },
  dismiss: { padding: 2 },
  message: { ...font.body, color: colors.textDim, lineHeight: 21 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    marginTop: spacing(3),
  },
  actionText: { ...font.small, fontWeight: '700' },
  whyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(3),
  },
  whyToggleText: { ...font.small, color: colors.textFaint },
  whyBox: {
    marginTop: spacing(2.5),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  whyText: { ...font.small, color: colors.textDim, lineHeight: 19 },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(2.5),
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  sourceText: { ...font.tiny, color: colors.textDim, textTransform: 'none' },
});
