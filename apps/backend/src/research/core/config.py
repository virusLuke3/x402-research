from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ResearchConfig:
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_style: str = "chat-completions"
    openai_model: str = "gpt-5.4"
    llm_timeout_seconds: int = 180
    llm_max_retries: int = 3
    report_llm_enhancement_enabled: bool = False
    arxiv_max_results: int = 80
    openreview_max_results: int = 80
    evidence_limit: int = 48
    minimum_paper_count: int = 40
    report_citation_limit: int = 20
    download_dir: str = "./tmp/research-downloads"

    @classmethod
    def load(cls) -> "ResearchConfig":
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", os.getenv("API_KEY", "")),
            openai_base_url=os.getenv("OPENAI_BASE_URL", os.getenv("API_URL", "https://api.openai.com/v1")).rstrip("/"),
            openai_api_style=os.getenv("OPENAI_API_STYLE", "chat-completions").strip().lower(),
            openai_model=os.getenv("OPENAI_MODEL", os.getenv("MODEL", "gpt-5.4")),
            llm_timeout_seconds=int(os.getenv("LLM_TIMEOUT_MS", "60000")) // 1000 or 60,
            llm_max_retries=max(1, int(os.getenv("LLM_MAX_RETRIES", "3"))),
            report_llm_enhancement_enabled=os.getenv("REPORT_LLM_ENHANCEMENT", "false").strip().lower() in {"1", "true", "yes", "on"},
            arxiv_max_results=int(os.getenv("ARXIV_MAX_RESULTS", "80")),
            openreview_max_results=int(os.getenv("OPENREVIEW_MAX_RESULTS", "80")),
            evidence_limit=int(os.getenv("EVIDENCE_LIMIT", "48")),
            minimum_paper_count=int(os.getenv("MINIMUM_PAPER_COUNT", "40")),
            report_citation_limit=int(os.getenv("REPORT_CITATION_LIMIT", "20")),
            download_dir=os.getenv("RESEARCH_DOWNLOAD_DIR", "./tmp/research-downloads"),
        )
