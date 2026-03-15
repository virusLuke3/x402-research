from __future__ import annotations

from pathlib import Path
from urllib import request

from research.core.config import ResearchConfig


class PDFDownloader:
    def __init__(self, output_dir: str | None = None):
        config = ResearchConfig.load()
        self.output_dir = Path(output_dir or config.download_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def download(self, paper: dict) -> str | None:
        pdf_url = paper.get("pdf_url")
        if not pdf_url:
            return None

        filename = f"{self._safe_name(paper.get('id', 'paper'))}.pdf"
        target = self.output_dir / filename
        try:
            request.urlretrieve(pdf_url, target)
            return str(target)
        except Exception:
            return None

    def _safe_name(self, value: str) -> str:
        return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in value)
