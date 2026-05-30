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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const daysAway = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

export function TravelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['trips'], queryFn: api.trips, enabled: visible });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const trips = q.data ?? [];
  const selected = trips.find((tr) => tr._id === selectedId) ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['trips'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
  };

  const add = useMutation({
    mutationFn: () =>
      api.addTrip({
        destination: destination.trim(),
        startsAt: new Date(start.trim() + 'T08:00:00').toISOString(),
        endsAt: end.trim() ? new Date(end.trim() + 'T20:00:00').toISOString() : undefined,
      }),
    onSuccess: () => {
      setDestination('');
      setStart('');
      setEnd('');
      setAdding(false);
      refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (index: number) => api.togglePack(selectedId!, index),
    onSuccess: refresh,
  });

  const close = () => {
    setSelectedId(null);
    setAdding(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={selected ? () => setSelectedId(null) : close}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing(3) }]}>
        <View style={styles.header}>
          {selected ? (
            <Pressable onPress={() => setSelectedId(null)} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.logoDot}>
              <Ionicons name="airplane" size={14} color="#0A0A0F" />
            </View>
          )}
          <Text style={styles.title}>{selected ? selected.destination : t('travel.title')}</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDim} />
          </Pressable>
        </View>

        {selected ? (
          <ScrollView contentContainerStyle={{ padding: spacing(5) }}>
            <Text style={styles.tripMeta}>
              {fmtDate(selected.startsAt)}
              {selected.endsAt ? ` – ${fmtDate(selected.endsAt)}` : ''} ·{' '}
              {daysAway(selected.startsAt) <= 0 ? 'now' : `${daysAway(selected.startsAt)} days away`}
            </Text>
            <Text style={styles.section}>{t('travel.packing')}</Text>
            {selected.packingList.map((item, i) => (
              <Pressable key={i} style={styles.packRow} onPress={() => toggle.mutate(i)}>
                <Ionicons
                  name={item.packed ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={item.packed ? colors.success : colors.brandSoft}
                />
                <Text style={[styles.packText, item.packed && styles.packed]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}>
            <Text style={styles.subtitle}>{t('travel.subtitle')}</Text>

            {trips.length === 0 ? (
              <EmptyState icon="airplane" text={t('travel.empty')} />
            ) : (
              trips.map((tr) => {
                const packed = tr.packingList.filter((p) => p.packed).length;
                const d = daysAway(tr.startsAt);
                return (
                  <Pressable key={tr._id} style={styles.tripRow} onPress={() => setSelectedId(tr._id)}>
                    <View style={styles.tripIcon}>
                      <Ionicons name="airplane" size={18} color={colors.brandSoft} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripDest}>{tr.destination}</Text>
                      <Text style={styles.tripSub}>
                        {fmtDate(tr.startsAt)} · {d <= 0 ? 'now' : `${d} days away`} ·{' '}
                        {t('travel.packed', { packed, total: tr.packingList.length })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </Pressable>
                );
              })
            )}

            {adding ? (
              <View style={{ marginTop: spacing(4) }}>
                <TextInput style={styles.input} placeholder={t('travel.destination')} placeholderTextColor={colors.textFaint} value={destination} onChangeText={setDestination} />
                <TextInput style={styles.input} placeholder={t('travel.start')} placeholderTextColor={colors.textFaint} value={start} onChangeText={setStart} autoCapitalize="none" />
                <TextInput style={styles.input} placeholder={t('travel.end')} placeholderTextColor={colors.textFaint} value={end} onChangeText={setEnd} autoCapitalize="none" />
                <Pressable onPress={() => destination.trim() && start.trim() && add.mutate()}>
                  <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>{add.isPending ? '…' : t('travel.add')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
                <Ionicons name="add" size={18} color={colors.brandSoft} />
                <Text style={styles.addText}>{t('travel.add')}</Text>
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
  logoDot: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { ...font.h2, color: colors.text, flex: 1 },
  subtitle: { ...font.body, color: colors.textDim, marginBottom: spacing(4) },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tripIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(124,92,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  tripDest: { ...font.h3, color: colors.text },
  tripSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  tripMeta: { ...font.body, color: colors.brandSoft },
  section: { ...font.tiny, color: colors.textFaint, marginTop: spacing(5), marginBottom: spacing(2) },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5) },
  packText: { ...font.body, color: colors.text, flex: 1 },
  packed: { color: colors.textFaint, textDecorationLine: 'line-through' },
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
  primaryBtn: { borderRadius: radius.pill, paddingVertical: spacing(3.5), alignItems: 'center' },
  primaryText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
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
});
