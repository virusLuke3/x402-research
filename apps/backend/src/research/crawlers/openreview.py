from __future__ import annotations

from datetime import datetime, timezone
from urllib import parse, request
import json

from research.core.config import ResearchConfig


class OpenReviewCrawler:
    def __init__(self, max_results: int | None = None, timeout_seconds: int = 60):
        config = ResearchConfig.load()
        self.max_results = max_results or config.openreview_max_results
        self.timeout_seconds = max(1, int(timeout_seconds))

    def fetch_papers(self, query: str) -> list[dict]:
        params = {
            "query": query,
            "limit": self.max_results,
        }
        url = "https://api2.openreview.net/notes/search?" + parse.urlencode(params)
        req = request.Request(url, headers={"User-Agent": "AutoScholar/0.8 research-pipeline"})
        with request.urlopen(req, timeout=self.timeout_seconds) as resp:
            payload = json.loads(resp.read().decode("utf-8"))

        papers = []
        for index, note in enumerate(payload.get("notes", [])):
            title = self._content_value(note, "title")
            abstract = self._content_value(note, "abstract")
            if not title or not abstract:
                continue

            note_id = str(note.get("id") or f"openreview-{index + 1}")
            papers.append(
                {
                    "id": note_id,
                    "title": self._clean(title),
                    "summary": self._clean(abstract),
                    "published": self._format_date(note.get("pdate") or note.get("cdate") or note.get("tcdate")),
                    "authors": self._list_value(note, "authors"),
                    "sourceType": "openreview",
                    "category": "external",
                    "keywords": self._keywords(note),
                    "pdf_url": f"https://openreview.net/pdf?id={note_id}",
                    "url": f"https://openreview.net/forum?id={note_id}",
                    "venue": note.get("domain") or self._content_value(note, "venue") or self._content_value(note, "venueid"),
                }
            )
        return papers

    def _content_value(self, note: dict, key: str) -> str:
        content = note.get("content", {}) or {}
        value = content.get(key)
        if isinstance(value, dict):
            return str(value.get("value") or "").strip()
        if isinstance(value, list):
            return ", ".join(str(item).strip() for item in value if item)
        return str(value or "").strip()

    def _list_value(self, note: dict, key: str) -> list[str]:
        content = note.get("content", {}) or {}
        value = content.get(key)
        if isinstance(value, dict):
            value = value.get("value")
        if isinstance(value, list):
            return [str(item).strip() for item in value if item]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    def _keywords(self, note: dict) -> list[str]:
        content = note.get("content", {}) or {}
        keywords = content.get("keywords")
        if isinstance(keywords, dict):
            keywords = keywords.get("value")
        if isinstance(keywords, list):
            return [str(item).strip() for item in keywords if item]
        if isinstance(keywords, str) and keywords.strip():
            return [part.strip() for part in keywords.split(",") if part.strip()]
        venue = note.get("domain")
        return [str(venue).strip()] if venue else []

    def _format_date(self, value: int | None) -> str:
        if not value:
            return ""
        try:
            return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).date().isoformat()
        except Exception:
            return ""

    def _clean(self, value: str) -> str:
        return " ".join(str(value or "").split()).strip()
