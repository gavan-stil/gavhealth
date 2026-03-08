import type { CSSProperties } from 'react';

const headerStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #2a2218, #1e1a14)',
  borderBottom: '1px solid rgba(184,168,120,0.10)',
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export default function GoeHeader() {
  return (
    <header style={headerStyle}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80" height="24">
        <g transform="translate(40, 40)">
          <path d="M 28 -14 A 30 30 0 1 0 26 15" fill="none" stroke="#e8c47a" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="0" y1="0" x2="28" y2="0" stroke="#e8c47a" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g transform="translate(140, 40)">
          <circle cx="0" cy="0" r="30" fill="none" stroke="#e8c47a" strokeWidth="1.8" />
        </g>
        <g transform="translate(240, 40)">
          <line x1="-20" y1="-26" x2="20" y2="-26" stroke="#e8c47a" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-20" y1="0" x2="12" y2="0" stroke="#e8c47a" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-20" y1="26" x2="20" y2="26" stroke="#e8c47a" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="18" cy="0" r="2.5" fill="#e8c47a" />
        </g>
      </svg>
    </header>
  );
}
