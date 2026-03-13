import { useState, useCallback, useMemo } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import type { CategoryName, CalendarData } from "@/types/calendar";
import { CATEGORY_ORDER, SUB_TOGGLE_DEFS } from "@/types/calendar";
import ToggleBar from "@/components/calendar/ToggleBar";
import SubToggleBar from "@/components/calendar/SubToggleBar";
import MonthGrid from "@/components/calendar/MonthGrid";
import DayDetailSheet from "@/components/calendar/DayDetailSheet";
import StatsSection from "@/components/calendar/StatsSection";
import PatternsSection from "@/components/calendar/PatternsSection";
import SyncButton from "@/components/SyncButton";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function CalendarPage() {
  const { blocks, loading, loadingPrev, error, loadPrevMonth, refetch } = useCalendarData();

  const [activeCategories, setActiveCategories] = useState<Set<CategoryName>>(
    () => new Set<CategoryName>(["strength"]),
  );
  const [showDuration, setShowDuration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [showWk, setShowWk] = useState(false);
  const [subToggles, setSubToggles] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const singleCategory: CategoryName | null = useMemo(() => {
    if (activeCategories.size === 1) return [...activeCategories][0];
    return null;
  }, [activeCategories]);

  /** Merged data across all loaded months for day-detail lookup */
  const combinedData = useMemo<CalendarData>(() => {
    const r: CalendarData = {};
    for (const b of blocks) Object.assign(r, b.data);
    return r;
  }, [blocks]);

  const latestBlock = blocks[blocks.length - 1];

  const handleToggleCategory = useCallback((cat: CategoryName) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size === 1) return prev;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    setActiveCategories(new Set(CATEGORY_ORDER));
  }, []);

  const handleToggleSub = useCallback((id: string) => {
    setSubToggles((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  }, []);

  const handleDaySelect = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const selectedDots = useMemo(() => {
    if (!selectedDate || !combinedData[selectedDate]) return [];
    return combinedData[selectedDate].filter((d) => activeCategories.has(d.category));
  }, [selectedDate, combinedData, activeCategories]);

  const resolvedSubToggles = useMemo(() => {
    if (!singleCategory) return {};
    const defs = SUB_TOGGLE_DEFS[singleCategory];
    const result: Record<string, boolean> = {};
    for (const d of defs) {
      result[d.id] = subToggles[d.id] !== false;
    }
    return result;
  }, [singleCategory, subToggles]);

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Sticky top bar: Load earlier | Wk toggle | Sync */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--border-subtle)",
          height: 43,
          display: "flex",
          alignItems: "center",
          paddingInline: "var(--space-md)",
          gap: "var(--space-sm)",
        }}
      >
        <button
          onClick={loadPrevMonth}
          disabled={loadingPrev}
          style={{
            flex: 1,
            height: 28,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            background: "none",
            font: "500 11px/1 'Inter', sans-serif",
            color: loadingPrev ? "var(--text-muted)" : "var(--text-secondary)",
            cursor: loadingPrev ? "default" : "pointer",
          }}
        >
          {loadingPrev ? "Loading…" : "← Load earlier"}
        </button>

        <button
          onClick={() => setShowWk((p) => !p)}
          style={{
            height: 28,
            paddingInline: 10,
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${showWk ? "var(--ochre)" : "var(--border-subtle)"}`,
            background: showWk ? "rgba(180,112,80,0.12)" : "none",
            font: "600 11px/1 'Inter', sans-serif",
            color: showWk ? "var(--ochre)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          Wk
        </button>

        <SyncButton onSuccess={refetch} />
      </div>

      <div
        style={{
          padding: "var(--space-md)",
          maxWidth: 420,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        {error && (
          <div
            style={{
              padding: "var(--space-sm) var(--space-md)",
              background: "rgba(196,90,74,0.15)",
              borderRadius: "var(--radius-sm)",
              font: "400 11px/1.3 'Inter', sans-serif",
              color: "#c45a4a",
            }}
          >
            {error}
          </div>
        )}

        <ToggleBar
          activeCategories={activeCategories}
          onToggleCategory={handleToggleCategory}
          onResetAll={handleResetAll}
          showDuration={showDuration}
          onToggleDuration={() => setShowDuration((p) => !p)}
          showStats={showStats}
          onToggleStats={() => setShowStats((p) => !p)}
          showPatterns={showPatterns}
          onTogglePatterns={() => setShowPatterns((p) => !p)}
        />

        {singleCategory && (
          <SubToggleBar
            category={singleCategory}
            subToggles={resolvedSubToggles}
            onToggleSub={handleToggleSub}
          />
        )}

        {showStats && latestBlock && (
          <StatsSection
            data={latestBlock.data}
            year={latestBlock.year}
            month={latestBlock.month}
            activeCategories={activeCategories}
          />
        )}

        {showPatterns && latestBlock && (
          <PatternsSection
            data={latestBlock.data}
            year={latestBlock.year}
            month={latestBlock.month}
            activeCategories={activeCategories}
          />
        )}
      </div>

      {/* Month blocks — oldest at top */}
      {loading ? (
        <div
          style={{
            padding: "var(--space-xl) var(--space-lg)",
            color: "var(--text-muted)",
            font: "400 13px/1.4 'Inter', sans-serif",
            textAlign: "center",
          }}
        >
          Loading…
        </div>
      ) : (
        blocks.map((block) => (
          <div key={`${block.year}-${block.month}`} style={{ maxWidth: 420, margin: "0 auto" }}>
            {/* Sticky month label */}
            <div
              style={{
                position: "sticky",
                top: 43,
                zIndex: 10,
                background: "var(--bg-base)",
                borderBottom: "1px solid var(--border-subtle)",
                paddingInline: "var(--space-md)",
                paddingBlock: "var(--space-xs)",
                font: "600 14px/1 'Inter', sans-serif",
                color: "var(--text-secondary)",
              }}
            >
              {MONTH_NAMES[block.month]} {block.year}
            </div>

            <div style={{ paddingInline: "var(--space-md)", paddingBottom: "var(--space-md)" }}>
              <MonthGrid
                data={block.data}
                year={block.year}
                month={block.month}
                activeCategories={activeCategories}
                singleCategory={singleCategory}
                subToggles={resolvedSubToggles}
                showWk={showWk}
                onDaySelect={handleDaySelect}
              />
            </div>
          </div>
        ))
      )}

      <DayDetailSheet
        date={selectedDate}
        dots={selectedDots}
        onClose={handleCloseSheet}
        onSessionDeleted={refetch}
      />
    </div>
  );
}
