"""Claude API integration for food parsing, strength parsing, and readiness."""

import json
import logging
from datetime import date, datetime

from anthropic import AsyncAnthropic

from app.config import settings
from app.services.readiness import compute_readiness

logger = logging.getLogger(__name__)

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


FOOD_SYSTEM_PROMPT = """You are a nutrition estimation engine. Given a free-text food description,
return a JSON object with these fields:
- items: array of {name, protein_g, carbs_g, fat_g, calories_kcal}
- totals: {protein_g, carbs_g, fat_g, calories_kcal}
- confidence: "high" | "medium" | "low"

Use Australian serving sizes. Be conservative with estimates.
For alcoholic drinks (wine, beer, spirits, etc.), calculate calories from ethanol content (~7 kcal/g) plus any carbs. Do not leave alcohol calories as zero.
All calories_kcal values must be whole integers (no decimals).
Return ONLY valid JSON, no markdown fences, no commentary."""

STRENGTH_SYSTEM_PROMPT = """You are a strength training log parser. Given a free-text workout description,
return a JSON object with:
- session_label: string or null (e.g. "Upper Push", "Pull Day")
- sets: array of {exercise_name, set_number, reps, weight_kg, is_bodyweight, rpe}

Normalise exercise names to standard forms (e.g. "bench" -> "Bench Press", "pullups" -> "Pull-up").
Weight should be in kg. If lbs mentioned, convert. If bodyweight, set is_bodyweight=true and weight_kg=null.
Return ONLY valid JSON, no markdown fences, no commentary."""


async def parse_food(description: str, meal_label: str, log_date: date) -> dict:
    """Use Claude to parse a food description into macros."""
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    client = _get_client()
    prompt = f"Meal: {meal_label}\nDate: {log_date}\nFood: {description}"

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=FOOD_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    parsed = json.loads(text)
    totals = parsed.get("totals", {})

    return {
        "description_raw": description,
        "meal_label": meal_label,
        "log_date": log_date,
        "protein_g": totals.get("protein_g", 0),
        "carbs_g": totals.get("carbs_g", 0),
        "fat_g": totals.get("fat_g", 0),
        "calories_kcal": totals.get("calories_kcal", 0),
        "confidence": parsed.get("confidence", "medium"),
        "items": parsed.get("items"),
    }


async def parse_strength(
    description: str,
    session_label: str | None = None,
    session_datetime: datetime | None = None,
) -> dict:
    """Use Claude to parse a strength session description into structured sets."""
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    client = _get_client()
    prompt = f"Workout description:\n{description}"
    if session_label:
        prompt += f"\nSession label: {session_label}"

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=STRENGTH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    parsed = json.loads(text)

    return {
        "session_label": parsed.get("session_label") or session_label,
        "session_datetime": session_datetime or datetime.utcnow(),
        "sets": parsed.get("sets", []),
    }


async def get_readiness(db, target_date: date) -> dict:
    """Get readiness score — deterministic fallback (Claude enhancement deferred)."""
    return await compute_readiness(db, target_date)
