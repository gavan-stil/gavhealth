import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import type { LabelScanResult, RecipeScanResult, Macros } from '@/types/food';

export type ScanState = 'idle' | 'captured' | 'scanning' | 'done' | 'error';
export type ScanMode = 'label' | 'recipe';

/** Resize image to max 1200px and return JPEG base64 data URI. */
function resizeAndEncode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Scale macros by gram amount relative to per-100g base. */
export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = grams / 100;
  return {
    calories_kcal: Math.round(per100g.calories_kcal * factor),
    protein_g: +(per100g.protein_g * factor).toFixed(1),
    carbs_g: +(per100g.carbs_g * factor).toFixed(1),
    fat_g: +(per100g.fat_g * factor).toFixed(1),
  };
}

/** Scale recipe macros by portion (servings or grams). */
export function recipePortionMacros(
  recipe: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; servings: number; total_weight_g: number | null },
  mode: 'servings' | 'grams',
  amount: number,
): Macros {
  // Safety: grams mode requires total_weight_g; if missing, return zeros to prevent absurd scaling
  if (mode === 'grams' && !recipe.total_weight_g) {
    return { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  const divisor = mode === 'servings' ? (recipe.servings || 1) : recipe.total_weight_g!;
  const factor = amount / divisor;
  return {
    calories_kcal: Math.round(recipe.calories_kcal * factor),
    protein_g: +(recipe.protein_g * factor).toFixed(1),
    carbs_g: +(recipe.carbs_g * factor).toFixed(1),
    fat_g: +(recipe.fat_g * factor).toFixed(1),
  };
}

export function useLabelScan() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanMode, setScanMode] = useState<ScanMode>('label');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [labelResult, setLabelResult] = useState<LabelScanResult | null>(null);
  const [recipeResult, setRecipeResult] = useState<RecipeScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleFile = useCallback(async (file: File, mode: ScanMode = 'label') => {
    setScanMode(mode);
    setScanError(null);
    setLabelResult(null);
    setRecipeResult(null);
    try {
      const dataUrl = await resizeAndEncode(file);
      setImageDataUrl(dataUrl);
      setScanState('captured');

      // Auto-scan immediately
      setScanState('scanning');
      abortRef.current = new AbortController();
      const result = await apiFetch<LabelScanResult | RecipeScanResult>('/api/log/food/scan', {
        method: 'POST',
        body: JSON.stringify({ image_base64: dataUrl, mode }),
        signal: abortRef.current.signal,
      });
      if (mode === 'label') {
        setLabelResult(result as LabelScanResult);
      } else {
        setRecipeResult(result as RecipeScanResult);
      }
      setScanState('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setScanError(err instanceof Error ? err.message : 'Scan failed');
      setScanState('error');
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setScanState('idle');
    setImageDataUrl(null);
    setLabelResult(null);
    setRecipeResult(null);
    setScanError(null);
  }, []);

  return {
    scanState,
    scanMode,
    imageDataUrl,
    labelResult,
    recipeResult,
    scanError,
    handleFile,
    reset,
  };
}
