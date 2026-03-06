import { useState } from 'react';
import FoodCard from './FoodCard';
import StrengthCard from './StrengthCard';
import SaunaCard from './SaunaCard';
import HabitsCard from './HabitsCard';

type CardKey = 'food' | 'strength' | 'sauna' | 'habits' | null;

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
      <FoodCard open={openCard === 'food'} onToggle={() => toggle('food')} />
      <StrengthCard open={openCard === 'strength'} onToggle={() => toggle('strength')} />
      <SaunaCard open={openCard === 'sauna'} onToggle={() => toggle('sauna')} />
      <HabitsCard open={openCard === 'habits'} onToggle={() => toggle('habits')} />
    </div>
  );
}
