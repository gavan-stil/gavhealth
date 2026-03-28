import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { Recipe, RecipeIngredient } from '@/types/food';

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Recipe[]>('/api/recipes');
      setRecipes(data);
    } catch {
      // silent — recipes are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const createRecipe = useCallback(async (recipe: {
    name: string;
    total_weight_g: number | null;
    servings: number;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    ingredients: RecipeIngredient[];
  }): Promise<Recipe> => {
    const created = await apiFetch<Recipe>('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
    setRecipes(prev => [created, ...prev]);
    return created;
  }, []);

  const updateRecipe = useCallback(async (id: number, updates: Partial<{
    name: string;
    total_weight_g: number | null;
    servings: number;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    ingredients: RecipeIngredient[];
  }>): Promise<Recipe> => {
    const updated = await apiFetch<Recipe>(`/api/recipes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setRecipes(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  const deleteRecipe = useCallback(async (id: number) => {
    await apiFetch(`/api/recipes/${id}`, { method: 'DELETE' });
    setRecipes(prev => prev.filter(r => r.id !== id));
  }, []);

  return { recipes, loading, createRecipe, updateRecipe, deleteRecipe, refetch: fetchRecipes };
}
