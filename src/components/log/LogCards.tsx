import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FoodNutritionCard from './FoodNutritionCard';
import StrengthCard from './StrengthCard';
import SaunaCard from './SaunaCard';
import HabitsCard from './HabitsCard';
import WaterCard from './WaterCard';
import MoodEnergyCard from './MoodEnergyCard';

type CardKey = 'food' | 'strength' | 'sauna' | 'habits' | 'water' | 'mood' | null;

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in Brisbane local time
}

function stepDate(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
}

function formatDateLabel(date: string): string {
  const today = todayLocal();
  if (date === today) return 'Today';
  const yesterday = stepDate(today, -1);
  if (date === yesterday) return 'Yesterday';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function LogCards() {
  const [openCard, setOpenCard] = useState<CardKey>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal);

  const toggle = (key: CardKey) => {
    setOpenCard(prev => prev === key ? null : key);
  };

  const isToday = selectedDate === todayLocal();

  return (
    <div className="goe-card-stack" style={{
      display: 'flex', flexDirection: 'column',
      gap: 'var(--space-md)',
      padding: 'var(--space-lg)',
    }}>
      {/* Date stepper */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-sm)',
      }}>
        <button
          onClick={() => setSelectedDate(d => stepDate(d, -1))}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <span className="label-text" style={{ color: 'var(--text-secondary)', minWidth: 100, textAlign: 'center' }}>
          {formatDateLabel(selectedDate)}
        </span>

        <button
          onClick={() => setSelectedDate(d => stepDate(d, 1))}
          disabled={isToday}
          style={{
            background: 'none',
            border: 'none',
            color: isToday ? 'var(--border-default)' : 'var(--text-muted)',
            cursor: isToday ? 'default' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <FoodNutritionCard open={openCard === 'food'} onToggle={() => toggle('food')} date={selectedDate} />
      <WaterCard open={openCard === 'water'} onToggle={() => toggle('water')} date={selectedDate} />
      <MoodEnergyCard open={openCard === 'mood'} onToggle={() => toggle('mood')} date={selectedDate} />
      <StrengthCard open={openCard === 'strength'} onToggle={() => toggle('strength')} />
      <SaunaCard open={openCard === 'sauna'} onToggle={() => toggle('sauna')} />
      <HabitsCard open={openCard === 'habits'} onToggle={() => toggle('habits')} />
    </div>
  );
}
