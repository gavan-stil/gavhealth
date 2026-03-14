"""Pydantic schemas for all health domains."""

from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Weight
# ---------------------------------------------------------------------------
class WeightCreate(BaseModel):
    recorded_at: datetime
    weight_kg: float
    fat_mass_kg: float | None = None
    muscle_mass_kg: float | None = None
    bone_mass_kg: float | None = None
    hydration_kg: float | None = None
    bmi: float | None = None
    source: str = "manual"


class WeightResponse(BaseModel):
    id: int
    recorded_at: datetime
    weight_kg: float
    fat_mass_kg: float | None = None
    muscle_mass_kg: float | None = None
    bone_mass_kg: float | None = None
    hydration_kg: float | None = None
    bmi: float | None = None
    fat_ratio_pct: float | None = None
    fat_free_mass_kg: float | None = None
    source: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Sleep
# ---------------------------------------------------------------------------
class SleepCreate(BaseModel):
    sleep_date: date
    bed_time: datetime | None = None
    wake_time: datetime | None = None
    total_sleep_hrs: float | None = None
    deep_sleep_hrs: float | None = None
    light_sleep_hrs: float | None = None
    rem_sleep_hrs: float | None = None
    awake_hrs: float | None = None
    sleep_hr_avg: float | None = None
    sleep_hr_min: float | None = None
    sleep_score: float | None = None
    source: str = "manual"


class SleepResponse(BaseModel):
    id: int
    sleep_date: date
    bed_time: datetime | None = None
    wake_time: datetime | None = None
    total_sleep_hrs: float | None = None
    deep_sleep_hrs: float | None = None
    light_sleep_hrs: float | None = None
    rem_sleep_hrs: float | None = None
    awake_hrs: float | None = None
    sleep_hr_avg: float | None = None
    sleep_hr_min: float | None = None
    sleep_hr_max: float | None = None
    sleep_score: float | None = None
    sleep_efficiency_pct: float | None = None
    spo2_avg: float | None = None
    respiratory_rate: float | None = None
    source: str

    model_config = {"from_attributes": True}


class SleepStagesResponse(BaseModel):
    sleep_date: date
    bed_time: datetime | None = None
    wake_time: datetime | None = None
    total_sleep_hrs: float | None = None
    sleep_score: float | None = None
    sleep_hr_avg: float | None = None
    stages: list | None = None  # [{startdate, enddate, state}]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------
class ActivityCreate(BaseModel):
    activity_date: date
    activity_type: str
    duration_mins: float | None = None
    distance_km: float | None = None
    avg_pace_secs: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    calories_burned: int | None = None
    elevation_m: float | None = None
    source: str = "manual"
    external_id: str | None = None
    notes: str | None = None


class ActivityResponse(BaseModel):
    id: int
    activity_date: date
    activity_type: str
    started_at: datetime | None = None
    duration_mins: float | None = None
    distance_km: float | None = None
    avg_pace_secs: float | None = None
    avg_hr: int | None = None
    min_hr: int | None = None
    max_hr: int | None = None
    calories_burned: int | None = None
    elevation_m: float | None = None
    steps: int | None = None
    spo2_avg: float | None = None
    pause_duration_mins: float | None = None
    pool_laps: int | None = None
    strokes: int | None = None
    soft_mins: float | None = None
    moderate_mins: float | None = None
    intense_mins: float | None = None
    source: str
    external_id: str | None = None
    notes: str | None = None
    workout_split: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# RHR
# ---------------------------------------------------------------------------
class RhrCreate(BaseModel):
    log_date: date
    rhr_bpm: int
    source: str = "manual"


class RhrResponse(BaseModel):
    id: int
    log_date: date
    rhr_bpm: int
    source: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Sauna
# ---------------------------------------------------------------------------
class SaunaCreate(BaseModel):
    session_datetime: datetime
    session_type: str = "traditional"
    duration_mins: int
    temperature_c: int | None = None
    did_breathing: bool = False
    did_devotions: bool = False
    notes: str | None = None
    withings_activity_id: int | None = None
    source: str = "manual"


class SaunaResponse(BaseModel):
    id: int
    session_datetime: datetime
    session_type: str
    duration_mins: int
    temperature_c: int | None = None
    did_breathing: bool
    did_devotions: bool
    notes: str | None = None
    withings_activity_id: int | None = None
    source: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Daily Habits
