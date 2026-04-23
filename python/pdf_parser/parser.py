from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from .models import FinancialDisclosurePayload, FinancialDisclosureRecord


FIELD_PATTERNS = {
    "asset": re.compile(r"^(asset|assets?)\s*:\s*(.*)$", re.IGNORECASE),
    "liability": re.compile(r"^(liability|liabilities?)\s*:\s*(.*)$", re.IGNORECASE),
    "income": re.compile(r"^(income|income source|income sources)\s*:\s*(.*)$", re.IGNORECASE),
    "transaction": re.compile(r"^(transaction|transactions?)\s*:\s*(.*)$", re.IGNORECASE),
}


def _load_pdf_text(pdf_path: Path) -> str:
    try:
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError("pdfplumber is required for PDF extraction") from exc

    if not pdf_path.exists():
        raise FileNotFoundError(f"Disclosure PDF not found: {pdf_path}")

    chunks: List[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            chunks.append(page_text)

    return "\n".join(chunks)


def _normalize_entry(raw: str) -> Dict[str, object]:
    value = re.sub(r"\s+", " ", raw.strip())
    parts = [part.strip() for part in value.split("|") if part.strip()]

    if len(parts) == 1:
        return {"name": parts[0]}

    result = {"name": parts[0]}
    for part in parts[1:]:
        if "=" in part:
            key, item_value = part.split("=", 1)
            result[key.strip().lower().replace(" ", "_")] = item_value.strip()

    return result


def _sanitize_text(text: str) -> str:
    cleaned = text.replace("\x00", "")
    cleaned = re.sub(r"[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def parse_financial_disclosure_pdf(pdf_path: str) -> Dict[str, object]:
    text = _load_pdf_text(Path(pdf_path))
    sanitized_text = _sanitize_text(text)
    lines = [line.strip() for line in sanitized_text.splitlines() if line.strip()]

    record = FinancialDisclosureRecord(
        extraction_status="partial",
        confidence_score=0.45,
        retrieval_date=datetime.now(timezone.utc).isoformat(),
        raw_text_excerpt=sanitized_text[:1200],
    )

    for line in lines:
        matched = False
        for key, pattern in FIELD_PATTERNS.items():
            pattern_match = pattern.match(line)
            if not pattern_match:
                continue

            matched = True
            entry_raw = pattern_match.group(2)
            entry = _normalize_entry(entry_raw)

            if key == "asset":
                record.assets.append(entry)
            elif key == "liability":
                record.liabilities.append(entry)
            elif key == "income":
                record.income_sources.append(entry)
            elif key == "transaction":
                record.transactions.append(entry)

            break

        if not matched:
            continue

    extracted_fields = sum(
        [
            len(record.assets),
            len(record.liabilities),
            len(record.income_sources),
            len(record.transactions),
        ]
    )

    if extracted_fields > 0:
        record.extraction_status = "parsed"
        record.confidence_score = min(0.95, 0.5 + (extracted_fields * 0.05))
        if extracted_fields < 4:
            record.uncertainty_notes.append("Limited field coverage; manual verification recommended.")
    else:
        record.extraction_status = "failed"
        record.confidence_score = 0.0
        record.uncertainty_notes.append("No extractable table entries detected from disclosure text.")

    payload = {
        "assets": record.assets,
        "liabilities": record.liabilities,
        "income_sources": record.income_sources,
        "transactions": record.transactions,
        "extraction_status": record.extraction_status,
        "confidence_score": round(record.confidence_score, 2),
        "parser_version": record.parser_version,
        "retrieval_date": record.retrieval_date,
        "raw_text_excerpt": record.raw_text_excerpt,
        "uncertainty_notes": record.uncertainty_notes,
    }
    validated = FinancialDisclosurePayload.model_validate(payload)
    return validated.model_dump()


def parse_and_dump_json(pdf_path: str, output_path: str) -> None:
    payload = parse_financial_disclosure_pdf(pdf_path)
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
