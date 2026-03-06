-- Seed common exercises
-- Run once after deploy: psql $DATABASE_URL -f seed_exercises.sql

INSERT INTO exercises (name, category, uses_bodyweight, notes) VALUES
  -- Upper Push
  ('Bench Press', 'upper_push', false, 'Barbell flat bench'),
  ('Incline Bench Press', 'upper_push', false, 'Barbell incline'),
  ('Dumbbell Press', 'upper_push', false, 'Flat dumbbell press'),
  ('Overhead Press', 'upper_push', false, 'Barbell strict press'),
  ('Push-Up', 'upper_push', true, 'Bodyweight push-up'),
  ('Dip', 'upper_push', true, 'Parallel bar dip'),
  ('Lateral Raise', 'upper_push', false, 'Dumbbell lateral raise'),

  -- Upper Pull
  ('Pull-Up', 'upper_pull', true, 'Strict pull-up / chin-up'),
  ('Chin-Up', 'upper_pull', true, 'Supinated grip'),
  ('Barbell Row', 'upper_pull', false, 'Bent-over row'),
  ('Dumbbell Row', 'upper_pull', false, 'Single-arm dumbbell row'),
  ('Cable Row', 'upper_pull', false, 'Seated cable row'),
  ('Lat Pulldown', 'upper_pull', false, 'Cable lat pulldown'),
  ('Face Pull', 'upper_pull', false, 'Cable face pull'),
  ('Bicep Curl', 'upper_pull', false, 'Barbell or dumbbell curl'),

  -- Lower
  ('Squat', 'lower', false, 'Barbell back squat'),
  ('Front Squat', 'lower', false, 'Barbell front squat'),
  ('Romanian Deadlift', 'lower', false, 'RDL'),
  ('Deadlift', 'lower', false, 'Conventional deadlift'),
  ('Sumo Deadlift', 'lower', false, 'Sumo stance deadlift'),
  ('Leg Press', 'lower', false, 'Machine leg press'),
  ('Leg Curl', 'lower', false, 'Machine hamstring curl'),
  ('Leg Extension', 'lower', false, 'Machine quad extension'),
  ('Lunge', 'lower', false, 'Dumbbell or barbell lunge'),
  ('Bulgarian Split Squat', 'lower', true, 'Rear-foot elevated split squat'),
  ('Hip Thrust', 'lower', false, 'Barbell hip thrust'),
  ('Calf Raise', 'lower', false, 'Standing calf raise'),
  ('Step-Up', 'lower', false, 'Box step-up'),

  -- Core
  ('Plank', 'core', true, 'Isometric plank hold'),
  ('Ab Rollout', 'core', true, 'Ab wheel rollout'),
  ('Hanging Leg Raise', 'core', true, 'Hanging from bar'),
  ('Cable Crunch', 'core', false, 'Kneeling cable crunch'),
  ('Russian Twist', 'core', true, 'Oblique rotation'),
  ('Dead Bug', 'core', true, 'Spinal stability'),
  ('Pallof Press', 'core', false, 'Anti-rotation press'),

  -- Carry
  ('Farmers Carry', 'carry', false, 'Bilateral loaded carry'),
  ('Single-Arm Carry', 'carry', false, 'Unilateral suitcase carry'),
  ('Zercher Carry', 'carry', false, 'Barbell Zercher hold carry'),

  -- Full Body
  ('Clean', 'full_body', false, 'Barbell power clean'),
  ('Clean and Press', 'full_body', false, 'Clean to overhead press'),
  ('Snatch', 'full_body', false, 'Barbell snatch'),
  ('Thruster', 'full_body', false, 'Front squat to press'),
  ('Kettlebell Swing', 'full_body', false, 'Hip hinge swing'),
  ('Turkish Get-Up', 'full_body', false, 'TGU'),
  ('Burpee', 'full_body', true, 'Bodyweight burpee'),

  -- Other
  ('Tricep Pushdown', 'other', false, 'Cable tricep pushdown'),
  ('Skull Crusher', 'other', false, 'EZ bar skull crusher'),
  ('Wrist Curl', 'other', false, 'Forearm wrist curl')

ON CONFLICT (name) DO NOTHING;
