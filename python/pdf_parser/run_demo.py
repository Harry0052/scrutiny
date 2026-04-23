from __future__ import annotations

import argparse
import json

from pdf_parser.parser import parse_financial_disclosure_pdf


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse a financial disclosure PDF into JSON")
    parser.add_argument("pdf_path", help="Absolute or relative path to PDF file")
    args = parser.parse_args()

    result = parse_financial_disclosure_pdf(args.pdf_path)
    print(json.dumps(result, indent=2))
