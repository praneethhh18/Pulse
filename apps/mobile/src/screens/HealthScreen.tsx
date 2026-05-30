import React, { useState } from 'react';
import {
  Alert,
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
import { colors, font, radius, shadow, spacing } from '../theme';
import { Card, EmptyState, Loader, SectionHeader } from '../components/ui';

type Kind = 'vital' | 'medication' | 'symptom';

export function HealthScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['health'], queryFn: api.healthSummary });
  const [open, setOpen] = useState(false);

  if (q.isLoading) return <Loader label="…" />;
  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing(3) }}>
      <ScrollView contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(12) }}>
        <Text style={styles.title}>{t('health.title')}</Text>
        <Text style={styles.subtitle}>{t('health.subtitle')}</Text>

        <SectionHeader title={t('health.vitals')} icon="pulse" />
        {d && d.vitals.length ? (
          <View style={styles.vitalGrid}>
            {d.vitals.map((v) => (
              <Card key={v.name} style={styles.vitalCard}>
                <Text style={styles.vitalName}>{v.name}</Text>
                <Text style={styles.vitalValue}>
                  {v.latest}
                  {v.unit ? <Text style={styles.vitalUnit}> {v.unit}</Text> : null}
                </Text>
                {v.trend.length > 1 ? (
                  <Text style={styles.vitalTrend}>{v.trend.join('  ›  ')}</Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon="pulse" text={t('health.empty')} />
        )}

        <SectionHeader title={t('health.medications')} icon="medkit" />
        <Card>
          {d && d.medications.length ? (
            d.medications.map((m, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <Ionicons name="medical" size={16} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {m.name}
                    {m.value ? <Text style={styles.rowDim}>  ·  {m.value}</Text> : null}
                  </Text>
                  {m.notes ? <Text style={styles.rowNote}>{m.notes}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.rowDim}>—</Text>
          )}
        </Card>

        <SectionHeader title={t('health.symptoms')} icon="thermometer" />
        <Card>
          {d && d.symptoms.length ? (
            d.symptoms.map((s, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.name}</Text>
                  {s.notes ? <Text style={styles.rowNote}>{s.notes}</Text> : null}
                </View>
                <Text style={styles.rowDim}>
                  {new Date(s.notedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.rowDim}>—</Text>
          )}
        </Card>
      </ScrollView>

      <Pressable style={[styles.fab, shadow.glow]} onPress={() => setOpen(true)}>
        <LinearGradient
          colors={['#9B82FF', '#5BD0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={28} color="#0A0A0F" />
        </LinearGradient>
      </Pressable>

      <AddHealthModal
        visible={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['health'] });
          setOpen(false);
        }}
      />
    </View>
  );
}

function AddHealthModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>('vital');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setKind('vital');
    setName('');
    setValue('');
    setUnit('');
    setNotes('');
  };

  const save = useMutation({
    mutationFn: () =>
      api.addHealthRecord({
        kind,
        name: name.trim(),
        value: value.trim() || undefined,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      reset();
      onSaved();
    },
    onError: (e) => Alert.alert('Could not save', (e as Error).message),
  });

  const KINDS: { k: Kind; label: string }[] = [
    { k: 'vital', label: t('health.kindVital') },
    { k: 'medication', label: t('health.kindMedication') },
    { k: 'symptom', label: t('health.kindSymptom') },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('health.add')}</Text>

          <View style={styles.kindRow}>
            {KINDS.map(({ k, label }) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.kindChip, kind === k && styles.kindChipActive]}
              >
                <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('health.name')}
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={setName}
          />
          {kind !== 'symptom' ? (
            <View style={{ flexDirection: 'row', gap: spacing(2) }}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder={t('health.value')}
                placeholderTextColor={colors.textFaint}
                value={value}
                onChangeText={setValue}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t('health.unit')}
                placeholderTextColor={colors.textFaint}
                value={unit}
                onChangeText={setUnit}
                autoCapitalize="none"
              />
            </View>
          ) : null}
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder={t('health.notes')}
            placeholderTextColor={colors.textFaint}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            onPress={() => name.trim() && save.mutate()}
            disabled={save.isPending}
            style={{ marginTop: spacing(4) }}
          >
            <LinearGradient
              colors={['#9B82FF', '#5BD0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Ionicons name="checkmark" size={18} color="#0A0A0F" />
              <Text style={styles.saveText}>{save.isPending ? '…' : t('health.save')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.textDim, marginTop: spacing(1) },
  vitalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  vitalCard: { width: '47%', gap: spacing(1) },
  vitalName: { ...font.small, color: colors.textDim },
  vitalValue: { ...font.h2, color: colors.text },
  vitalUnit: { ...font.small, color: colors.textFaint },
  vitalTrend: { ...font.tiny, color: colors.brandSoft, textTransform: 'none', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5) },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { ...font.body, color: colors.text, fontWeight: '600' },
  rowDim: { ...font.small, color: colors.textFaint },
  rowNote: { ...font.small, color: colors.textDim, marginTop: 2 },
  fab: { position: 'absolute', right: spacing(5), bottom: spacing(6), borderRadius: 30 },
  fabInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing(3),
  },
  sheetTitle: { ...font.h2, color: colors.text, marginBottom: spacing(3) },
  kindRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3) },
  kindChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  kindChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  kindText: { ...font.small, color: colors.textDim },
  kindTextActive: { color: '#0A0A0F', fontWeight: '700' },
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.pill,
    paddingVertical: spacing(3.5),
  },
  saveText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
});
