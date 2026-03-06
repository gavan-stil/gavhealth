"""Shared Pydantic schemas."""

from datetime import date
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    total: int
    limit: int
    offset: int


class DateRangeParams(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    limit: int = 50
    offset: int = 0


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
