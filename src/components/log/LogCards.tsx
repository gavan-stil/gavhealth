import { useState } from 'react';
import FoodNutritionCard from './FoodNutritionCard';
import StrengthCard from './StrengthCard';
import SaunaCard from './SaunaCard';
import HabitsCard from './HabitsCard';
import WaterCard from './WaterCard';
import MoodEnergyCard from './MoodEnergyCard';

type CardKey = 'food' | 'strength' | 'sauna' | 'habits' | 'water' | 'mood' | null;

export default function LogCards() {
  const [openCard, setOpenCard] = useState<CardKey>(null);

  const toggle = (key: CardKey) => {
    setOpenCard(prev => prev === key ? null : key);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 'var(--space-md)',
      padding: 'var(--space-lg)',
    }}>
      <FoodNutritionCard open={openCard === 'food'} onToggle={() => toggle('food')} />
      <WaterCard open={openCard === 'water'} onToggle={() => toggle('water')} />
      <MoodEnergyCard open={openCard === 'mood'} onToggle={() => toggle('mood')} />
      <StrengthCard open={openCard === 'strength'} onToggle={() => toggle('strength')} />
      <SaunaCard open={openCard === 'sauna'} onToggle={() => toggle('sauna')} />
      <HabitsCard open={openCard === 'habits'} onToggle={() => toggle('habits')} />
    </div>
  );
}