# ---------------------------------------------------------------------------
class HabitCreate(BaseModel):
    habit_date: date
    did_breathing: bool = False
    did_devotions: bool = False
    notes: str | None = None


class HabitResponse(BaseModel):
    id: int
    habit_date: date
    did_breathing: bool
    did_devotions: bool
    notes: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Food Logging (Claude parse flow)
# ---------------------------------------------------------------------------
class FoodParseRequest(BaseModel):
    description: str
    meal_label: str = "lunch"
    log_date: date | None = None


class FoodParseResponse(BaseModel):
    """Returned by /api/log/food — Claude's parsed interpretation for user review."""
    description_raw: str
    meal_label: str
    log_date: date
    protein_g: float
    carbs_g: float
    fat_g: float
    calories_kcal: int
    confidence: str
    items: list[dict] | None = None  # breakdown of individual items


class FoodConfirmRequest(BaseModel):
    """Sent by user to confirm and save Claude's parse."""
    log_date: date
    meal_label: str
    description_raw: str
    protein_g: float
    carbs_g: float
    fat_g: float
    calories_kcal: int
    confidence: str = "medium"
    notes: str | None = None


class FoodResponse(BaseModel):
    id: int
    log_date: date
    meal_time: datetime | None = None
    meal_label: str
    description_raw: str
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    calories_kcal: int | None = None
    confidence: str
    source: str
    notes: str | None = None

    model_config = {"from_attributes": True}


class FoodWeeklyResponse(BaseModel):
    week_start: date
    avg_calories: float
    avg_protein_g: float
    avg_carbs_g: float
    avg_fat_g: float
    total_meals: int


# ---------------------------------------------------------------------------
# Strength (Claude parse flow)
# ---------------------------------------------------------------------------
class StrengthParseRequest(BaseModel):
    description: str
    session_label: str | None = None
    session_datetime: datetime | None = None


class StrengthSetParsed(BaseModel):
    exercise_name: str
    set_number: int
    reps: int
    weight_kg: float | None = None
    is_bodyweight: bool = False
    rpe: float | None = None


class StrengthParseResponse(BaseModel):
    session_label: str | None = None
    session_datetime: datetime
    sets: list[StrengthSetParsed]


class StrengthConfirmRequest(BaseModel):
    session_datetime: datetime
    session_label: str | None = None
    notes: str | None = None
    sets: list[StrengthSetParsed]


class StrengthSessionResponse(BaseModel):
    id: int
    session_datetime: datetime
    session_label: str | None = None
    notes: str | None = None
    source: str
    sets: list[dict] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# DEXA
# ---------------------------------------------------------------------------
class DexaCreate(BaseModel):
    scan_date: date
    body_fat_pct: float | None = None
    lean_mass_kg: float | None = None
    fat_mass_kg: float | None = None
    bmc_g: float | None = None
    total_bmd: float | None = None
    lumbar_bmd: float | None = None
    vat_area_cm2: float | None = None
    rmr_kcal: int | None = None
    appendicular_lean_height2: float | None = None
    r_leg_fat_pct: float | None = None
    l_leg_fat_pct: float | None = None
    notes: str | None = None


class DexaResponse(BaseModel):
    id: int
    scan_date: date
    body_fat_pct: float | None = None
    lean_mass_kg: float | None = None
    fat_mass_kg: float | None = None
    bmc_g: float | None = None
    total_bmd: float | None = None
    lumbar_bmd: float | None = None
    vat_area_cm2: float | None = None
    rmr_kcal: int | None = None
    appendicular_lean_height2: float | None = None
    r_leg_fat_pct: float | None = None
    l_leg_fat_pct: float | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Intraday HR
# ---------------------------------------------------------------------------
class HrIntradayBucket(BaseModel):
    hour: int
    hr_avg: float | None = None
    hr_min: int | None = None
    hr_max: int | None = None
    readings_count: int | None = None
    steps_count: int | None = None

    model_config = {"from_attributes": True}


class HrIntradayResponse(BaseModel):
    log_date: date
    buckets: list[HrIntradayBucket]


