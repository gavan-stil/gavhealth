import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  year: number;
  month: number; // 0-indexed
  onPrev: () => void;
  onNext: () => void;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthHeader({ year, month, onPrev, onNext }: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-sm) 0",
      }}
    >
      <button
        onClick={onPrev}
        aria-label="Previous month"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: "var(--space-sm)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <ChevronLeft size={20} />
      </button>

      <span
        style={{
          font: "700 16px/1.2 'Inter', sans-serif",
          letterSpacing: "-0.5px",
          color: "var(--text-primary)",
        }}
      >
        {MONTH_NAMES[month]} {year}
      </span>

      <button
        onClick={onNext}
        aria-label="Next month"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: "var(--space-sm)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
