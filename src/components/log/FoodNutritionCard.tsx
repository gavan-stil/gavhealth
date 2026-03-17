import { useState, useEffect, useRef, useMemo } from 'react';
import { UtensilsCrossed, X, AlertCircle, Loader } from 'lucide-react';
import { useFoodNutrition } from '@/hooks/useFoodNutrition';
import { useQuickAdd } from '@/hooks/useQuickAdd';
import { FOOD_TARGETS } from '@/types/food';
import type { ParsedItem, SavedMeal } from '@/types/food';
import type { QuickAddItem } from '@/hooks/useQuickAdd';

// ── helpers ──────────────────────────────────────────────────────────────────
const pct = (v: number, t: number) => Math.min(100, Math.round((v / t) * 100));
const fmt = (n: number) => n.toLocaleString();

// ── types ─────────────────────────────────────────────────────────────────────
type StagedEntry = QuickAddItem & { stageId: number };
type QuickTab = 'yesterday' | 'frequent' | 'saved';

// ── MacroBar ──────────────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color }: {
  label: string; value: number; target: number; color: string;
}) {
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

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({
  name, kcal, count, dimmed, alreadyLogged, onTap, onDelete,
}: {
  name: string;
  kcal: number;
  count?: number;
  dimmed?: boolean;
  alreadyLogged?: boolean;
  onTap?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap', flexShrink: 0,
        padding: '7px 11px',
        background: 'var(--bg-elevated)',
        border: `1px solid ${alreadyLogged ? 'rgba(90,158,111,0.4)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-pill)',
        color: alreadyLogged ? 'var(--signal-good)' : 'var(--text-secondary)',
        font: '500 12px/1 Inter,sans-serif',
        cursor: onTap ? 'pointer' : 'default',
        opacity: dimmed ? 0.4 : 1,
        transition: 'opacity 0.2s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {alreadyLogged && (
        <span style={{ font: '700 10px/1 Inter,sans-serif', color: 'var(--signal-good)' }}>✓</span>
      )}
      <span>{name}</span>
      <span style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)' }}>
        {kcal}
      </span>
      {count !== undefined && (
        <span style={{
          font: '700 10px/1 "JetBrains Mono",monospace',
          color: 'var(--ochre)',
          background: 'rgba(200,150,62,0.12)',
          borderRadius: 99, padding: '1px 5px',
        }}>
          ×{count}
        </span>
      )}
      {onDelete && (
        <span
          role="button"
          onClick={onDelete}
          style={{ marginLeft: 2, opacity: 0.6, color: 'var(--ember)', lineHeight: 1, fontSize: 12 }}
        >
          ×
        </span>
      )}
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function FoodNutritionCard({
  open, onToggle, date,
}: {
  open: boolean;
  onToggle: () => void;
  date: string;
}) {
  const {
    savedMeals, saveMeal, deleteSavedMeal,
    todayLog, logLoading, logItem, removeLogEntry,
    totals,
    parseInput, setParseInput,
    parsedItems, parseState,
    triggerParse, clearParse,
  } = useFoodNutrition(date);

  const { yesterdayItems, frequentItems, loading: qaLoading } = useQuickAdd(date);

  // ── Staged state ──────────────────────────────────────────────────────────
  const [staged, setStaged] = useState<StagedEntry[]>([]);
  const [stageError, setStageError] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const nextStageId = useRef(1);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<QuickTab>('yesterday');
  const [userPickedTab, setUserPickedTab] = useState(false);

  // Clear staged + reset tab on date change (bug #7)
  useEffect(() => {
    setStaged([]);
    setStageError([]);
    setActiveTab('yesterday');
    setUserPickedTab(false);
  }, [date]);

  // Auto-switch tab once data loads, if user hasn't manually picked (bug #12)
  useEffect(() => {
    if (qaLoading || userPickedTab) return;
    if (yesterdayItems.length > 0) { setActiveTab('yesterday'); return; }
    if (frequentItems.length > 0) { setActiveTab('frequent'); return; }
    setActiveTab('saved');
  }, [qaLoading, yesterdayItems.length, frequentItems.length, userPickedTab]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Names already in today's log (for ✓ indicator — bug #8)
  const todayLogNames = useMemo(
    () => new Set(todayLog.map(e => e.name.toLowerCase())),
    [todayLog]
  );

  // Names currently staged (for chip dim + "Add all" dedup — bug #10)
  const stagedNameSet = useMemo(
    () => new Set(staged.map(e => e.name.toLowerCase())),
    [staged]
  );

  // ── Staging actions ───────────────────────────────────────────────────────
  const handleStage = (item: QuickAddItem) => {
    setStaged(prev => [...prev, { ...item, stageId: nextStageId.current++ }]);
    setStageError([]);
  };

  const handleAddAll = (items: QuickAddItem[]) => {
    // Dedup by name — skip already staged (bug #10)
    const toAdd = items.filter(item => !stagedNameSet.has(item.name.toLowerCase()));
    if (toAdd.length === 0) return;
    setStaged(prev => [
      ...prev,
      ...toAdd.map(item => ({ ...item, stageId: nextStageId.current++ })),
    ]);
    setStageError([]);
  };

  const handleRemoveStaged = (stageId: number) => {
    setStaged(prev => prev.filter(e => e.stageId !== stageId));
  };

  // Sequential confirm — collect failures (bugs #5, #6)
  const handleConfirmStaged = async () => {
    if (staged.length === 0 || confirming) return;
    setConfirming(true);
    const toConfirm = [...staged];
    setStaged([]);
    const failed: StagedEntry[] = [];
    for (const entry of toConfirm) {
      try {
        await logItem(entry);
      } catch {
        failed.push(entry);
      }
    }
    if (failed.length > 0) {
      setStaged(failed);
      setStageError(failed.map(e => e.name));
    } else {
      setStageError([]);
    }
    setConfirming(false);
  };

  // ── Parse-result actions ──────────────────────────────────────────────────
  const [addedIndexes, setAddedIndexes] = useState<Set<number>>(new Set());
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const handleLogItem = async (item: ParsedItem | Omit<SavedMeal, 'id'>, idx?: number) => {
    try {
      await logItem(item);
      if (idx !== undefined) setAddedIndexes(prev => new Set(prev).add(idx));
    } catch { /* logItem rolled back */ }
  };

  const handleSaveToLibrary = async (item: ParsedItem, idx: number) => {
    await saveMeal(item);
    setSavedIndexes(prev => new Set(prev).add(idx));
  };

  const handleDeleteMeal = async (id: number) => {
    await deleteSavedMeal(id);
  };

  // ── Totals display ────────────────────────────────────────────────────────
  const kcalOver = totals.kcal > FOOD_TARGETS.kcal;
  const kcalExcess = Math.round(totals.kcal - FOOD_TARGETS.kcal);
  const kcalPct = pct(totals.kcal, FOOD_TARGETS.kcal);

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = (tab: QuickTab) => {
    setActiveTab(tab);
    setUserPickedTab(true);
  };

  const tabStyle = (tab: QuickTab): React.CSSProperties => ({
    padding: '5px 12px',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    font: '600 11px/1 Inter,sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.15s, color 0.15s',
  });

  // ── Chip strip for a tab ──────────────────────────────────────────────────
  const chipStrip = (items: QuickAddItem[], showCount = false) => {
    if (!qaLoading && items.length === 0) {
      return (
        <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', padding: '4px 0 8px' }}>
          {activeTab === 'yesterday'
            ? 'Nothing logged yesterday'
            : 'Log meals consistently to see patterns here'}
        </p>
      );
    }
    return (
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        marginBottom: 8,
      }}>
        {items.map(item => (
          <Chip
            key={item.id}
            name={item.name}
            kcal={item.calories_kcal}
            count={showCount ? item.count : undefined}
            dimmed={stagedNameSet.has(item.name.toLowerCase())}
            alreadyLogged={todayLogNames.has(item.name.toLowerCase())}
            onTap={() => handleStage(item)}
          />
        ))}
      </div>
    );
  };

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
        {!open && totals.kcal > 0 && (
          <span style={{ font: '600 13px/1 "JetBrains Mono",monospace', letterSpacing: '-0.5px', color: 'var(--ochre)', marginRight: 8 }}>
            {fmt(totals.kcal)} kcal
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>

          {/* ── ① QUICK ADD ────────────────────────────────────────────── */}
          {/* Tab strip + Add all */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              display: 'flex', gap: 2,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-pill)',
              padding: 3,
            }}>
              <button style={tabStyle('yesterday')} onClick={() => switchTab('yesterday')}>Yesterday</button>
              <button style={tabStyle('frequent')}  onClick={() => switchTab('frequent')}>Frequent</button>
              <button style={tabStyle('saved')}     onClick={() => switchTab('saved')}>Saved</button>
            </div>

            {activeTab !== 'saved' && (
              <button
                onClick={() => handleAddAll(activeTab === 'yesterday' ? yesterdayItems : frequentItems)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--ochre)', font: '600 11px/1 Inter,sans-serif',
                  cursor: 'pointer', padding: '4px 0',
                }}
              >
                Add all
              </button>
            )}
          </div>

          {/* Tab content */}
          {activeTab === 'yesterday' && chipStrip(yesterdayItems)}
          {activeTab === 'frequent'  && chipStrip(frequentItems, true)}
          {activeTab === 'saved' && (
            savedMeals.length === 0 ? (
              <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', padding: '4px 0 8px' }}>
                No saved meals yet — parse food below and save items to build your library.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', marginBottom: 8 }}>
                {savedMeals.map(meal => (
                  <Chip
                    key={meal.id}
                    name={meal.name}
                    kcal={meal.calories_kcal}
                    alreadyLogged={todayLogNames.has(meal.name.toLowerCase())}
                    onTap={() => handleLogItem(meal)}
                    onDelete={e => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                  />
                ))}
              </div>
            )
          )}

          {/* ── ② STAGED AREA ──────────────────────────────────────────── */}
          {staged.length > 0 && (
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid rgba(200,150,62,0.25)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              marginBottom: 14,
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px 6px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ochre)' }}>
                  Staged
                </span>
                <span style={{ font: '400 11px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>
                  {staged.length} item{staged.length !== 1 ? 's' : ''} · {fmt(staged.reduce((s, e) => s + e.calories_kcal, 0))} kcal
                </span>
              </div>

              {/* List — capped height so it doesn't push NLP off screen (bug #11) */}
              <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
                {staged.map(entry => (
                  <div key={entry.stageId} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px',
                  }}>
                    <span style={{ flex: 1, font: '400 13px/1 Inter,sans-serif', color: 'var(--text-primary)' }}>
                      {entry.name}
                    </span>
                    <span style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                      {entry.calories_kcal} kcal
                    </span>
                    <button
                      onClick={() => handleRemoveStaged(entry.stageId)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.5, fontSize: 14, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Partial failure error (bug #6) */}
              {stageError.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', color: 'var(--ember)' }}>
                  <AlertCircle size={12} />
                  <span style={{ font: '400 11px/1.4 Inter,sans-serif' }}>
                    Failed to log: {stageError.join(', ')}. Tap confirm to retry.
                  </span>
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={handleConfirmStaged}
                disabled={confirming}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: 'var(--ochre)',
                  border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--bg-base)',
                  font: '700 13px/1 Inter,sans-serif',
                  cursor: confirming ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: confirming ? 0.6 : 1,
                }}
              >
                {confirming && <Loader size={12} style={{ animation: 'spin 0.7s linear infinite' }} />}
                {confirming
                  ? 'Adding…'
                  : `Add ${staged.length} item${staged.length !== 1 ? 's' : ''} to today →`}
              </button>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 14 }} />

          {/* ── ③ NEW FOOD (NLP) ────────────────────────────────────────── */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              New food
            </span>
            <textarea
              value={parseInput}
              onChange={e => setParseInput(e.target.value)}
              placeholder="Anything new you ate… e.g. banana, flat white, handful of almonds"
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

          {/* ── ④ PARSED RESULTS ─────────────────────────────────────────── */}
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
                    <button
                      onClick={() => handleSaveToLibrary(item, i)}
                      disabled={savedIndexes.has(i)}
                      style={{
                        padding: '5px 9px', background: 'transparent',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                        color: savedIndexes.has(i) ? 'var(--ochre)' : 'var(--text-muted)',
                        font: '500 11px/1 Inter,sans-serif',
                        cursor: savedIndexes.has(i) ? 'default' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {savedIndexes.has(i) ? '★ Saved' : '★ Save'}
                    </button>
                    <button
                      onClick={() => handleLogItem(item, i)}
                      disabled={addedIndexes.has(i)}
                      style={{
                        padding: '5px 9px',
                        background: addedIndexes.has(i) ? 'transparent' : 'var(--ochre)',
                        border: addedIndexes.has(i) ? '1px solid var(--border-default)' : 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: addedIndexes.has(i) ? 'var(--text-muted)' : 'var(--bg-base)',
                        font: '600 11px/1 Inter,sans-serif',
                        cursor: addedIndexes.has(i) ? 'default' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {addedIndexes.has(i) ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ⑤ TODAY'S LOG ──────────────────────────────────────────── */}
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {date === new Date().toLocaleDateString('en-CA') ? "Today's log" : 'Log'}
            </span>
            {!logLoading && todayLog.length > 0 && (
              <span style={{ font: '400 11px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>
                {todayLog.length} item{todayLog.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {logLoading ? (
            <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginBottom: 16 }}>Loading…</p>
          ) : todayLog.length === 0 ? (
            <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginBottom: 16 }}>Nothing logged yet</p>
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

          {/* ── ⑥ TOTALS ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ font: '800 28px/1 "JetBrains Mono",monospace', letterSpacing: '-1.5px', color: kcalOver ? 'var(--signal-good)' : 'var(--ochre)' }}>
              {kcalOver ? `+${fmt(kcalExcess)}` : fmt(totals.kcal)}
            </span>
            <span style={{ font: '400 13px/1 Inter,sans-serif', color: 'var(--text-muted)' }}>
              {kcalOver ? 'kcal over target' : `of ${fmt(FOOD_TARGETS.kcal)} kcal`}
            </span>
          </div>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MacroBar label="Protein" value={totals.protein_g} target={FOOD_TARGETS.protein_g} color="linear-gradient(90deg, var(--dawn), #a0ccdc)" />
            <MacroBar label="Carbs"   value={totals.carbs_g}   target={FOOD_TARGETS.carbs_g}   color="linear-gradient(90deg, var(--ochre), var(--gold))" />
            <MacroBar label="Fat"     value={totals.fat_g}     target={FOOD_TARGETS.fat_g}     color="linear-gradient(90deg, var(--rust), var(--sand,#c8a87a))" />
          </div>

        </div>
      )}
    </div>
  );
}
