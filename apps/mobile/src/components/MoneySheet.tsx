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

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function MoneySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['finance'], queryFn: api.financeSummary, enabled: visible });
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.addTransaction({
        amount: parseFloat(amount) || 0,
        category: category.trim() || 'Other',
        merchant: merchant.trim() || category.trim() || 'Expense',
      }),
    onSuccess: () => {
      setAmount('');
      setCategory('');
      setMerchant('');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const d = q.data;
  const categories = d?.categories ?? [];
  const subscriptions = d?.subscriptions ?? [];
  const max = Math.max(...categories.map((c) => c.amount), 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing(3) }]}>
        <View style={styles.header}>
          <View style={styles.logoDot}>
            <Ionicons name="wallet" size={14} color="#0A0A0F" />
          </View>
          <Text style={styles.title}>{t('money.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDim} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}>
          {!d ? (
            <EmptyState icon="wallet" text={t('money.empty')} />
          ) : (
            <>
              <Text style={styles.spentLabel}>{t('money.spent')}</Text>
              <Text style={styles.spentValue}>{inr(d.total)}</Text>

              <View style={{ marginTop: spacing(5), gap: spacing(3) }}>
                {categories.map((c) => (
                  <View key={c.name}>
                    <View style={styles.catRow}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catAmt}>{inr(c.amount)}</Text>
                      {c.deltaPct != null && c.deltaPct >= 25 ? (
                        <View style={styles.deltaUp}>
                          <Ionicons name="arrow-up" size={10} color={colors.critical} />
                          <Text style={styles.deltaText}>{c.deltaPct}%</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(4, (c.amount / max) * 100)}%` }]} />
                    </View>
                  </View>
                ))}
              </View>

              {subscriptions.length ? (
                <>
                  <Text style={styles.section}>{t('money.subscriptions')}</Text>
                  {subscriptions.map((s) => (
                    <View key={s.merchant} style={styles.subRow}>
                      <Ionicons name="repeat" size={15} color={colors.brandSoft} />
                      <Text style={styles.subName}>{s.merchant}</Text>
                      <Text style={styles.subAmt}>{inr(s.amount)}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {adding ? (
                <View style={{ marginTop: spacing(5) }}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('money.amount')}
                    placeholderTextColor={colors.textFaint}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('money.category')}
                    placeholderTextColor={colors.textFaint}
                    value={category}
                    onChangeText={setCategory}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('money.merchant')}
                    placeholderTextColor={colors.textFaint}
                    value={merchant}
                    onChangeText={setMerchant}
                  />
                  <Pressable onPress={() => amount.trim() && add.mutate()}>
                    <LinearGradient colors={['#9B82FF', '#5BD0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
                      <Text style={styles.saveText}>{t('common.save')}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
                  <Ionicons name="add" size={18} color={colors.brandSoft} />
                  <Text style={styles.addText}>{t('money.add')}</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
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
  spentLabel: { ...font.small, color: colors.textDim },
  spentValue: { ...font.h1, color: colors.text, marginTop: spacing(1) },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(1) },
  catName: { ...font.body, color: colors.text, flex: 1 },
  catAmt: { ...font.body, color: colors.textDim, fontWeight: '600' },
  deltaUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,107,134,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  deltaText: { ...font.tiny, color: colors.critical, textTransform: 'none' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  section: { ...font.tiny, color: colors.textFaint, marginTop: spacing(6), marginBottom: spacing(2) },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5) },
  subName: { ...font.body, color: colors.text, flex: 1 },
  subAmt: { ...font.body, color: colors.textDim },
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
  saveBtn: { borderRadius: radius.pill, paddingVertical: spacing(3.5), alignItems: 'center' },
  saveText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
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
    marginTop: spacing(6),
  },
  addText: { ...font.body, color: colors.brandSoft, fontWeight: '600' },
});
