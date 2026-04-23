from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Sequence

from .models import (
    AnalysisOutput,
    BillRecord,
    Classification,
    HonestyScoreOutput,
    StatementRecord,
    VoteDirection,
    VoteRecord,
)

MIN_TAG_OVERLAP_FOR_COMPARISON = 1


def _tag_overlap(statement_tags: Iterable[str], bill_tags: Iterable[str]) -> int:
    statement_set = {tag.lower().strip() for tag in statement_tags}
    bill_set = {tag.lower().strip() for tag in bill_tags}
    return len(statement_set.intersection(bill_set))


def classify_statement_against_vote(
    statement: StatementRecord,
    bill: BillRecord,
    vote: VoteRecord,
) -> AnalysisOutput:
    overlap = _tag_overlap(statement.issue_tags, bill.issue_tags)

    if overlap < MIN_TAG_OVERLAP_FOR_COMPARISON:
        return AnalysisOutput(
            statement_id=statement.statement_id,
            bill_id=bill.bill_id,
            classification=Classification.UNCLEAR,
            confidence_score=0.35,
            rationale="Insufficient issue-tag overlap to confidently compare statement and bill.",
            evidence={
                "statement_text": statement.text,
                "vote_position": vote.direction.value,
                "issue_tag_overlap": [],
            },
            verification_state="NEEDS_VERIFICATION",
            uncertainty_notes=["Issue-tag overlap below comparison threshold."],
        )

    if statement.stated_direction == VoteDirection.NEUTRAL or vote.direction == VoteDirection.NEUTRAL:
        return AnalysisOutput(
            statement_id=statement.statement_id,
            bill_id=bill.bill_id,
            classification=Classification.UNCLEAR,
            confidence_score=0.5,
            rationale="Statement or vote direction is neutral; comparison remains uncertain.",
            evidence={
                "statement_text": statement.text,
                "vote_position": vote.direction.value,
                "issue_tag_overlap": list({tag for tag in statement.issue_tags if tag in bill.issue_tags}),
            },
            verification_state="NEEDS_VERIFICATION",
            uncertainty_notes=["Neutral direction limits confidence of interpretation."],
        )

    if statement.stated_direction == vote.direction:
        confidence = min(0.95, 0.7 + (0.1 * overlap))
        return AnalysisOutput(
            statement_id=statement.statement_id,
            bill_id=bill.bill_id,
            classification=Classification.ALIGNED,
            confidence_score=confidence,
            rationale="Statement direction matches vote direction on overlapping issue area.",
            evidence={
                "statement_text": statement.text,
                "vote_position": vote.direction.value,
                "issue_tag_overlap": list({tag for tag in statement.issue_tags if tag in bill.issue_tags}),
            },
            verification_state="UNVERIFIED",
        )

    confidence = min(0.95, 0.72 + (0.1 * overlap))
    return AnalysisOutput(
        statement_id=statement.statement_id,
        bill_id=bill.bill_id,
        classification=Classification.CONTRADICTED,
        confidence_score=confidence,
        rationale="Statement direction conflicts with vote direction on overlapping issue area.",
        evidence={
            "statement_text": statement.text,
            "vote_position": vote.direction.value,
            "issue_tag_overlap": list({tag for tag in statement.issue_tags if tag in bill.issue_tags}),
        },
        verification_state="NEEDS_VERIFICATION" if confidence < 0.9 else "UNVERIFIED",
        uncertainty_notes=["Potential policy-scope ambiguity; verify source context."],
    )


def analyze_statement_vote_alignment(
    statements: Sequence[StatementRecord],
    bills: Sequence[BillRecord],
    votes: Sequence[VoteRecord],
) -> List[AnalysisOutput]:
    bills_by_id: Dict[str, BillRecord] = {bill.bill_id: bill for bill in bills}
    votes_by_bill_id: Dict[str, List[VoteRecord]] = defaultdict(list)

    for vote in votes:
        votes_by_bill_id[vote.bill_id].append(vote)

    outputs: List[AnalysisOutput] = []
    for statement in statements:
        candidate_votes: List[VoteRecord] = []

        for bill in bills:
            if _tag_overlap(statement.issue_tags, bill.issue_tags) >= MIN_TAG_OVERLAP_FOR_COMPARISON:
                candidate_votes.extend(votes_by_bill_id.get(bill.bill_id, []))

        if not candidate_votes:
            outputs.append(
                AnalysisOutput(
                    statement_id=statement.statement_id,
                    bill_id="",
                    classification=Classification.UNCLEAR,
                    confidence_score=0.3,
                    rationale="No comparable vote linked through overlapping issue tags.",
                    evidence={
                        "statement_text": statement.text,
                        "vote_position": None,
                        "issue_tag_overlap": [],
                    },
                    verification_state="NEEDS_VERIFICATION",
                    uncertainty_notes=["No linked vote evidence found for statement tags."],
                )
            )
            continue

        candidate_votes.sort(key=lambda record: record.voted_at, reverse=True)
        selected_vote = candidate_votes[0]
        bill = bills_by_id[selected_vote.bill_id]
        outputs.append(classify_statement_against_vote(statement=statement, bill=bill, vote=selected_vote))

    return outputs


def calculate_honesty_score(results: Sequence[AnalysisOutput]) -> HonestyScoreOutput:
    comparable = [result for result in results if result.bill_id]
    total_comparable = len(comparable)
    consistent_actions = len(
        [result for result in comparable if result.classification == Classification.ALIGNED]
    )

    if total_comparable == 0:
        return HonestyScoreOutput(
            consistent_actions=0,
            total_comparable_statements=0,
            honesty_score=0.0,
        )

    score = (consistent_actions / total_comparable) * 100
    return HonestyScoreOutput(
        consistent_actions=consistent_actions,
        total_comparable_statements=total_comparable,
        honesty_score=round(score, 2),
    )


def serialize_result(result: AnalysisOutput) -> Dict[str, object]:
    return {
        "statement_id": result.statement_id,
        "bill_id": result.bill_id,
        "classification": result.classification.value,
        "confidence_score": round(result.confidence_score, 2),
        "rationale": result.rationale,
        "evidence": result.evidence,
        "verification_state": result.verification_state,
        "uncertainty_notes": result.uncertainty_notes,
    }
