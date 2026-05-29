import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius, spacing } from '../theme';

interface Msg {
  role: 'user' | 'pulse';
  text: string;
  sources?: { type: string; label: string }[];
}

const SUGGESTIONS = [
  "What's due this week?",
  'What is my plan today?',
  'What documents are expiring?',
  "What's my health summary?",
];

export function AskScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'pulse',
      text: "Ask me anything about your life. I'm reading across your documents, mail and calendar in real time.",
    },
  ]);
  const scrollRef = useRef<ScrollView>(null);
  const qc = useQueryClient();

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const r = await api.ask(q);
      setMessages((m) => [
        ...m,
        { role: 'pulse', text: r.answer, sources: r.sources },
      ]);
      // The turn may have taught Pulse something — refresh the learned profile.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['profile'] });
        qc.invalidateQueries({ queryKey: ['overview'] });
      }, 1200);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'pulse', text: `Couldn't reach me right now. ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.head, { paddingTop: insets.top + spacing(3) }]}>
        <View style={styles.logoDot}>
          <Ionicons name="flash" size={13} color="#0A0A0F" />
        </View>
        <Text style={styles.title}>Ask Pulse</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing(5), gap: spacing(3) }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {busy ? <Bubble msg={{ role: 'pulse', text: '…' }} /> : null}

        {messages.length <= 1 ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestChip} onPress={() => send(s)}>
                <Text style={styles.suggestText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing(3) }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask anything…"
          placeholderTextColor={colors.textFaint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!busy}
        />
        <Pressable onPress={() => send(input)} disabled={busy}>
          <LinearGradient
            colors={['#8A6CFF', '#5BC8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendBtn}
          >
            <Ionicons name="arrow-up" size={20} color="#0A0A0F" />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.pulseBubble,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && { color: '#0A0A0F' }]}>
          {msg.text}
        </Text>
      </View>
      {msg.sources && msg.sources.length ? (
        <View style={styles.sources}>
          {msg.sources.map((s, i) => (
            <View key={i} style={styles.sourceTag}>
              <Ionicons name="link" size={10} color={colors.textFaint} />
              <Text style={styles.sourceText}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoDot: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h2, color: colors.text },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  userBubble: { backgroundColor: colors.brandSoft, borderBottomRightRadius: 6 },
  pulseBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { ...font.body, color: colors.text, lineHeight: 21 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  sourceText: { ...font.tiny, color: colors.textDim, textTransform: 'none' },
  suggestions: { gap: spacing(2.5), marginTop: spacing(4) },
  suggestChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    alignSelf: 'flex-start',
  },
  suggestText: { ...font.body, color: colors.brandSoft },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
