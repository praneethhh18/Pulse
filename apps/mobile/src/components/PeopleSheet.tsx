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

export function PeopleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [note, setNote] = useState('');
  const [followup, setFollowup] = useState('');

  const q = useQuery({ queryKey: ['people'], queryFn: api.people, enabled: visible });
  const people = q.data ?? [];
  const selected = people.find((p) => p._id === selectedId) ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['people'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
  };

  const addPerson = useMutation({
    mutationFn: () => api.addPerson({ name: name.trim(), relation: relation.trim() || undefined }),
    onSuccess: () => {
      setName('');
      setRelation('');
      setAdding(false);
      refresh();
    },
  });
  const addNote = useMutation({
    mutationFn: () => api.addPersonNote(selectedId!, note.trim()),
    onSuccess: () => {
      setNote('');
      refresh();
    },
  });
  const addFollowUp = useMutation({
    mutationFn: () => api.addPersonFollowUp(selectedId!, followup.trim()),
    onSuccess: () => {
      setFollowup('');
      refresh();
    },
  });
  const done = useMutation({
    mutationFn: (fid: string) => api.completeFollowUp(selectedId!, fid),
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
              <Ionicons name="people" size={14} color="#0A0A0F" />
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {selected ? selected.name : t('people.title')}
          </Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDim} />
          </Pressable>
        </View>

        {!selected ? (
          <ScrollView contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}>
            <Text style={styles.subtitle}>{t('people.subtitle')}</Text>

            {people.length === 0 ? (
              <EmptyState icon="people" text={t('people.empty')} />
            ) : (
              people.map((p) => {
                const openFollowups = p.followUps.filter((f) => !f.done).length;
                return (
                  <Pressable key={p._id} style={styles.personRow} onPress={() => setSelectedId(p._id)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{p.name}</Text>
                      <Text style={styles.personMeta}>
                        {[p.relation, p.notes.length ? `${p.notes.length} notes` : null, openFollowups ? `${openFollowups} follow-up${openFollowups > 1 ? 's' : ''}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Tap to add details'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </Pressable>
                );
              })
            )}

            {adding ? (
              <View style={styles.addBox}>
                <TextInput
                  style={styles.input}
                  placeholder={t('people.name')}
                  placeholderTextColor={colors.textFaint}
                  value={name}
                  onChangeText={setName}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('people.relation')}
                  placeholderTextColor={colors.textFaint}
                  value={relation}
                  onChangeText={setRelation}
                />
                <Pressable onPress={() => name.trim() && addPerson.mutate()}>
                  <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>{t('common.save')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addPersonBtn} onPress={() => setAdding(true)}>
                <Ionicons name="add" size={18} color={colors.brandSoft} />
                <Text style={styles.addPersonText}>{t('people.add')}</Text>
              </Pressable>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}>
            {selected.relation ? <Text style={styles.relation}>{selected.relation}</Text> : null}

            {/* Important dates */}
            {selected.importantDates.length ? (
              <>
                <Text style={styles.sectionLabel}>{t('people.dates')}</Text>
                {selected.importantDates.map((dt, i) => (
                  <View key={i} style={styles.lineRow}>
                    <Ionicons name="gift" size={15} color={colors.brandSoft} />
                    <Text style={styles.lineText}>
                      {dt.label}: {new Date(dt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {/* Notes */}
            <Text style={styles.sectionLabel}>{t('people.notes')}</Text>
            {selected.notes.map((n, i) => (
              <View key={i} style={styles.lineRow}>
                <Ionicons name="ellipse" size={6} color={colors.brandSoft} />
                <Text style={styles.lineText}>{n}</Text>
              </View>
            ))}
            <View style={styles.inlineAdd}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder={t('people.addNote')}
                placeholderTextColor={colors.textFaint}
                value={note}
                onChangeText={setNote}
              />
              <Pressable onPress={() => note.trim() && addNote.mutate()} style={styles.iconBtn}>
                <Ionicons name="add" size={20} color={colors.brandSoft} />
              </Pressable>
            </View>

            {/* Follow-ups */}
            <Text style={styles.sectionLabel}>{t('people.followups')}</Text>
            {selected.followUps.map((f) => (
              <Pressable key={f.id} style={styles.lineRow} onPress={() => !f.done && done.mutate(f.id)}>
                <Ionicons
                  name={f.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={f.done ? colors.success : colors.brandSoft}
                />
                <Text style={[styles.lineText, f.done && styles.lineDone]}>{f.text}</Text>
              </Pressable>
            ))}
            <View style={styles.inlineAdd}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder={t('people.addFollowup')}
                placeholderTextColor={colors.textFaint}
                value={followup}
                onChangeText={setFollowup}
              />
              <Pressable onPress={() => followup.trim() && addFollowUp.mutate()} style={styles.iconBtn}>
                <Ionicons name="add" size={20} color={colors.brandSoft} />
              </Pressable>
            </View>
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
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(124,92,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...font.h3, color: colors.brandSoft },
  personName: { ...font.h3, color: colors.text },
  personMeta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  relation: { ...font.body, color: colors.brandSoft, marginBottom: spacing(2) },
  sectionLabel: { ...font.tiny, color: colors.textFaint, marginTop: spacing(5), marginBottom: spacing(2) },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  lineText: { ...font.body, color: colors.text, flex: 1 },
  lineDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  inlineAdd: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(2) },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  addBox: { marginTop: spacing(4), gap: 0 },
  primaryBtn: { borderRadius: radius.pill, paddingVertical: spacing(3.5), alignItems: 'center' },
  primaryText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  addPersonBtn: {
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
  addPersonText: { ...font.body, color: colors.brandSoft, fontWeight: '600' },
});
