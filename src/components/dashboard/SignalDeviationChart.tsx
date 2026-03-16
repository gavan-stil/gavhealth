interface DayValue {
  date: string;
  value: number | null;
}

interface Props {
  days: DayValue[];
  baseline: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  unit: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C${cx},${pts[i - 1].y} ${cx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return d;
}

function fmtVal(v: number, unit: string): string {
  if (unit === "hrs") return v.toFixed(1);
  if (unit === "kg") return v.toFixed(1);
  if (unit === "bpm" || unit === "kcal" || unit === "g" || unit === "ml") return String(Math.round(v));
  return String(v);
}

export default function SignalDeviationChart({ days, baseline, targetMin, targetMax, unit }: Props) {
  const validDays = days.filter(d => d.value !== null);
  if (validDays.length === 0) return null;

  const values = validDays.map(d => d.value as number);
  const allVals = [...values];
  if (baseline !== null) allVals.push(baseline);
  if (targetMin !== null && targetMin !== undefined) allVals.push(targetMin);
  if (targetMax !== null && targetMax !== undefined) allVals.push(targetMax);

  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const range = dataMax - dataMin || 1;
  const yMin = dataMin - range * 0.25;
  const yMax = dataMax + range * 0.20;
  const yRange = yMax - yMin;

  // SVG dimensions
  const W = 310, H = 200;
  const padL = 10, padR = 30, padT = 16, padB = 20;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const vy = (v: number) => padT + cH - ((v - yMin) / yRange) * cH;
  const n = days.length;
  const xOf = (i: number) => padL + (i / (n - 1)) * cW;

  const pts = days.map((d, i) => d.value !== null ? { x: xOf(i), y: vy(d.value), v: d.value } : null);
  const validPts = pts.filter(Boolean) as Array<{ x: number; y: number; v: number }>;
  const linePath = smoothPath(validPts);

  const baseY = baseline !== null ? vy(baseline) : null;
  const tTopY = targetMax != null ? vy(targetMax) : null;
  const tBotY = targetMin != null ? vy(targetMin) : null;

  // Warm fill above baseline, cool fill below
  const warmArea = baseY !== null && linePath
    ? `${linePath} L${validPts[validPts.length - 1].x},${baseY} L${validPts[0].x},${baseY} Z`
    : "";

  const labels = days.map((d, i) => {
    const isToday = i === n - 1;
    const [yr, mo, dy] = d.date.split("-").map(Number);
    return { x: xOf(i), label: isToday ? "Today" : DAY_NAMES[new Date(yr, mo - 1, dy).getDay()], isToday };
  });

  const todayPt = validPts.length > 0 ? validPts[validPts.length - 1] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="sdc-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a04a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d4a04a" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="sdc-cool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FAABC" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#7FAABC" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="sdc-deep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a7a8a" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#2a4a5a" stopOpacity="0.14" />
        </linearGradient>
        <radialGradient id="sdc-tg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8c47a" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#e8c47a" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#e8c47a" stopOpacity="0" />
        </radialGradient>
        {baseY !== null && (
          <clipPath id="sdc-above">
            <rect x="0" y="0" width={W} height={baseY} />
          </clipPath>
        )}
        {baseY !== null && (
          <clipPath id="sdc-below">
            <rect x="0" y={baseY} width={W} height={H - baseY} />
          </clipPath>
        )}
      </defs>

      {/* Below-baseline deep tint */}
      {baseY !== null && tBotY !== null && (
        <rect x={padL} y={baseY} width={cW} height={padT + cH - baseY} fill="url(#sdc-deep)" rx="2" />
      )}

      {/* Target zone */}
      {tTopY !== null && tBotY !== null && (
        <>
          <rect x={padL} y={tTopY} width={cW} height={tBotY - tTopY} fill="rgba(212,160,74,0.07)" rx="2" />
          <line x1={padL} y1={tTopY} x2={padL + cW} y2={tTopY} stroke="#d4a04a" strokeOpacity="0.12" strokeWidth="0.5" />
          <line x1={padL} y1={tBotY} x2={padL + cW} y2={tBotY} stroke="#d4a04a" strokeOpacity="0.18" strokeWidth="0.5" />
          {targetMax != null && (
            <text x={W - 2} y={tTopY + 4} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#d4a04a" opacity="0.45" textAnchor="end">
              {fmtVal(targetMax, unit)}
            </text>
          )}
          {targetMin != null && (
            <text x={W - 2} y={tBotY + 4} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#d4a04a" opacity="0.45" textAnchor="end">
              {fmtVal(targetMin, unit)}
            </text>
          )}
        </>
      )}

      {/* Baseline */}
      {baseY !== null && (
        <>
          <line x1={padL} y1={baseY} x2={padL + cW} y2={baseY} stroke="#7a7060" strokeDasharray="3 3" strokeWidth="0.7" opacity="0.5" />
          <text x={W - 2} y={baseY + 4} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#7a7060" opacity="0.45" textAnchor="end">
            {fmtVal(baseline!, unit)}
          </text>
        </>
      )}

      {/* Warm fill (above baseline) */}
      {warmArea && baseY !== null && (
        <path d={warmArea} fill="url(#sdc-warm)" clipPath="url(#sdc-above)" />
      )}

      {/* Cool fill (below baseline) */}
      {warmArea && baseY !== null && (
        <path d={warmArea} fill="url(#sdc-cool)" clipPath="url(#sdc-below)" />
      )}

      {/* Line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="#b0a070" strokeWidth="1.8" strokeLinecap="round" />
      )}

      {/* Data point dots + value labels (not today) */}
      {validPts.slice(0, -1).map((p, i) => {
        const isAbove = baseY !== null ? p.y <= baseY : true;
        const color = isAbove ? "#d4a04a" : "#7FAABC";
        // Label above unless very close to top — then below
        const labelY = p.y - 8 < padT + 4 ? p.y + 14 : p.y - 8;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.6" />
            <text x={p.x} y={labelY} fontFamily="JetBrains Mono, monospace" fontSize="8" fill={color} opacity="0.6" textAnchor="middle">
              {fmtVal(p.v, unit)}
            </text>
          </g>
        );
      })}

      {/* Today glow + dot + label */}
      {todayPt && (() => {
        const isAbove = baseY !== null ? todayPt.y <= baseY : true;
        const labelY = todayPt.y - 8 < padT + 4 ? todayPt.y + 14 : todayPt.y - 8;
        return (
          <g>
            <circle cx={todayPt.x} cy={todayPt.y} r="9" fill="url(#sdc-tg)" />
            <circle cx={todayPt.x} cy={todayPt.y} r="3" fill="#e8c47a" />
            <circle cx={todayPt.x} cy={todayPt.y} r="1.5" fill="#f0ece4" />
            <text x={todayPt.x} y={labelY} fontFamily="JetBrains Mono, monospace" fontSize="8" fill={isAbove ? "#e8c47a" : "#7FAABC"} fontWeight="600" textAnchor="middle">
              {fmtVal(todayPt.v, unit)}
            </text>
          </g>
        );
      })()}

      {/* Day labels */}
      {labels.map(l => (
        <text key={l.x} x={l.x} y={H - 3}
          fontFamily="Inter, sans-serif" fontSize="8"
          fill={l.isToday ? "#e8c47a" : "#7a7060"}
          fontWeight={l.isToday ? "600" : "400"}
          opacity={l.isToday ? 1 : 0.6}
          textAnchor="middle"
        >{l.label}</text>
      ))}
    </svg>
  );
}
