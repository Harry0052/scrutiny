from __future__ import annotations

import json
from datetime import datetime

from analysis_engine import (
    BillRecord,
    ConstituentIndicator,
    StatementRecord,
    VoteDirection,
    VoteRecord,
    analyze_statement_vote_alignment,
    calculate_honesty_score,
    estimate_constituent_impact,
    serialize_result,
)


if __name__ == "__main__":
    statements = [
        StatementRecord(
            statement_id="stmt-1",
            politician_id="pol-1",
            text="I support stronger consumer data protections.",
            issue_tags=["privacy", "technology"],
            stated_direction=VoteDirection.SUPPORT,
            made_at=datetime(2025, 5, 2),
        ),
        StatementRecord(
            statement_id="stmt-2",
            politician_id="pol-1",
            text="Families need broader access to affordable healthcare coverage.",
            issue_tags=["healthcare", "cost_of_living"],
            stated_direction=VoteDirection.SUPPORT,
            made_at=datetime(2025, 4, 20),
        ),
    ]

    bills = [
        BillRecord(
            bill_id="bill-privacy",
            bill_code="S-887",
            title="Consumer Data Privacy and Transparency Act",
            issue_tags=["technology", "privacy"],
        ),
        BillRecord(
            bill_id="bill-health",
            bill_code="HR-4821",
            title="Affordable Coverage Expansion Act",
            issue_tags=["healthcare", "cost_of_living"],
        ),
    ]

    votes = [
        VoteRecord(
            vote_id="vote-1",
            politician_id="pol-1",
            bill_id="bill-privacy",
            direction=VoteDirection.SUPPORT,
            voted_at=datetime(2025, 7, 11),
        ),
        VoteRecord(
            vote_id="vote-2",
            politician_id="pol-1",
            bill_id="bill-health",
            direction=VoteDirection.OPPOSE,
            voted_at=datetime(2025, 6, 27),
        ),
    ]

    indicators = [
        ConstituentIndicator(
            district_id="district-1",
            issue_tag="healthcare",
            indicator_name="uninsured_rate",
            normalized_need_score=0.76,
        ),
        ConstituentIndicator(
            district_id="district-1",
            issue_tag="privacy",
            indicator_name="connected_households",
            normalized_need_score=0.61,
        ),
    ]

    results = analyze_statement_vote_alignment(statements=statements, bills=bills, votes=votes)
    honesty = calculate_honesty_score(results)
    impacts = estimate_constituent_impact(bills=bills, votes=votes, indicators=indicators)

    payload = {
        "results": [serialize_result(result) for result in results],
        "honesty_score": {
            "consistent_actions": honesty.consistent_actions,
            "total_comparable_statements": honesty.total_comparable_statements,
            "score": honesty.honesty_score,
        },
        "constituent_impact": [impact.__dict__ for impact in impacts],
    }

    print(json.dumps(payload, indent=2))
