import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, spacing } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  caption,
  icon,
}: {
  title: string;
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
        {icon ? <Ionicons name={icon} size={16} color={colors.brandSoft} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  color = colors.brandSoft,
  filled = false,
}: {
  label: string;
  color?: string;
  filled?: boolean;
}) {
  return (
    <View
      style={[
        styles.chip,
        filled
          ? { backgroundColor: color }
          : { backgroundColor: 'transparent', borderColor: color, borderWidth: 1 },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: filled ? '#0A0A0F' : color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function StatTile({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card style={styles.statTile}>
      <Ionicons name={icon} size={18} color={colors.brandSoft} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export function GradientButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <LinearGradient
      colors={['#8A6CFF', '#5BC8FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradBtn}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}
        onTouchEnd={onPress}
      >
        {icon ? <Ionicons name={icon} size={16} color="#0A0A0F" /> : null}
        <Text style={styles.gradBtnText}>{label}</Text>
      </View>
    </LinearGradient>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} size="large" />
      {label ? <Text style={styles.dimText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={42} color={colors.textFaint} />
      <Text style={[font.h3 as TextStyle, { color: colors.text, marginTop: spacing(3) }]}>
        Can't reach Pulse
      </Text>
      <Text style={[styles.dimText, { textAlign: 'center' }]}>{message}</Text>
      {hint ? (
        <Text style={[styles.faintText, { textAlign: 'center', marginTop: spacing(2) }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={[styles.center, { paddingVertical: spacing(10) }]}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Text style={[styles.dimText, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
    marginTop: spacing(2),
  },
  sectionTitle: { ...font.h3, color: colors.text },
  sectionCaption: { ...font.small, color: colors.textFaint },
  chip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  chipText: { ...font.tiny, textTransform: 'uppercase' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statTile: {
    flex: 1,
    gap: spacing(1.5),
    paddingVertical: spacing(4),
  },
  statValue: { ...font.h2, color: colors.text },
  statLabel: { ...font.small, color: colors.textDim },
  gradBtn: {
    borderRadius: radius.pill,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradBtnText: { ...font.body, color: '#0A0A0F', fontWeight: '800' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(2),
  },
  dimText: { ...font.body, color: colors.textDim },
  faintText: { ...font.small, color: colors.textFaint },
});
