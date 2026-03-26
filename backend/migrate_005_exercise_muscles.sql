-- Migration 005: Add muscle_groups and exercise_muscles tables
-- Run this manually against Railway PostgreSQL if alembic doesn't auto-run.

BEGIN;

-- 1. Create muscle_groups table
CREATE TABLE IF NOT EXISTS muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    macro_group VARCHAR(10) NOT NULL
);

-- 2. Create exercise_muscles junction table
CREATE TABLE IF NOT EXISTS exercise_muscles (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(exercise_id, muscle_group_id)
);

-- 3. Drop the CHECK constraint on exercises.category
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS ck_exercise_category;

-- 4. Seed muscle_groups with the 7 existing categories
INSERT INTO muscle_groups (name, macro_group) VALUES
    ('chest', 'push'),
    ('back', 'pull'),
    ('shoulders', 'push'),
    ('arms', 'push'),
    ('legs', 'legs'),
    ('core', 'abs'),
    ('other', 'other')
ON CONFLICT (name) DO NOTHING;

-- 5. Migrate existing exercises: create exercise_muscles rows from exercises.category
INSERT INTO exercise_muscles (exercise_id, muscle_group_id, is_primary)
SELECT e.id, mg.id, true
FROM exercises e
JOIN muscle_groups mg ON mg.name = e.category
ON CONFLICT (exercise_id, muscle_group_id) DO NOTHING;

-- 6. Mark alembic migration as complete
INSERT INTO alembic_version (version_num) VALUES ('005')
ON CONFLICT DO NOTHING;

COMMIT;
