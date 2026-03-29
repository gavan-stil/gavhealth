import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Camera, Loader, AlertTriangle, ChevronLeft } from 'lucide-react';
import type { Recipe, RecipeIngredient, ParsedItem } from '@/types/food';
import { useLabelScan, recipePortionMacros } from '@/hooks/useLabelScan';

// ── Sub-views ─────────────────────────────────────────────────────────────
type View = 'list' | 'create' | 'edit' | 'use';

type Props = {
  open: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onCreateRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) => Promise<Recipe>;
  onUpdateRecipe: (id: number, updates: Partial<Recipe>) => Promise<Recipe>;
  onDeleteRecipe: (id: number) => Promise<void>;
  onAddToStaged: (item: ParsedItem) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────
function sumIngredients(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (acc, i) => ({
      calories_kcal: acc.calories_kcal + (i.calories_kcal || 0),
      protein_g: +(acc.protein_g + (i.protein_g || 0)).toFixed(1),
      carbs_g: +(acc.carbs_g + (i.carbs_g || 0)).toFixed(1),
      fat_g: +(acc.fat_g + (i.fat_g || 0)).toFixed(1),
    }),
    { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  font: '400 13px/1.4 Inter,sans-serif', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  font: '600 10px/1 Inter,sans-serif', letterSpacing: '1.5px',
  textTransform: 'uppercase', color: 'var(--text-muted)',
  display: 'block', marginBottom: 6,
};

export default function RecipeSheet({
  open, onClose, recipes, onCreateRecipe, onUpdateRecipe, onDeleteRecipe, onAddToStaged,
}: Props) {
  const [view, setView] = useState<View>('list');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [usingRecipe, setUsingRecipe] = useState<Recipe | null>(null);

  // Reset view when sheet closes
  useEffect(() => { if (!open) { setView('list'); setEditingRecipe(null); setUsingRecipe(null); } }, [open]);

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
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setEditingRecipe(null); setUsingRecipe(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
        )}
        <span style={{ font: '700 16px/1.2 Inter,sans-serif', color: 'var(--text-primary)', flex: 1 }}>
          {view === 'list' && 'Recipes'}
          {view === 'create' && 'New Recipe'}
          {view === 'edit' && 'Edit Recipe'}
          {view === 'use' && usingRecipe?.name}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {view === 'list' && (
          <RecipeList
            recipes={recipes}
            onNew={() => setView('create')}
            onEdit={r => { setEditingRecipe(r); setView('edit'); }}
            onUse={r => { setUsingRecipe(r); setView('use'); }}
            onDelete={onDeleteRecipe}
          />
        )}
        {view === 'create' && (
          <RecipeForm
            onSave={async (data) => {
              await onCreateRecipe(data);
              setView('list');
            }}
          />
        )}
        {view === 'edit' && editingRecipe && (
          <RecipeForm
            initial={editingRecipe}
            onSave={async (data) => {
              await onUpdateRecipe(editingRecipe.id, data);
              setView('list');
            }}
          />
        )}
        {view === 'use' && usingRecipe && (
          <RecipeUse
            recipe={usingRecipe}
            onAdd={(item) => { onAddToStaged(item); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Recipe List ───────────────────────────────────────────────────────────
function RecipeList({ recipes, onNew, onEdit, onUse, onDelete }: {
  recipes: Recipe[];
  onNew: () => void;
  onEdit: (r: Recipe) => void;
  onUse: (r: Recipe) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <>
      <button
        onClick={onNew}
        style={{
          width: '100%', padding: '14px', marginBottom: 16,
          background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'var(--ochre)', font: '600 13px/1 Inter,sans-serif',
        }}
      >
        <Plus size={16} /> New Recipe
      </button>

      {recipes.length === 0 && (
        <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          No recipes saved yet. Create one from a photo or add ingredients manually.
        </p>
      )}

      {recipes.map(r => (
        <div key={r.id} style={{
          padding: '12px', marginBottom: 8,
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              onClick={() => onUse(r)}
              style={{ flex: 1, font: '600 14px/1.2 Inter,sans-serif', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {r.name}
            </span>
            <button onClick={() => onEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', font: '500 11px/1 Inter,sans-serif', padding: '4px 8px' }}>
              Edit
            </button>
            {confirmDeleteId === r.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={async () => { await onDelete(r.id); setConfirmDeleteId(null); }}
                  style={{ background: 'var(--ember)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', font: '600 10px/1 Inter,sans-serif', padding: '4px 8px', cursor: 'pointer' }}>
                  Delete
                </button>
                <button onClick={() => setConfirmDeleteId(null)}
                  style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', font: '600 10px/1 Inter,sans-serif', padding: '4px 8px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteId(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, opacity: 0.5 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px' }}>
            {r.calories_kcal} kcal · P{Math.round(r.protein_g)} C{Math.round(r.carbs_g)} F{Math.round(r.fat_g)}
            {r.servings > 1 && ` · ${r.servings} servings`}
            {r.ingredients.length > 0 && ` · ${r.ingredients.length} ingredients`}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Recipe Form (create/edit) ─────────────────────────────────────────────
function RecipeForm({ initial, onSave }: {
  initial?: Recipe;
  onSave: (data: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  // Serving size in grams (per portion). Derive from existing recipe: total_weight / servings
  const [servingSizeG, setServingSizeG] = useState(() => {
    if (initial?.total_weight_g && initial?.servings > 0)
      return String(Math.round(initial.total_weight_g / initial.servings));
    return '';
  });
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const [saving, setSaving] = useState(false);

  // Auto-calculate batch weight and servings from ingredients + serving size
  const batchWeightG = useMemo(() =>
    ingredients.reduce((sum, i) => sum + (i.grams || 0), 0),
  [ingredients]);
  const servingSizeNum = parseFloat(servingSizeG) || 0;
  const calculatedServings = servingSizeNum > 0 && batchWeightG > 0
    ? Math.round((batchWeightG / servingSizeNum) * 10) / 10
    : 1;

  // Scan support for recipe photos
  const { scanState, recipeResult, scanError, handleFile } = useLabelScan();
  const fileRef = useRef<HTMLInputElement>(null);

  // When scan completes, populate ingredients
  useEffect(() => {
    if (recipeResult) {
      if (!name && recipeResult.name) setName(recipeResult.name);
      setIngredients(recipeResult.ingredients);
    }
  }, [recipeResult]);

  // Manual add ingredient
  const [newIngName, setNewIngName] = useState('');
  const [newIngGrams, setNewIngGrams] = useState('');

  const addIngredient = () => {
    if (!newIngName.trim()) return;
    setIngredients(prev => [...prev, {
      name: newIngName.trim(),
      grams: parseFloat(newIngGrams) || 0,
      calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    }]);
    setNewIngName('');
    setNewIngGrams('');
  };

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: keyof RecipeIngredient, value: string) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      if (field === 'name') return { ...ing, name: value };
      return { ...ing, [field]: parseFloat(value) || 0 };
    }));
  };

  const totals = sumIngredients(ingredients);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        total_weight_g: batchWeightG > 0 ? batchWeightG : null,
        servings: calculatedServings,
        calories_kcal: totals.calories_kcal,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        ingredients,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Photo scan button */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file, 'recipe');
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanState === 'scanning'}
        style={{
          width: '100%', padding: '12px', marginBottom: 16,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'var(--ochre)', font: '600 13px/1 Inter,sans-serif',
          opacity: scanState === 'scanning' ? 0.5 : 1,
        }}
      >
        {scanState === 'scanning' ? (
          <><Loader size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Analysing recipe...</>
        ) : (
          <><Camera size={16} /> Scan Recipe Photo</>
        )}
      </button>

      {scanState === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ember)', marginBottom: 12 }}>
          <AlertTriangle size={14} />
          <span style={{ font: '400 12px/1.4 Inter,sans-serif' }}>{scanError || 'Could not read recipe'}</span>
        </div>
      )}

      {/* Recipe name */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Recipe Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Stir Fry" style={inputStyle} />
      </div>

      {/* Serving size */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Serving Size (g)</label>
        <input type="number" inputMode="decimal" value={servingSizeG}
          onChange={e => setServingSizeG(e.target.value)}
          placeholder="e.g. 30" style={inputStyle} />
        {batchWeightG > 0 && servingSizeNum > 0 && (
          <p style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginTop: 6 }}>
            Batch total: {batchWeightG}g → <strong style={{ color: 'var(--ochre)' }}>{calculatedServings} servings</strong>
          </p>
        )}
      </div>

      {/* Ingredients */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Ingredients</label>
        {ingredients.map((ing, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
            padding: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
          }}>
            <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
              style={{ ...inputStyle, flex: 2, padding: '6px 8px', font: '400 12px/1.2 Inter,sans-serif' }} />
            <input type="number" inputMode="decimal" value={ing.grams || ''} onChange={e => updateIngredient(i, 'grams', e.target.value)}
              placeholder="g" style={{ ...inputStyle, width: 50, flex: 0, padding: '6px 8px', font: '600 11px/1 "JetBrains Mono",monospace', textAlign: 'right' as const }} />
            <span style={{ font: '600 10px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 70 }}>
              {ing.calories_kcal}cal P{Math.round(ing.protein_g)}
            </span>
            <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.5 }}>
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Add ingredient row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={newIngName} onChange={e => setNewIngName(e.target.value)}
            placeholder="Ingredient name" onKeyDown={e => e.key === 'Enter' && addIngredient()}
            style={{ ...inputStyle, flex: 2, padding: '8px' }} />
          <input type="number" inputMode="decimal" value={newIngGrams} onChange={e => setNewIngGrams(e.target.value)}
            placeholder="g" onKeyDown={e => e.key === 'Enter' && addIngredient()}
            style={{ ...inputStyle, width: 60, flex: 0, padding: '8px', textAlign: 'right' as const }} />
          <button onClick={addIngredient} style={{
            background: 'var(--ochre)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--bg-base)', padding: '8px', cursor: 'pointer', display: 'flex',
          }}>
            <Plus size={16} />
          </button>
        </div>
        <p style={{ font: '400 11px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginTop: 6 }}>
          Macros for manually added ingredients will be estimated when you scan or can be edited inline.
        </p>
      </div>

      {/* Totals */}
      {ingredients.length > 0 && (
        <div style={{
          padding: '12px', marginBottom: 16,
          background: 'rgba(200,150,62,0.08)', borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(200,150,62,0.2)',
        }}>
          <span style={{ ...labelStyle, color: 'var(--ochre)' }}>Recipe Total</span>
          <div style={{ font: '700 14px/1 "JetBrains Mono",monospace', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {totals.calories_kcal} kcal · P{totals.protein_g} C{totals.carbs_g} F{totals.fat_g}
          </div>
          {calculatedServings > 1 && (
            <div style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)', marginTop: 4 }}>
              Per serving ({servingSizeNum}g): {Math.round(totals.calories_kcal / calculatedServings)} kcal ·
              P{(totals.protein_g / calculatedServings).toFixed(0)}
              C{(totals.carbs_g / calculatedServings).toFixed(0)}
              F{(totals.fat_g / calculatedServings).toFixed(0)}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!name.trim() || saving}
        style={{
          width: '100%', padding: '14px',
          background: 'var(--ochre)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'var(--bg-base)',
          font: '700 14px/1 Inter,sans-serif', cursor: 'pointer',
          opacity: (!name.trim() || saving) ? 0.4 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {saving && <Loader size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
        {saving ? 'Saving...' : (initial ? 'Update Recipe' : 'Save Recipe')}
      </button>
    </>
  );
}

// ── Recipe Use (select portion → stage) ───────────────────────────────────
function RecipeUse({ recipe, onAdd }: {
  recipe: Recipe;
  onAdd: (item: ParsedItem) => void;
}) {
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<'servings' | 'grams'>('servings');

  const scaled = useMemo(() => {
    const num = parseFloat(amount) || 0;
    if (num <= 0) return { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    return recipePortionMacros(recipe, unit, num);
  }, [recipe, amount, unit]);

  return (
    <>
      {/* Recipe info */}
      <div style={{
        padding: '12px', marginBottom: 16,
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
      }}>
        <div style={{ font: '600 11px/1 "JetBrains Mono",monospace', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Total: {recipe.calories_kcal} kcal · P{Math.round(recipe.protein_g)} C{Math.round(recipe.carbs_g)} F{Math.round(recipe.fat_g)}
        </div>
        <div style={{ font: '400 12px/1.4 Inter,sans-serif', color: 'var(--text-muted)' }}>
          {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
          {recipe.total_weight_g ? ` · ${recipe.total_weight_g}g total` : ''}
          {recipe.ingredients.length > 0 ? ` · ${recipe.ingredients.length} ingredients` : ''}
        </div>
      </div>

      {/* Amount input */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>How much?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" inputMode="decimal" value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              flex: 1, padding: '12px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              font: '600 18px/1 "JetBrains Mono",monospace', outline: 'none',
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
                onClick={() => { setUnit(u); setAmount(u === 'servings' ? '1' : String(recipe.total_weight_g ? Math.round(recipe.total_weight_g / recipe.servings) : 100)); }}
                disabled={u === 'grams' && !recipe.total_weight_g}
                style={{
                  padding: '8px 14px', border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  background: unit === u ? 'var(--bg-card)' : 'transparent',
                  color: unit === u ? 'var(--text-primary)' : 'var(--text-muted)',
                  font: '600 12px/1 Inter,sans-serif', cursor: 'pointer',
                  opacity: (u === 'grams' && !recipe.total_weight_g) ? 0.3 : 1,
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scaled total */}
      <div style={{
        padding: '14px', marginBottom: 16,
        background: 'rgba(200,150,62,0.08)', borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(200,150,62,0.2)',
      }}>
        <span style={{ ...labelStyle, color: 'var(--ochre)' }}>Your Portion</span>
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

      {/* Add button */}
      <button
        onClick={() => onAdd({
          name: recipe.name,
          calories_kcal: scaled.calories_kcal,
          protein_g: scaled.protein_g,
          carbs_g: scaled.carbs_g,
          fat_g: scaled.fat_g,
        })}
        disabled={(parseFloat(amount) || 0) <= 0}
        style={{
          width: '100%', padding: '14px',
          background: 'var(--ochre)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'var(--bg-base)',
          font: '700 14px/1 Inter,sans-serif', cursor: 'pointer',
          opacity: (parseFloat(amount) || 0) <= 0 ? 0.4 : 1,
        }}
      >
        Add to staged →
      </button>
    </>
  );
}
