import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, spacing } from '../theme';

// One-tap sample emails so you can see the triage instantly without typing.
const SAMPLES: { label: string; from: string; subject: string; body: string }[] = [
  {
    label: 'Bank deadline',
    from: 'alerts@icicibank.com',
    subject: 'Important: update your KYC within 5 days',
    body: 'Dear customer, your KYC is pending verification. Please complete it within 5 days to avoid a temporary hold on your account.',
  },
  {
    label: 'Phishing',
    from: 'security@paypa1-support.com',
    subject: 'Your account is suspended — verify immediately',
    body: 'We detected unusual activity. Click here to verify your password and card details immediately or your account will be permanently closed.',
  },
  {
    label: 'Meeting invite',
    from: 'manager@company.com',
    subject: 'Quarterly review — please confirm',
    body: 'Hi, please confirm your availability for the quarterly review tomorrow at 3pm. Reply to accept.',
  },
];

export function AddEmailSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFrom('');
    setSubject('');
    setBody('');
    setError(null);
  };

  const save = useMutation({
    mutationFn: () =>
      api.ingestEmail({ from: from.trim(), subject: subject.trim(), body: body.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      reset();
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  const submit = () => {
    setError(null);
    if (!from.trim()) return setError('Who is it from?');
    if (!subject.trim()) return setError('Add a subject.');
    save.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.heading}>Feed Pulse an email</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </Pressable>
            </View>
            <Text style={styles.sub}>Pulse reads it and tells you what matters and by when.</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.tryLabel}>Try a sample</Text>
              <View style={styles.sampleRow}>
                {SAMPLES.map((s) => (
                  <Pressable
                    key={s.label}
                    style={styles.sampleChip}
                    onPress={() => {
                      setFrom(s.from);
                      setSubject(s.subject);
                      setBody(s.body);
                      setError(null);
                    }}
                  >
                    <Text style={styles.sampleText}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="From">
                <TextInput
                  style={styles.input}
                  placeholder="sender@example.com"
                  placeholderTextColor={colors.textFaint}
                  value={from}
                  onChangeText={setFrom}
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Subject">
                <TextInput
                  style={styles.input}
                  placeholder="Email subject"
                  placeholderTextColor={colors.textFaint}
                  value={subject}
                  onChangeText={setSubject}
                />
              </Field>
              <Field label="Body">
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Paste the email text…"
                  placeholderTextColor={colors.textFaint}
                  value={body}
                  onChangeText={setBody}
                  multiline
                  textAlignVertical="top"
                />
              </Field>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable onPress={submit} disabled={save.isPending} style={{ marginTop: spacing(4) }}>
                <LinearGradient
                  colors={['#9B82FF', '#5BD0FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtn}
                >
                  <Ionicons name="sparkles" size={18} color="#0A0A0F" />
                  <Text style={styles.saveText}>{save.isPending ? 'Reading…' : 'Triage with Pulse'}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing(4) }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ marginTop: spacing(2) }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { width: '100%' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing(3),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { ...font.h2, color: colors.text },
  sub: { ...font.small, color: colors.textDim, marginTop: spacing(1) },
  tryLabel: { ...font.tiny, color: colors.textFaint, marginTop: spacing(4) },
  sampleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  sampleChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  sampleText: { ...font.small, color: colors.brandSoft },
  label: { ...font.small, color: colors.textDim, fontWeight: '700' },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  multiline: { minHeight: 120 },
  error: { ...font.small, color: colors.critical, marginTop: spacing(3) },
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
