import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { phoneAwareness } from '../phone/phoneAwareness';
import { Card, SectionHeader } from './ui';
import { colors, font, radius, spacing } from '../theme';

// Lets the user turn on the "well-wisher who sees your phone" capability:
// grant notification access, then Pulse perceives what arrives. Degrades to an
// informational note in Expo Go (where the native module isn't compiled in).
export function PhoneAwarenessCard() {
  const qc = useQueryClient();
  const [available, setAvailable] = useState(false);
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-check whenever Settings regains focus (e.g. after returning from the
  // system permission screen) and keep the native service pointed at the API.
  useFocusEffect(
    useCallback(() => {
      const avail = phoneAwareness.available();
      setAvailable(avail);
      if (avail) {
        phoneAwareness.configure();
        setGranted(phoneAwareness.permissionGranted());
      }
    }, []),
  );

  const sync = async () => {
    setBusy(true);
    try {
      const r = await phoneAwareness.sync();
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert(
        'Pulse caught up',
        r.reminders.length || r.learned
          ? `${r.reminders.length} new reminder(s), learned ${r.learned} thing(s) about you.`
          : 'Nothing new needed your attention.',
      );
    } catch (e) {
      Alert.alert('Could not sync', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="Phone awareness" icon="phone-portrait" />
      <Card style={{ gap: spacing(3) }}>
        <Text style={styles.lead}>
          Let Pulse watch over your notifications so it can remind you of what you'd forget —
          a bill due, someone waiting on a reply, an appointment. It ignores OTPs and spam, keeps
          only what matters, and you can turn it off anytime.
        </Text>

        {!available ? (
          <View style={styles.statusRow}>
            <Ionicons name="information-circle" size={16} color={colors.textFaint} />
            <Text style={styles.note}>
              Available in the full Pulse app build (not in Expo Go).
            </Text>
          </View>
        ) : granted ? (
          <>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.note, { color: colors.success }]}>
                On — Pulse is watching over your phone.
              </Text>
            </View>
            <Pressable style={styles.btn} onPress={sync} disabled={busy}>
              <Ionicons name="sync" size={16} color={colors.brandSoft} />
              <Text style={styles.btnText}>{busy ? 'Catching up…' : 'Catch up now'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={[styles.note, { color: colors.warning }]}>
                Off — grant notification access to switch it on.
              </Text>
            </View>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={phoneAwareness.enable}>
              <Ionicons name="lock-open" size={16} color="#0A0A0F" />
              <Text style={[styles.btnText, { color: '#0A0A0F' }]}>Grant notification access</Text>
            </Pressable>
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  lead: { ...font.small, color: colors.textDim, lineHeight: 19 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  note: { ...font.small, color: colors.textFaint },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: spacing(3),
  },
  btnPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  btnText: { ...font.small, color: colors.brandSoft, fontWeight: '700' },
});
