import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Plus, TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';

const tabs = [
  { icon: LayoutDashboard, route: '/', label: 'Dashboard' },
  { icon: Calendar, route: '/calendar', label: 'Calendar' },
  { icon: Plus, route: '/log', label: 'Log' },
  { icon: TrendingUp, route: '/trends', label: 'Trends' },
] as const;

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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  minWidth: '44px',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const labelStyle: CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
};

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav style={barStyle}>
      {tabs.map(({ icon: Icon, route, label }) => {
        const active = location.pathname === route;
        const color = active ? 'var(--ochre)' : 'var(--text-muted)';
        return (
          <button
            key={route}
            onClick={() => navigate(route)}
            style={{ ...tabStyle, color }}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} />
            <span style={{ ...labelStyle, color }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
