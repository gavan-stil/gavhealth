import type { SleepStage } from "@/hooks/useSleepStages";

// state → fill color
const STAGE_COLOR: Record<number, string> = {
  0: "#a07830",                          // awake — ochre-dim
  1: "rgba(127, 170, 188, 0.38)",        // light sleep — dawn dim
  2: "#7FAABC",                          // deep sleep — dawn
  3: "#9A94C4",                          // REM — dawn-purple
};

interface Props {
  stages: SleepStage[];
  height?: number;
}

export default function SleepStageBar({ stages, height = 10 }: Props) {
  if (!stages.length) return null;

  const sorted = [...stages].sort((a, b) => a.startdate - b.startdate);
  const windowStart = sorted[0].startdate;
  const windowEnd = sorted[sorted.length - 1].enddate;
  const totalDuration = windowEnd - windowStart;

  if (totalDuration <= 0) return null;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        gap: 0,
      }}
    >
      {sorted.map((seg, i) => {
        const width = ((seg.enddate - seg.startdate) / totalDuration) * 100;
        return (
          <div
            key={i}
            style={{
              width: `${width}%`,
              height: "100%",
              background: STAGE_COLOR[seg.state] ?? "#444",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
