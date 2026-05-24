import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '@/types';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] crash capturado:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <AlertTriangle size={40} color={COLORS.danger} />
        </View>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.subtitle}>
          {this.props.fallbackLabel ?? 'Ocurrió un error inesperado en la aplicación.'}
        </Text>
        {this.state.error && (
          <ScrollView style={styles.devBox}>
            <Text style={styles.devText}>{this.state.error.message}</Text>
            {!!this.state.error.stack && (
              <Text style={styles.devText}>{this.state.error.stack.split('\n').slice(0, 6).join('\n')}</Text>
            )}
          </ScrollView>
        )}
        <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
          <RefreshCcw size={16} color="#FFFFFF" />
          <Text style={styles.btnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  devBox: {
    maxHeight: 140,
    marginTop: 16,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    padding: 12,
    width: '100%',
  },
  devText: { fontSize: 11, color: COLORS.danger, fontFamily: 'monospace' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 14,
    marginTop: 24,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
