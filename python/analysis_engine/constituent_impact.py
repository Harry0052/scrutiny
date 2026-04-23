from __future__ import annotations

from typing import Dict, Iterable, List, Sequence

from .models import (
    BillRecord,
    ConstituentImpactOutput,
    ConstituentIndicator,
    VoteDirection,
    VoteRecord,
)


def _alignment_from_vote_and_need(vote_direction: VoteDirection, need_score: float) -> str:
    if vote_direction == VoteDirection.SUPPORT:
        if need_score >= 0.6:
            return "aligned"
        if need_score >= 0.4:
            return "partial"
        return "unclear"

    if vote_direction == VoteDirection.OPPOSE:
        if need_score >= 0.6:
            return "misaligned"
        if need_score >= 0.4:
            return "partial"
        return "unclear"

    return "unclear"


def estimate_constituent_impact(
    bills: Sequence[BillRecord],
    votes: Sequence[VoteRecord],
    indicators: Sequence[ConstituentIndicator],
) -> List[ConstituentImpactOutput]:
    bill_by_id: Dict[str, BillRecord] = {bill.bill_id: bill for bill in bills}
    indicators_by_issue: Dict[str, List[ConstituentIndicator]] = {}

    for indicator in indicators:
        key = indicator.issue_tag.lower().strip()
        indicators_by_issue.setdefault(key, []).append(indicator)

    outputs: List[ConstituentImpactOutput] = []

    for vote in votes:
        bill = bill_by_id.get(vote.bill_id)
        if not bill:
            continue

        for issue_tag in bill.issue_tags:
            issue_key = issue_tag.lower().strip()
            issue_indicators = indicators_by_issue.get(issue_key, [])
            if not issue_indicators:
                continue

            need_score = sum(item.normalized_need_score for item in issue_indicators) / len(issue_indicators)
            alignment = _alignment_from_vote_and_need(vote.direction, need_score)

            if alignment == "aligned":
                impact_score = min(0.98, 0.55 + (need_score * 0.45))
            elif alignment == "misaligned":
                impact_score = max(0.05, 0.45 - (need_score * 0.4))
            elif alignment == "partial":
                impact_score = 0.5
            else:
                impact_score = 0.45

            confidence = min(0.9, 0.55 + (len(issue_indicators) * 0.08))
            rationale = (
                f"Issue '{issue_key}' has average district need score {need_score:.2f}; "
                f"vote direction was '{vote.direction.value}'."
            )

            outputs.append(
                ConstituentImpactOutput(
                    bill_id=bill.bill_id,
                    vote_id=vote.vote_id,
                    issue_tag=issue_key,
                    impact_alignment=alignment,
                    impact_score=round(impact_score, 2),
                    confidence_score=round(confidence, 2),
                    rationale=rationale,
                )
            )

    return outputs
