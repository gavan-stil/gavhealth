import { useState, useCallback, useMemo } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import type { CategoryName } from "@/types/calendar";
import { CATEGORY_ORDER, SUB_TOGGLE_DEFS } from "@/types/calendar";
import MonthHeader from "@/components/calendar/MonthHeader";
import ToggleBar from "@/components/calendar/ToggleBar";
import SubToggleBar from "@/components/calendar/SubToggleBar";
import MonthGrid from "@/components/calendar/MonthGrid";
import DayDetailSheet from "@/components/calendar/DayDetailSheet";
import StatsSection from "@/components/calendar/StatsSection";
import PatternsSection from "@/components/calendar/PatternsSection";

export default function CalendarPage() {
  const { data, loading, error } = useCalendarData();

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const [activeCategories, setActiveCategories] = useState<Set<CategoryName>>(
    () => new Set(CATEGORY_ORDER)
  );

  const [showDuration, setShowDuration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  const [subToggles, setSubToggles] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const singleCategory: CategoryName | null = useMemo(() => {
    if (activeCategories.size === 1) return [...activeCategories][0];
    return null;
  }, [activeCategories]);

  const handlePrev = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

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
    if (!selectedDate || !data[selectedDate]) return [];
    return data[selectedDate].filter((d) => activeCategories.has(d.category));
  }, [selectedDate, data, activeCategories]);

  const resolvedSubToggles = useMemo(() => {
    if (!singleCategory) return {};
    const defs = SUB_TOGGLE_DEFS[singleCategory];
    const result: Record<string, boolean> = {};
    for (const d of defs) {
      result[d.id] = subToggles[d.id] !== false;
    }
    return result;
  }, [singleCategory, subToggles]);

  if (loading) {
    return (
      <div
        style={{
          padding: "var(--space-xl) var(--space-lg)",
          color: "var(--text-muted)",
          font: "400 13px/1.4 'Inter', sans-serif",
          textAlign: "center",
        }}
      >
        Loading calendar data…
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "var(--space-md) var(--space-md) 100px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        maxWidth: 420,
        margin: "0 auto",
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

      <MonthHeader
        year={currentMonth.year}
        month={currentMonth.month}
        onPrev={handlePrev}
        onNext={handleNext}
      />

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

      {showStats && (
        <StatsSection
          data={data}
          year={currentMonth.year}
          month={currentMonth.month}
          activeCategories={activeCategories}
        />
      )}

      {showPatterns && (
        <PatternsSection
          data={data}
          year={currentMonth.year}
          month={currentMonth.month}
          activeCategories={activeCategories}
        />
      )}

      <MonthGrid
        data={data}
        year={currentMonth.year}
        month={currentMonth.month}
        activeCategories={activeCategories}
        showDuration={showDuration}
        singleCategory={singleCategory}
        subToggles={resolvedSubToggles}
        onDaySelect={handleDaySelect}
      />

      <DayDetailSheet
        date={selectedDate}
        dots={selectedDots}
        onClose={handleCloseSheet}
      />
    </div>
  );
}
