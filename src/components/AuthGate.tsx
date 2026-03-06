import { useState, useEffect, type ReactNode, type FormEvent } from 'react';

const SESSION_KEY = 'goe-auth';
const PASSWORD = import.meta.env.VITE_GATE_PASSWORD ?? '';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      setAuthenticated(true);
    }
  }, []);

  if (authenticated) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setAuthenticated(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div style={styles.backdrop}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <span style={styles.logo}>GOE</span>
        <span style={styles.subtitle}>Health</span>

        <input
          type="password"
          placeholder="Enter password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          style={{
            ...styles.input,
            borderColor: shake ? 'var(--signal-poor)' : 'var(--border-default)',
            animation: shake ? 'auth-shake 0.4s ease' : 'none',
          }}
        />

        <button type="submit" style={styles.button}>
          Enter
        </button>
      </form>

      <style>{`
        @keyframes auth-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  logo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 52,
    fontWeight: 800,
    letterSpacing: -3,
    color: 'var(--ochre)',
    lineHeight: 1,
  },
  subtitle: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-lg)',
  },
  input: {
    width: 240,
    padding: 'var(--space-md)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.3s',
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
