import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <AlertTriangle size={40} color="var(--signal-caution)" />
          <p style={styles.message}>Something went wrong</p>
          <button
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-xl)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  message: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  button: {
    padding: 'var(--space-sm) var(--space-xl)',
    background: 'var(--ochre)',
    color: 'var(--bg-base)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
