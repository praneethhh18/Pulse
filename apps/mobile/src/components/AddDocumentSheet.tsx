import React, { useState } from 'react';
import {
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, spacing } from '../theme';

const CATEGORIES = [
  'identity',
  'medical',
  'financial',
  'legal',
  'educational',
  'vehicle',
  'travel',
  'other',
] as const;

interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

export function AddDocumentSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('other');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setCategory('other');
    setContent('');
    setTags('');
    setExpiresAt('');
    setImage(null);
    setError(null);
  };

  const toPicked = (a: ImagePicker.ImagePickerAsset): PickedImage => ({
    uri: a.uri,
    base64: a.base64 ?? '',
    mimeType: a.mimeType ?? 'image/jpeg',
    fileName: a.fileName ?? `scan-${Date.now()}.jpg`,
  });

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to attach a document.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets[0]) setImage(toPicked(res.assets[0]));
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to scan a document.');
    const res = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets[0]) setImage(toPicked(res.assets[0]));
  };

  const save = useMutation({
    mutationFn: () =>
      api.addDocument({
        title: title.trim(),
        category,
        content: content.trim() || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        expiresAt: expiresAt.trim() ? toIso(expiresAt.trim()) : undefined,
        ...(image
          ? { base64: image.base64, mimeType: image.mimeType, fileName: image.fileName }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      reset();
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  const submit = () => {
    setError(null);
    if (!title.trim()) return setError('Give it a title.');
    if (!content.trim() && !image)
      return setError('Add some content or attach a photo of the document.');
    if (expiresAt.trim() && !isValidDate(expiresAt.trim()))
      return setError('Expiry must be a date like 2027-01-31.');
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
              <Text style={styles.heading}>Add to Vault</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Attach media */}
              <Field label="Document photo / scan" optional hint="Snap it — Pulse reads the text for you">
                {image ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
                    <Pressable style={styles.removeBtn} onPress={() => setImage(null)}>
                      <Ionicons name="trash" size={14} color={colors.critical} />
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.pickRow}>
                    <Pressable style={styles.pickBtn} onPress={pickFromCamera}>
                      <Ionicons name="camera" size={20} color={colors.brandSoft} />
                      <Text style={styles.pickText}>Camera</Text>
                    </Pressable>
                    <Pressable style={styles.pickBtn} onPress={pickFromLibrary}>
                      <Ionicons name="images" size={20} color={colors.brandSoft} />
                      <Text style={styles.pickText}>Gallery</Text>
                    </Pressable>
                  </View>
                )}
              </Field>

              <Field label="Title">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. PAN Card"
                  placeholderTextColor={colors.textFaint}
                  value={title}
                  onChangeText={setTitle}
                />
              </Field>

              <Field label="Category">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2) }}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[styles.catChip, category === c && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Field>

              <Field
                label="Content / details"
                optional={!!image}
                hint={image ? 'Optional — text is read from your photo when Gemini is connected' : undefined}
              >
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Paste text or details so Pulse can find it by meaning."
                  placeholderTextColor={colors.textFaint}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Tags (comma separated)" optional>
                <TextInput
                  style={styles.input}
                  placeholder="tax, 2026, important"
                  placeholderTextColor={colors.textFaint}
                  value={tags}
                  onChangeText={setTags}
                  autoCapitalize="none"
                />
              </Field>

              <Field label="Expiry date" optional hint="Pulse will remind you before it expires">
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textFaint}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  autoCapitalize="none"
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
                  <Ionicons name="add-circle" size={18} color="#0A0A0F" />
                  <Text style={styles.saveText}>{save.isPending ? 'Saving…' : 'Save to Vault'}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: spacing(4) }}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>optional</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={{ marginTop: spacing(2) }}>{children}</View>
    </View>
  );
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
function toIso(s: string): string {
  return new Date(s + 'T00:00:00').toISOString();
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
    marginBottom: spacing(1),
  },
  heading: { ...font.h2, color: colors.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  label: { ...font.small, color: colors.textDim, fontWeight: '700' },
  optional: { ...font.tiny, color: colors.textFaint, textTransform: 'none' },
  hint: { ...font.tiny, color: colors.textFaint, textTransform: 'none', marginTop: 2 },
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
  multiline: { minHeight: 100 },
  pickRow: { flexDirection: 'row', gap: spacing(3) },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    paddingVertical: spacing(4),
  },
  pickText: { ...font.body, color: colors.brandSoft, fontWeight: '600' },
  previewWrap: { gap: spacing(2) },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  removeText: { ...font.small, color: colors.critical, fontWeight: '600' },
  catChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipText: { ...font.small, color: colors.textDim },
  catChipTextActive: { color: '#0A0A0F', fontWeight: '700' },
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
