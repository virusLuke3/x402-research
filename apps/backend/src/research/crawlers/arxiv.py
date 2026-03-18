from __future__ import annotations

import re
from urllib import parse, request

from research.core.config import ResearchConfig


class ArxivCrawler:
    def __init__(self, max_results: int | None = None, timeout_seconds: int = 60):
        config = ResearchConfig.load()
        self.max_results = max_results or config.arxiv_max_results
        self.timeout_seconds = max(1, int(timeout_seconds))

    def fetch_papers(self, query: str) -> list[dict]:
        url = (
            "https://export.arxiv.org/api/query?"
            f"search_query=all:{parse.quote(query)}&start=0&max_results={self.max_results}"
            "&sortBy=relevance&sortOrder=descending"
        )
        req = request.Request(url, headers={"User-Agent": "AutoScholar/0.7 research-pipeline"})
        with request.urlopen(req, timeout=self.timeout_seconds) as resp:
            xml = resp.read().decode("utf-8")

        entries = re.findall(r"<entry>([\s\S]*?)</entry>", xml)
        papers = []
        for index, entry in enumerate(entries):
            title = self._extract(entry, "title")
            if not title:
                continue
            entry_id = self._extract(entry, "id") or f"arxiv-{index + 1}"
            papers.append(
                {
                    "id": entry_id.strip(),
                    "title": self._clean(title),
                    "summary": self._clean(self._extract(entry, "summary")),
                    "published": self._extract(entry, "published").strip(),
                    "authors": re.findall(r"<author>\s*<name>([\s\S]*?)</name>\s*</author>", entry),
                    "sourceType": "arxiv",
                    "category": "external",
                    "keywords": [],
                    "pdf_url": self._derive_pdf_url(entry_id),
                    "url": entry_id.strip(),
                }
            )
        return papers

    def _extract(self, entry: str, tag: str) -> str:
        match = re.search(rf"<{tag}>([\s\S]*?)</{tag}>", entry)
        return match.group(1) if match else ""

    def _clean(self, value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip()

    def _derive_pdf_url(self, entry_id: str) -> str | None:
        if not entry_id:
            return None
        return entry_id.replace("/abs/", "/pdf/") + ".pdf"
