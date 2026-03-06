import type { ReactNode, CSSProperties } from 'react';
import TabBar from './TabBar';

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
};

const mainStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingBottom: '72px',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={shellStyle}>
      <main style={mainStyle}>{children}</main>
      <TabBar />
    </div>
  );
}
