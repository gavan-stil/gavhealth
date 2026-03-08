import type { ReactNode, CSSProperties } from 'react';
import TabBar from './TabBar';
import GoeHeader from './GoeHeader';

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
      <GoeHeader />
      <main style={mainStyle}>{children}</main>
      <TabBar />
    </div>
  );
}
