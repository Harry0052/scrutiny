from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List
from pydantic import BaseModel, Field


@dataclass
class FinancialDisclosureRecord:
    assets: List[Dict[str, object]] = field(default_factory=list)
    liabilities: List[Dict[str, object]] = field(default_factory=list)
    income_sources: List[Dict[str, object]] = field(default_factory=list)
    transactions: List[Dict[str, object]] = field(default_factory=list)
    extraction_status: str = "pending"
    confidence_score: float = 0.0
    parser_version: str = "pdf-parser-0.2.0"
    retrieval_date: str = ""
    raw_text_excerpt: str = ""
    uncertainty_notes: List[str] = field(default_factory=list)


class FinancialDisclosurePayload(BaseModel):
    assets: List[Dict[str, object]] = Field(default_factory=list)
    liabilities: List[Dict[str, object]] = Field(default_factory=list)
    income_sources: List[Dict[str, object]] = Field(default_factory=list)
    transactions: List[Dict[str, object]] = Field(default_factory=list)
    extraction_status: str
    confidence_score: float
    parser_version: str
    retrieval_date: str
    raw_text_excerpt: str
    uncertainty_notes: List[str] = Field(default_factory=list)
