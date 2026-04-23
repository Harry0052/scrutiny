from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


class VoteDirection(str, Enum):
    SUPPORT = "support"
    OPPOSE = "oppose"
    NEUTRAL = "neutral"


class Classification(str, Enum):
    ALIGNED = "aligned"
    CONTRADICTED = "contradicted"
    UNCLEAR = "unclear"


@dataclass
class StatementRecord:
    statement_id: str
    politician_id: str
    text: str
    issue_tags: List[str]
    stated_direction: VoteDirection
    made_at: datetime


@dataclass
class BillRecord:
    bill_id: str
    bill_code: str
    title: str
    issue_tags: List[str]


@dataclass
class VoteRecord:
    vote_id: str
    politician_id: str
    bill_id: str
    direction: VoteDirection
    voted_at: datetime


@dataclass
class AnalysisOutput:
    statement_id: str
    bill_id: str
    classification: Classification
    confidence_score: float
    rationale: str
    evidence: dict
    verification_state: str = "UNVERIFIED"
    uncertainty_notes: List[str] = field(default_factory=list)


@dataclass
class HonestyScoreOutput:
    consistent_actions: int
    total_comparable_statements: int
    honesty_score: float


@dataclass
class ConstituentIndicator:
    district_id: str
    issue_tag: str
    indicator_name: str
    normalized_need_score: float


@dataclass
class ConstituentImpactOutput:
    bill_id: str
    vote_id: str
    issue_tag: str
    impact_alignment: str
    impact_score: float
    confidence_score: float
    rationale: str


@dataclass
class AnalysisBundle:
    statement_vote_results: List[AnalysisOutput] = field(default_factory=list)
    honesty_score: Optional[HonestyScoreOutput] = None
    constituent_impacts: List[ConstituentImpactOutput] = field(default_factory=list)
