import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, spacing } from '../theme';

interface State {
  error: Error | null;
  info?: string | null;
}

// Catches render-time crashes so we see the real message on-device instead of a
// blank screen — and so one screen's error can't take down the whole app.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Print the component tree to Metro so we can pinpoint the failing screen.
    // eslint-disable-next-line no-console
    console.error('=== PULSE CRASH ===');
    // eslint-disable-next-line no-console
    console.error('message:', error.message);
    // eslint-disable-next-line no-console
    console.error('componentStack:', info?.componentStack ?? '(none)');
    // eslint-disable-next-line no-console
    console.error('stack:', error.stack ?? '(none)');
    // eslint-disable-next-line no-console
    console.error('=== END PULSE CRASH ===');
    this.setState({ info: info?.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something broke on this screen</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          {this.state.info ? (
            <Text style={styles.stack}>{this.state.info.split('\n').slice(0, 12).join('\n')}</Text>
          ) : this.state.error.stack ? (
            <Text style={styles.stack}>{this.state.error.stack.split('\n').slice(0, 10).join('\n')}</Text>
          ) : null}
          <Text style={styles.hint}>Screenshot this and send it over — it pinpoints the fix.</Text>
        </ScrollView>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(6), paddingTop: spacing(16), gap: spacing(3) },
  title: { ...font.h2, color: colors.critical },
  msg: { ...font.body, color: colors.text },
  stack: { ...font.small, color: colors.textDim, fontFamily: 'monospace' },
  hint: { ...font.small, color: colors.textFaint, marginTop: spacing(2) },
});
