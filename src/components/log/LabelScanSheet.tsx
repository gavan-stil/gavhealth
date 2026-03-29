import { useState, useMemo, useEffect } from 'react';
import { X, Camera, AlertTriangle, Loader } from 'lucide-react';
import type { LabelScanResult, Macros, ParsedItem } from '@/types/food';
import type { ScanState } from '@/hooks/useLabelScan';

type Props = {
  open: boolean;
  onClose: () => void;
  scanState: ScanState;
  imageDataUrl: string | null;
  labelResult: LabelScanResult | null;
  scanError: string | null;
  onRetake: () => void;
  onAdd: (item: ParsedItem) => void;
};

export default function LabelScanSheet({
  open, onClose, scanState, imageDataUrl, labelResult, scanError, onRetake, onAdd,
}: Props) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'grams' | 'servings'>('servings');
  const [editName, setEditName] = useState('');

  // Reset form when new result arrives
  useEffect(() => {
    if (labelResult) {
      setEditName(labelResult.name);
      setAmount(unit === 'servings' ? '1' : String(labelResult.serving_size_g ?? 100));
    }
  }, [labelResult]);

  // Compute scaled macros
  const scaled: Macros | null = useMemo(() => {
    if (!labelResult) return null;
    const num = parseFloat(amount) || 0;
    if (num <= 0) return { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    if (unit === 'grams') {
      const base = labelResult.per_100g ?? labelResult.per_serving;
      const baseGrams = labelResult.per_100g ? 100 : (labelResult.serving_size_g ?? 100);
      const factor = num / baseGrams;
      return {
        calories_kcal: Math.round(base.calories_kcal * factor),
        protein_g: +(base.protein_g * factor).toFixed(1),
        carbs_g: +(base.carbs_g * factor).toFixed(1),
        fat_g: +(base.fat_g * factor).toFixed(1),
      };
    } else {
      // servings
      const sv = labelResult.per_serving;
      return {
        calories_kcal: Math.round(sv.calories_kcal * num),
        protein_g: +(sv.protein_g * num).toFixed(1),
        carbs_g: +(sv.carbs_g * num).toFixed(1),
        fat_g: +(sv.fat_g * num).toFixed(1),
      };
    }
  }, [labelResult, amount, unit]);

  const handleAdd = () => {
    if (!scaled || !labelResult) return;
    onAdd({
      name: editName || labelResult.name,
      calories_kcal: scaled.calories_kcal,
      protein_g: scaled.protein_g,
      carbs_g: scaled.carbs_g,
      fat_g: scaled.fat_g,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.25s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ font: '700 16px/1.2 Inter,sans-serif', color: 'var(--text-primary)' }}>
          Scan Label
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Image preview */}
        {imageDataUrl && (
          <div style={{ marginBottom: 16, borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 200 }}>
            <img src={imageDataUrl} alt="Scanned label" style={{ width: '100%', objectFit: 'contain', maxHeight: 200 }} />
          </div>
        )}

        {/* Scanning state */}
        {scanState === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
            <Loader size={24} color="var(--ochre)" style={{ animation: 'spin 0.7s linear infinite' }} />
            <span style={{ font: '500 14px/1 Inter,sans-serif', color: 'var(--text-secondary)' }}>
              Analysing nutrition label...
            </span>
          </div>
        )}

        {/* Error state */}
        {scanState === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <AlertTriangle size={24} color="var(--ember)" />
            <span style={{ font: '400 13px/1.4 Inter,sans-serif', color: 'var(--ember)', textAlign: 'center' }}>
              {scanError || 'Could not read label. Try a clearer photo.'}
            </span>
            <button
              onClick={onRetake}
              style={{
                padding: '10px 20px', background: 'var(--ochre)', color: 'var(--bg-base)',
                border: 'none', borderRadius: 'var(--radius-md)',
                font: '600 13px/1 Inter,sans-serif', cursor: 'pointer',
              }}
            >
              <Camera size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Retake Photo
            </button>
          </div>
        )}

        {/* Results */}
        {scanState === 'done' && labelResult && scaled && (
          <>
            {/* Confidence warning */}
            {labelResult.confidence !== 'high' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginBottom: 12,
                background: 'rgba(200,150,62,0.1)', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(200,150,62,0.25)',
              }}>
                <AlertTriangle size={14} color="var(--ochre)" />
                <span style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--ochre)' }}>
                  {labelResult.confidence === 'medium' ? 'Some values estimated — check below' : 'Low confidence — please verify all values'}
                </span>
              </div>
            )}

            {/* Product name (editable) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Product Name
              </label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  font: '500 14px/1.4 Inter,sans-serif', outline: 'none',
                }}
              />
            </div>

            {/* Per-serving info */}
            <div style={{
              padding: '12px', marginBottom: 16,
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Per Serving ({labelResult.serving_size_g ? `${labelResult.serving_size_g}g` : 'as labelled'})
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Cal', value: labelResult.per_serving.calories_kcal },
                  { label: 'P', value: `${labelResult.per_serving.protein_g}g` },
                  { label: 'C', value: `${labelResult.per_serving.carbs_g}g` },
                  { label: 'F', value: `${labelResult.per_serving.fat_g}g` },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ font: '600 10px/1 Inter,sans-serif', color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ font: '700 14px/1 "JetBrains Mono",monospace', color: 'var(--text-primary)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                How much?
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                    font: '600 16px/1 "JetBrains Mono",monospace', outline: 'none',
                  }}
                />
                <div style={{
                  display: 'flex', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-pill)', padding: 3,
                  border: '1px solid var(--border-default)',
                }}>
                  {(['servings', 'grams'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => {
                        setUnit(u);
                        if (u === 'grams' && labelResult.serving_size_g) {
                          setAmount(String(labelResult.serving_size_g));
                        } else if (u === 'servings') {
                          setAmount('1');
                        }
                      }}
                      style={{
                        padding: '8px 14px', border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        background: unit === u ? 'var(--bg-card)' : 'transparent',
                        color: unit === u ? 'var(--text-primary)' : 'var(--text-muted)',
                        font: '600 12px/1 Inter,sans-serif', cursor: 'pointer',
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* YOUR TOTAL */}
            <div style={{
              padding: '14px', marginBottom: 16,
              background: 'rgba(200,150,62,0.08)', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(200,150,62,0.2)',
            }}>
              <span style={{ font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ochre)', display: 'block', marginBottom: 10 }}>
                Your Total
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Cal', value: scaled.calories_kcal, color: 'var(--ochre)' },
                  { label: 'P', value: `${scaled.protein_g}g`, color: 'var(--dawn)' },
                  { label: 'C', value: `${scaled.carbs_g}g`, color: 'var(--gold)' },
                  { label: 'F', value: `${scaled.fat_g}g`, color: 'var(--clay, var(--rust))' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ font: '600 10px/1 Inter,sans-serif', color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ font: '800 18px/1 "JetBrains Mono",monospace', color: m.color, letterSpacing: '-0.5px' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Retake + Add buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onRetake}
                style={{
                  flex: 0, padding: '12px 16px',
                  background: 'transparent', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                  font: '600 13px/1 Inter,sans-serif', cursor: 'pointer',
                }}
              >
                Retake
              </button>
              <button
                onClick={handleAdd}
                disabled={(parseFloat(amount) || 0) <= 0}
                style={{
                  flex: 1, padding: '12px 16px',
                  background: 'var(--ochre)', border: 'none',
                  borderRadius: 'var(--radius-md)', color: 'var(--bg-base)',
                  font: '700 14px/1 Inter,sans-serif', cursor: 'pointer',
                  opacity: (parseFloat(amount) || 0) <= 0 ? 0.4 : 1,
                }}
              >
                Add to staged →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
