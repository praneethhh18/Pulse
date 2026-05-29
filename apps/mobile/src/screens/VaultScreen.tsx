import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, shadow, spacing } from '../theme';
import { Card, Chip, EmptyState } from '../components/ui';
import { AddDocumentSheet } from '../components/AddDocumentSheet';
import { useI18n } from '../i18n';
import type { DocumentItem } from '../api/types';

const CATEGORY_COLOR: Record<string, string> = {
  identity: colors.brandSoft,
  medical: colors.success,
  financial: colors.warning,
  legal: colors.info,
  educational: colors.accent,
  vehicle: '#FF8FB0',
  travel: '#9AE6B4',
  other: colors.textFaint,
};

const FILTERS = [
  'all',
  'identity',
  'medical',
  'financial',
  'legal',
  'educational',
  'vehicle',
  'travel',
  'other',
] as const;

export function VaultScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [cat, setCat] = useState<(typeof FILTERS)[number]>('all');
  const { t } = useI18n();

  const all = useQuery({ queryKey: ['documents'], queryFn: api.documents });
  const search = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => api.searchDocuments(submitted),
    enabled: submitted.length > 0,
  });

  const searching = submitted.length > 0;
  const base: DocumentItem[] = searching ? search.data ?? [] : all.data ?? [];
  const data: DocumentItem[] =
    searching || cat === 'all' ? base : base.filter((d) => d.category === cat);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing(3) }}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('vault.title')}</Text>
        <Text style={styles.subtitle}>{t('vault.subtitle')}</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            placeholder='Try "health coverage" or "where I live"'
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmitted(query.trim())}
            returnKeyType="search"
          />
          {query.length ? (
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textFaint}
              onPress={() => {
                setQuery('');
                setSubmitted('');
              }}
            />
          ) : null}
        </View>
        {searching ? (
          <Text style={styles.resultMeta}>
            {search.isFetching ? 'Searching…' : `Semantic matches for “${submitted}”`}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setCat(f)}
                style={[styles.filterChip, cat === f && styles.filterChipActive]}
              >
                <Text
                  style={[styles.filterText, cat === f && styles.filterTextActive]}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {searching && search.isFetching ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing(6) }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2), gap: spacing(3) }}
          refreshControl={
            <RefreshControl
              refreshing={all.isFetching && !searching}
              onRefresh={all.refetch}
              tintColor={colors.brand}
            />
          }
          ListEmptyComponent={
            <EmptyState icon="file-tray" text="No documents found." />
          }
          renderItem={({ item }) => (
            <DocCard item={item} showScore={searching} />
          )}
        />
      )}

      <Pressable
        style={[styles.fab, shadow.glow]}
        onPress={() => setShowAdd(true)}
      >
        <LinearGradient
          colors={['#9B82FF', '#5BD0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={28} color="#0A0A0F" />
        </LinearGradient>
      </Pressable>

      <AddDocumentSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

function DocCard({ item, showScore }: { item: DocumentItem; showScore: boolean }) {
  const color = CATEGORY_COLOR[item.category] ?? colors.textFaint;
  const expSoon =
    item.expiresAt &&
    new Date(item.expiresAt).getTime() - Date.now() < 60 * 86400000;
  return (
    <Card>
      <View style={styles.docTop}>
        <View style={[styles.docIcon, { backgroundColor: color + '22' }]}>
          <Ionicons name="document-text" size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{item.title}</Text>
          <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) }}>
            <Chip label={item.category} color={color} />
            {item.hasFile ? <Chip label="photo" color={colors.accent} /> : null}
            {expSoon ? <Chip label="expiring" color={colors.warning} filled /> : null}
          </View>
        </View>
        {showScore && item.score != null ? (
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>{Math.round(item.score * 100)}%</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.docContent} numberOfLines={2}>
        {item.content}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing(5) },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.textDim, marginTop: spacing(1) },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginTop: spacing(4),
  },
  input: { flex: 1, ...font.body, color: colors.text },
  resultMeta: { ...font.small, color: colors.brandSoft, marginTop: spacing(3) },
  filterRow: { gap: spacing(2), paddingTop: spacing(3), paddingRight: spacing(5) },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { ...font.small, color: colors.textDim },
  filterTextActive: { color: '#0A0A0F', fontWeight: '700' },
  docTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: { ...font.h3, color: colors.text },
  docContent: { ...font.small, color: colors.textDim, marginTop: spacing(3), lineHeight: 19 },
  scorePill: {
    backgroundColor: 'rgba(66,232,255,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  scoreText: { ...font.tiny, color: colors.accent, textTransform: 'none' },
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
