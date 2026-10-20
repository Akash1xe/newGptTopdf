"""Validate every marker in PDFs produced by check-long-conversation.mjs."""
import re
from pathlib import Path
from pypdf import PdfReader

expected = [(message, paragraph) for message in range(120) for paragraph in range(40)]
for scenario in ("mounted-lazy", "virtual"):
    path = Path("tmp/pdfs") / f"long-{scenario}.pdf"
    reader = PdfReader(path)
    found = []
    for page in reader.pages:
        found.extend(
            (int(message), int(paragraph))
            for message, paragraph in re.findall(r"MARKER_(\d+)_(\d+)", page.extract_text())
        )
    assert len(reader.pages) > 100, f"Stress PDF too short: {len(reader.pages)} pages"
    assert found == expected, f"{scenario}: missing, duplicated, or out-of-order content"
    print(f"{scenario}: {len(reader.pages)} pages; all {len(found)} paragraphs present, exactly once, in order")
