import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

function PersonIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <path d="M 6 21 L 6 14 Q 6 9 12 9 Q 18 9 18 14 L 18 21" />
    </svg>
  );
}

function FeatherIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="4" />
      <path d="M 20 4 Q 14 4 10 8 Q 6 12 6 18" />
      <path d="M 20 4 Q 20 10 16 14 Q 12 18 6 18" />
    </svg>
  );
}

interface Tab {
  route: string;
  label: string;
  render: (color: string) => ReactNode;
}

const tabs: Tab[] = [
  { route: '/', label: 'Dashboard', render: (c) => <PersonIcon color={c} /> },
  { route: '/calendar', label: 'Calendar', render: (c) => <Calendar size={20} color={c} /> },
  { route: '/log', label: 'Log', render: (c) => <FeatherIcon color={c} /> },
  { route: '/trends', label: 'Trends', render: (c) => <TrendingUp size={20} color={c} /> },
];

const barStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: 'var(--bg-elevated)',
  borderTop: '1px solid var(--border-default)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  zIndex: 100,
};

const tabStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '44px',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav style={barStyle}>
      {tabs.map(({ route, label, render }) => {
        const active = location.pathname === route;
        const color = active ? 'var(--ochre)' : 'var(--text-muted)';
        return (
          <button
            key={route}
            onClick={() => navigate(route)}
            style={tabStyle}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            {render(color)}
          </button>
        );
      })}
    </nav>
  );
}
