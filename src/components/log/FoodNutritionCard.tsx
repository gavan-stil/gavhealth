import { useState } from 'react';
import { UtensilsCrossed, X, Plus, AlertCircle, Loader } from 'lucide-react';
import { useFoodNutrition } from '@/hooks/useFoodNutrition';
import { FOOD_TARGETS } from '@/types/food';
import type { ParsedItem, SavedMeal } from '@/types/food';

// ── helpers ─────────────────────────────────────────────────────────────────
const pct = (v: number, t: number) => Math.min(100, Math.round((v / t) * 100));
const fmt  = (n: number) => n.toLocaleString();

// ── sub-components ───────────────────────────────────────────────────────────
function MacroBar({
  label, value, target, color,
}: { label: string; value: number; target: number; color: string }) {
  const over = value > target;
  const excess = Math.round(value - target);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span style={{ font: '600 12px/1 "JetBrains Mono",monospace', letterSpacing: '-0.3px', color: over ? 'var(--signal-good)' : 'var(--text-secondary)' }}>
          {over ? `+${excess}g` : `${Math.round(value)}g`}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: over ? '100%' : `${pct(value, target)}%`,
          background: over ? 'var(--signal-good)' : color, borderRadius: 99,
          transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function FoodNutritionCard({
  open,
  onToggle,
  date,
}: {
  open: boolean;
  onToggle: () => void;
  date: string;
}) {
  const {
    savedMeals, saveMeal, deleteSavedMeal,
    todayLog, logItem, removeLogEntry,
    totals,
    parseInput, setParseInput,
    parsedItems, parseState,
    triggerParse, clearParse,
  } = useFoodNutrition(date);

  // Track which parsed items have been added / saved (local UI state only)
  const [addedIndexes, setAddedIndexes]   = useState<Set<number>>(new Set());
  const [savedIndexes, setSavedIndexes]   = useState<Set<number>>(new Set());
  const [deletingId,   setDeletingId]     = useState<number | null>(null);

  const handleLogItem = async (item: ParsedItem | Omit<SavedMeal, 'id'>, idx?: number) => {
    await logItem(item);
    if (idx !== undefined) setAddedIndexes(prev => new Set(prev).add(idx));
  };

  const handleSaveToLibrary = async (item: ParsedItem, idx: number) => {
    await saveMeal(item);
    setSavedIndexes(prev => new Set(prev).add(idx));
  };

  const handleDeleteMeal = async (id: number) => {
    setDeletingId(id);
    await deleteSavedMeal(id);
    setDeletingId(null);
  };

  const kcalOver = totals.kcal > FOOD_TARGETS.kcal;
  const kcalExcess = Math.round(totals.kcal - FOOD_TARGETS.kcal);
  const kcalPct = pct(totals.kcal, FOOD_TARGETS.kcal);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <UtensilsCrossed size={18} color="var(--gold)" />
        <span style={{ font: '700 16px/1.2 Inter,sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>
          Food &amp; Nutrition
        </span>
        {/* Today's kcal preview in header when closed */}
        {!open && totals.kcal > 0 && (
          <span style={{ font: '600 13px/1 "JetBrains Mono",monospace', letterSpacing: '-0.5px', color: 'var(--ochre)', marginRight: 8 }}>
            {fmt(totals.kcal)} kcal
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>

          {/* ── ① SAVED MEALS ── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Saved meals
              </span>
              <span style={{ font: '400 11px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>tap to add instantly</span>
            </div>

            {savedMeals.length === 0 ? (
              <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', padding: '4px 0' }}>
                No saved meals yet — parse some food below and save items to build your library.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {savedMeals.map(meal => (
                  <button
                    key={meal.id}
                    onClick={() => handleLogItem(meal)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      whiteSpace: 'nowrap', flexShrink: 0,
                      padding: '7px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      font: '500 12px/1 Inter,sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={11} style={{ opacity: 0.6 }} />
                    {meal.name}
                    <span style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)' }}>
                      {meal.calories_kcal}
                    </span>
                    {/* Long-press delete placeholder — tap the × */}
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                      style={{ marginLeft: 2, opacity: deletingId === meal.id ? 1 : 0.65, color: 'var(--ember)', lineHeight: 1, fontSize: 12 }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── ② BRAIN DUMP ── */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              New food
            </span>
            <textarea
              value={parseInput}
              onChange={e => setParseInput(e.target.value)}
              placeholder="Anything new you ate... e.g. banana, flat white, handful of almonds"
              rows={3}
              style={{
                width: '100%', resize: 'none',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                font: '400 13px/1.5 Inter,sans-serif',
                outline: 'none',
                opacity: parseState === 'parsing' ? 0.5 : 1,
              }}
              onFocus={e  => (e.target.style.borderColor = 'var(--ochre)')}
              onBlur={e   => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <button
              onClick={triggerParse}
              disabled={parseState === 'parsing' || !parseInput.trim()}
              style={{
                padding: '9px 16px',
                background: 'var(--ochre)', color: 'var(--bg-base)',
                border: 'none', borderRadius: 'var(--radius-md)',
                font: '600 13px/1 Inter,sans-serif', cursor: 'pointer',
                opacity: (parseState === 'parsing' || !parseInput.trim()) ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {parseState === 'parsing' && <Loader size={12} style={{ animation: 'spin 0.7s linear infinite' }} />}
              {parseState === 'parsing' ? 'Parsing…' : 'Process with AI'}
            </button>
            {(parseInput || parsedItems.length > 0) && (
              <button
                onClick={clearParse}
                style={{
                  padding: '8px 12px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  font: '600 12px/1 Inter,sans-serif', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Parse error */}
          {parseState === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ember)', marginBottom: 12 }}>
              <AlertCircle size={14} />
              <span style={{ font: '400 13px/1 Inter,sans-serif' }}>Could not parse — try again</span>
            </div>
          )}

          {/* ── ③ PARSED RESULTS ── */}
          {parseState === 'done' && parsedItems.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
              <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Parsed — add &amp; save
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parsedItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                      opacity: addedIndexes.has(i) ? 0.45 : 1,
                      transition: 'opacity 0.3s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 13px/1.3 Inter,sans-serif', color: 'var(--text-primary)', marginBottom: 2 }}>{item.name}</div>
                      <div style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px' }}>
                        {item.calories_kcal} kcal · P{Math.round(item.protein_g)} C{Math.round(item.carbs_g)} F{Math.round(item.fat_g)}
                      </div>
                    </div>
                    {/* ★ Save to library */}
                    <button
                      onClick={() => handleSaveToLibrary(item, i)}
                      disabled={savedIndexes.has(i)}
                      title="Save to library"
                      style={{
                        padding: '5px 9px',
                        background: 'transparent',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        color: savedIndexes.has(i) ? 'var(--ochre)' : 'var(--text-muted)',
                        font: '500 11px/1 Inter,sans-serif',
                        cursor: savedIndexes.has(i) ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {savedIndexes.has(i) ? '★ Saved' : '★ Save'}
                    </button>
                    {/* + Add to today */}
                    <button
                      onClick={() => handleLogItem(item, i)}
                      disabled={addedIndexes.has(i)}
                      title="Add to today's log"
                      style={{
                        padding: '5px 9px',
                        background: addedIndexes.has(i) ? 'transparent' : 'var(--ochre)',
                        border: addedIndexes.has(i) ? '1px solid var(--border-default)' : 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: addedIndexes.has(i) ? 'var(--text-muted)' : 'var(--bg-base)',
                        font: '600 11px/1 Inter,sans-serif',
                        cursor: addedIndexes.has(i) ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {addedIndexes.has(i) ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ④ TODAY'S LOG ── */}
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Today's log
            </span>
            {todayLog.length > 0 && (
              <span style={{ font: '400 11px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>
                {todayLog.length} item{todayLog.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {todayLog.length === 0 ? (
            <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginBottom: 16 }}>
              Nothing logged yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {todayLog.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ flex: 1, font: '400 13px/1 Inter,sans-serif', color: 'var(--text-primary)' }}>
                    {entry.name}
                  </span>
                  <span style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                    {entry.calories_kcal} · P{Math.round(entry.protein_g)} C{Math.round(entry.carbs_g)} F{Math.round(entry.fat_g)}
                  </span>
                  <button
                    onClick={() => removeLogEntry(entry.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px 2px 4px', color: 'var(--text-muted)', opacity: 0.5, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── ⑤ TOTALS ── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ font: '800 28px/1 "JetBrains Mono",monospace', letterSpacing: '-1.5px', color: kcalOver ? 'var(--signal-good)' : 'var(--ochre)' }}>
              {kcalOver ? `+${fmt(kcalExcess)}` : fmt(totals.kcal)}
            </span>
            <span style={{ font: '400 13px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>
              {kcalOver ? `kcal over target` : `of ${fmt(FOOD_TARGETS.kcal)} kcal`}
            </span>
          </div>

          {/* Calorie bar */}
          <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{
              height: '100%', width: kcalOver ? '100%' : `${kcalPct}%`,
              background: kcalOver
                ? 'var(--signal-good)'
                : 'linear-gradient(90deg, var(--signal-good), var(--ochre))',
              borderRadius: 99,
              transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>

          {/* Macro bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MacroBar label="Protein" value={totals.protein_g} target={FOOD_TARGETS.protein_g} color="linear-gradient(90deg, var(--dawn), #a0ccdc)" />
            <MacroBar label="Carbs"   value={totals.carbs_g}   target={FOOD_TARGETS.carbs_g}   color="linear-gradient(90deg, var(--ochre), var(--gold))" />
            <MacroBar label="Fat"     value={totals.fat_g}     target={FOOD_TARGETS.fat_g}     color="linear-gradient(90deg, var(--rust), var(--sand))" />
          </div>

        </div>
      )}
    </div>
  );
}