# ---------------------------------------------------------------------------
# Daily Summary / Readiness
# ---------------------------------------------------------------------------
class DailySummaryResponse(BaseModel):
    summary_date: date
    readiness_score: float | None = None
    weight_kg: float | None = None
    total_sleep_hrs: float | None = None
    deep_sleep_hrs: float | None = None
    sleep_score: float | None = None
    rhr_bpm: int | None = None
    hrv_ms: float | None = None
    calories_kcal: int | None = None
    protein_g: float | None = None
    activity_count: int = 0
    training_load_mins: float | None = None
    strain_score: float | None = None

    model_config = {"from_attributes": True}


class ReadinessResponse(BaseModel):
    date: date
    readiness_score: float
    components: dict  # breakdown of score factors
    recommendation: str


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------
class StreakResponse(BaseModel):
    breathing_current: int = 0
    breathing_longest: int = 0
    devotions_current: int = 0
    devotions_longest: int = 0
    sauna_current: int = 0
    sauna_longest: int = 0
    training_current: int = 0
    training_longest: int = 0


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
class SettingsUpdate(BaseModel):
    height_cm: float | None = None
    date_of_birth: date | None = None
    calorie_target: int | None = None
    protein_target_g: int | None = None
    water_target_ml: int | None = None
    sleep_target_hours: float | None = None
    weight_goal_kg: float | None = None
    body_fat_goal_pct: float | None = None
    max_heart_rate: int | None = None
    timezone: str | None = None


class SettingsResponse(BaseModel):
    height_cm: float | None = None
    date_of_birth: date | None = None
    calorie_target: int | None = None
    protein_target_g: int | None = None
    water_target_ml: int | None = None
    sleep_target_hours: float | None = None
    weight_goal_kg: float | None = None
    body_fat_goal_pct: float | None = None
    max_heart_rate: int | None = None
    timezone: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------
class ExerciseResponse(BaseModel):
    id: int
    name: str
    category: str
    uses_bodyweight: bool
    notes: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Strength history / PRs
# ---------------------------------------------------------------------------
class StrengthSetHistoryRow(BaseModel):
    set_id: int
    session_id: int
    session_datetime: datetime
    session_label: str | None = None
    set_number: int
    reps: int
    weight_kg: float | None = None
    is_bodyweight: bool
    rpe: float | None = None


class StrengthPRResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    max_weight_kg: float | None = None
    best_date: date | None = None


# ---------------------------------------------------------------------------
# Weekly Summary
# ---------------------------------------------------------------------------
class WeeklySummaryResponse(BaseModel):
    week_start: date
    week_end: date
    avg_readiness: float | None = None
    avg_sleep_hrs: float | None = None
    avg_deep_sleep_hrs: float | None = None
    avg_rhr: float | None = None
    total_training_sessions: int = 0
    total_sauna_sessions: int = 0
    avg_calories: float | None = None
    avg_protein_g: float | None = None


# ---------------------------------------------------------------------------
# Health Goals
# ---------------------------------------------------------------------------
class GoalCreate(BaseModel):
    signal: str
    target_min: float | None = None
    target_max: float | None = None
    notes: str | None = None


class GoalResponse(BaseModel):
    id: int
    signal: str
    label: str
    unit: str
    group: str
    target_min: float | None = None
    target_max: float | None = None
    set_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


class GoalHistoryResponse(BaseModel):
    id: int
    target_min: float | None = None
    target_max: float | None = None
    set_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Momentum
# ---------------------------------------------------------------------------
class MomentumSignalResponse(BaseModel):
    signal: str
    label: str
    unit: str
    group: str       # "recovery" | "strain"
    target_min: float | None = None
    target_max: float | None = None
    baseline_28d: float | None = None
    today: float | None = None
    avg_7d: float | None = None
    trend_7d: str    # "improving" | "declining" | "stable"
    gap_pct: float | None = None
    status: str      # "on_track" | "improving" | "off_track"


class MomentumResponse(BaseModel):
    overall_trend: str   # "improving" | "declining" | "stable"
    signals_on_track: int
    signals_total: int
    signals: list[MomentumSignalResponse]


class MomentumDayResponse(BaseModel):
    date: date
    sleep_hrs: float | None = None
    rhr_bpm: float | None = None
    weight_kg: float | None = None
    calories_in: float | None = None
    protein_g: float | None = None
    water_ml: float | None = None
    training_load_mins: float | None = None


class MomentumSignalsResponse(BaseModel):
    baselines: dict[str, float | None]
    targets: dict[str, dict[str, float | None]]
    days: list[MomentumDayResponse]
