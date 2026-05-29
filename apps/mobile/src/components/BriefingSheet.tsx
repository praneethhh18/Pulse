import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
import { colors, font, radius, spacing } from '../theme';

export function BriefingSheet({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: ['briefing', eventId],
    queryFn: () => api.briefing(eventId as string),
    enabled: !!eventId,
  });

  return (
    <Modal visible={!!eventId} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <LinearGradient
          colors={['#1B1F31', '#141726']}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing(5), paddingTop: insets.top + spacing(3) }]}
        >
          <View style={styles.header}>
            <View style={styles.iconBubble}>
              <Ionicons name="document-text" size={18} color={colors.accent} />
            </View>
            <Text style={styles.title}>Your briefing</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textDim} />
            </Pressable>
          </View>

          {q.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand} size="large" />
              <Text style={styles.dim}>Preparing you…</Text>
            </View>
          ) : q.isError || !q.data ? (
            <Text style={styles.dim}>Couldn't build the briefing right now.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.eventTitle}>{q.data.event.title}</Text>
              <Text style={styles.eventMeta}>
                {new Date(q.data.event.startsAt).toLocaleString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {q.data.event.location ? ` · ${q.data.event.location}` : ''}
              </Text>
              <View style={styles.divider} />
              {renderBriefing(q.data.briefing)}
            </ScrollView>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

function renderBriefing(text: string) {
  return text.split('\n').map((raw, i) => {
    const line = raw.trim();
    if (!line) return <View key={i} style={{ height: spacing(2) }} />;
    const heading = line.match(/^\*\*(.+)\*\*$/);
    if (heading)
      return (
        <Text key={i} style={styles.heading}>
          {heading[1]}
        </Text>
      );
    if (/^[_].+[_]$/.test(line))
      return (
        <Text key={i} style={styles.note}>
          {line.replace(/^_|_$/g, '')}
        </Text>
      );
    if (line.startsWith('- ') || line.startsWith('• '))
      return (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{stripBold(line.slice(2))}</Text>
        </View>
      );
    return (
      <Text key={i} style={styles.body}>
        {stripBold(line)}
      </Text>
    );
  });
}

function stripBold(s: string): string {
  return s.replace(/\*\*/g, '');
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(5),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginBottom: spacing(4) },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(66,232,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h2, color: colors.text, flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(10), gap: spacing(3) },
  dim: { ...font.body, color: colors.textDim },
  eventTitle: { ...font.h2, color: colors.text },
  eventMeta: { ...font.small, color: colors.brandSoft, marginTop: spacing(1) },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(4) },
  heading: { ...font.h3, color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
  body: { ...font.body, color: colors.textDim, lineHeight: 22, marginVertical: 2 },
  note: { ...font.small, color: colors.textFaint, marginTop: spacing(3), fontStyle: 'italic' },
  bulletRow: { flexDirection: 'row', gap: spacing(2), marginVertical: 3 },
  bulletDot: { ...font.body, color: colors.brandSoft },
  bulletText: { ...font.body, color: colors.textDim, flex: 1, lineHeight: 22 },
});
