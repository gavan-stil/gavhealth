const pulseStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  borderRadius: "var(--radius-sm)",
};

function Block({ w, h }: { w: string; h: number }) {
  return <div style={{ ...pulseStyle, width: w, height: h }} />;
}

const variants = {
  readiness: () => (
    <>
      <Block w="60%" h={12} />
      <Block w="40%" h={52} />
      <Block w="100%" h={14} />
      <Block w="90%" h={14} />
      <Block w="60%" h={14} />
      <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)", paddingTop: "var(--space-md)", borderTop: "1px solid var(--border-subtle)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-xs)" }}>
            <Block w="32px" h={20} />
            <Block w="28px" h={10} />
          </div>
        ))}
      </div>
    </>
  ),

  vitals: () => (
    <>
      <Block w="60%" h={12} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <Block w="50%" h={10} />
            <Block w="60%" h={28} />
          </div>
        ))}
      </div>
    </>
  ),

  activity: () => (
    <>
      <Block w="60%" h={12} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <div style={{ ...pulseStyle, width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <Block w="70%" h={14} />
              <Block w="40%" h={10} />
            </div>
            <Block w="32px" h={14} />
          </div>
        ))}
      </div>
    </>
  ),

  streaks: () => (
    <>
      <Block w="60%" h={12} />
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "var(--space-md)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-xs)" }}>
            <Block w="16px" h={16} />
            <Block w="24px" h={28} />
            <Block w="32px" h={10} />
          </div>
        ))}
      </div>
    </>
  ),
};

export type SkeletonVariant = keyof typeof variants;

export default function CardSkeleton({ variant }: { variant: SkeletonVariant }) {
  const Variant = variants[variant];
  return (
    <div
      className="goe-card"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
      }}
    >
      <Variant />
    </div>
  );
}
