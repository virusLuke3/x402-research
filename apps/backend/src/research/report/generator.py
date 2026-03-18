from __future__ import annotations

import json

from research.core.config import ResearchConfig
from research.llm.client import LLMClient
from research.prompts.zh import build_report_system_prompt


class ReportGenerator:
    def __init__(self, model: str):
        self.model = model
        self.client = LLMClient()
        self.config = ResearchConfig.load()

    def generate(self, topic: str, research_mode: str, topic_profile: dict, evidence_bundle: dict, parliament_result: dict) -> dict:
        citations = self._build_citations(evidence_bundle.get("topicEvidence", []))
        source_summary = self._build_source_summary(evidence_bundle.get("topicEvidence", []))
        paper_count = sum(1 for item in evidence_bundle.get("topicEvidence", []) if item.get("sourceType") in {"arxiv", "openreview"})
        markdown, synthesis_mode = self._generate_markdown(topic, research_mode, topic_profile, evidence_bundle, parliament_result, citations)
        return {
            **parliament_result,
            "mode": "python-report-generator",
            "quality": {
                "evidenceCoverage": len(evidence_bundle.get("topicEvidence", [])),
                "synthesisMode": synthesis_mode,
                "confidence": "high" if paper_count >= self.config.minimum_paper_count else "medium-high" if paper_count >= 20 else "medium",
                "evidenceStats": self._build_evidence_stats(evidence_bundle.get("topicEvidence", [])),
                "sourceSummary": source_summary,
                "paperEvidenceCount": paper_count,
                "minimumPaperCount": self.config.minimum_paper_count,
            },
            "citations": citations,
            "markdown": markdown,
        }

    def _generate_markdown(self, topic: str, research_mode: str, topic_profile: dict, evidence_bundle: dict, parliament_result: dict, citations: list[dict]) -> tuple[str, str]:
        deterministic_markdown = self._build_stable_markdown(topic, topic_profile, evidence_bundle, parliament_result, citations)
        if not self.config.report_llm_enhancement_enabled:
            return deterministic_markdown, "python-deterministic-report"

        payload = {
            "topic": topic,
            "researchMode": research_mode,
            "topicProfile": topic_profile,
            "parliament": parliament_result,
            "sourceSummary": self._build_source_summary(evidence_bundle.get("topicEvidence", [])),
            "evidenceStats": self._build_evidence_stats(evidence_bundle.get("topicEvidence", [])),
            "evidenceDigest": [
                {
                    "ref": f"[{index + 1}]",
                    "title": item.get("title"),
                    "published": item.get("published"),
                    "sourceType": item.get("sourceType"),
                    "evidenceClass": item.get("evidenceClass"),
                    "summary": item.get("summary", "")[:600],
                }
                for index, item in enumerate(evidence_bundle.get("topicEvidence", [])[:24])
            ],
            "citations": citations[: self.config.report_citation_limit],
        }
        messages = [
            {"role": "system", "content": build_report_system_prompt()},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)},
        ]

        try:
            content = self.client.call(messages=messages, temperature=0.2, model=self.model)
            if isinstance(content, str) and content.strip():
                return content.strip(), "python-llm-enhanced-report"
            return deterministic_markdown, "python-deterministic-report"
        except Exception:
            return deterministic_markdown, "python-deterministic-report"

    def _build_stable_markdown(self, topic: str, topic_profile: dict, evidence_bundle: dict, parliament_result: dict, citations: list[dict]) -> str:
        source_summary = self._build_source_summary(evidence_bundle.get("topicEvidence", []))
        evidence_stats = self._build_evidence_stats(evidence_bundle.get("topicEvidence", []))
        executive_summary = self._flatten_text(parliament_result.get("executiveSummary")) or f"The available literature on {topic} has been synthesized into a structured evidence summary."
        methodology = self._flatten_text(parliament_result.get("methodology")) or f"Multi-source retrieval and filtering across arXiv and OpenReview for {topic_profile.get('label', 'the current topic')}."
        consensus = self._flatten_text(parliament_result.get("consensus")) or "The current evidence supports a limited consensus, but important boundaries and uncertainties remain."
        key_findings = self._normalize_bullets(parliament_result.get("keyFindings"))
        implications = self._normalize_bullets(parliament_result.get("implications"))
        limitations = self._normalize_bullets(parliament_result.get("limitations"))
        next_actions = self._normalize_bullets(parliament_result.get("nextResearchActions"))
        parliament_notes = self._normalize_parliament(parliament_result.get("parliament"))
        paper_count = sum(1 for item in evidence_bundle.get("topicEvidence", []) if item.get("sourceType") in {"arxiv", "openreview"})

        sections = [
            f"# Research Report: {topic}",
            "",
            "## 1. Executive Summary",
            executive_summary,
            "",
            "## 2. Scope and Method",
            methodology,
            "",
            "## 3. Evidence Overview",
            f"- Paper evidence count: {paper_count}",
            f"- Minimum report threshold: {self.config.minimum_paper_count} papers",
            f"- arXiv: {source_summary.get('arxiv', 0)}",
            f"- OpenReview: {source_summary.get('openreview', 0)}",
            f"- topic-core: {evidence_stats.get('topic-core', 0)}",
            f"- supporting: {evidence_stats.get('supporting', 0)}",
            "",
            "## 4. Key Findings",
        ]
        sections.extend(f"- {item}" for item in key_findings or ["No stable cross-source findings were extracted by the current synthesis pass."])
        sections.extend(["", "## 5. Implications"])
        sections.extend(f"- {item}" for item in implications or ["This report is best treated as an evidence map rather than a final conclusion."])
        sections.extend(["", "## 6. Working Consensus"])
        sections.append(consensus)
        sections.extend(["", "## 7. Limitations"])
        sections.extend(f"- {item}" for item in limitations or ["The current synthesis relies heavily on titles, abstracts, and structured agent output, so deeper full-text review is still needed."])
        sections.extend(["", "## 8. Next Research Actions"])
        sections.extend(f"- {item}" for item in next_actions or ["Add full-text retrieval and finer-grained evidence clustering."])
        if parliament_notes:
            sections.extend(["", "## 9. Agent Deliberation Notes"])
            sections.extend(f"- {item}" for item in parliament_notes)
        sections.extend(["", "## 10. References"])
        sections.extend(
            f"{idx + 1}. [{item['title']}]({item['url']}) — {item['published']}"
            for idx, item in enumerate(citations[: self.config.report_citation_limit])
            if item.get("url")
        )
        return "\n".join(sections)

    def _build_fallback_markdown(self, topic: str, topic_profile: dict, parliament_result: dict, citations: list[dict]) -> str:
        executive_summary = self._flatten_text(parliament_result.get("executiveSummary"))
        methodology = self._flatten_text(parliament_result.get("methodology"))
        key_findings = self._normalize_bullets(parliament_result.get("keyFindings"))
        limitations = self._normalize_bullets(parliament_result.get("limitations"))
        next_actions = self._normalize_bullets(parliament_result.get("nextResearchActions"))
        sections = [
            f"# Research Report: {topic}",
            "",
            "## 1. Executive Summary",
            executive_summary or f"A preliminary literature synthesis has been completed for {topic}.",
            "",
            "## 2. Scope and Method",
            methodology or f"Multi-source retrieval and filtering across arXiv and OpenReview for {topic_profile.get('label', 'the current topic')}.",
            "",
            "## 3. Key Findings",
        ]
        sections.extend(f"- {item}" for item in key_findings)
        sections.extend(["", "## 4. Limitations"])
        sections.extend(f"- {item}" for item in limitations)
        sections.extend(["", "## 5. Next Research Actions"])
        sections.extend(f"- {item}" for item in next_actions)
        sections.extend(["", "## 6. References"])
        sections.extend(
            f"{idx + 1}. [{item['title']}]({item['url']}) — {item['published']}"
            for idx, item in enumerate(citations[: self.config.report_citation_limit])
            if item.get("url")
        )
        return "\n".join(sections)

    def _flatten_text(self, value) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            parts = [self._flatten_text(item) for item in value]
            return "；".join(part for part in parts if part)
        if isinstance(value, dict):
            preferred = [
                value.get("point"),
                value.get("summary"),
                value.get("boundary"),
                value.get("finding"),
                value.get("title"),
                value.get("consensus"),
                value.get("text"),
                value.get("message"),
            ]
            chosen = next((self._flatten_text(item) for item in preferred if item), "")
            return chosen or json.dumps(value, ensure_ascii=False)
        return str(value).strip()

    def _normalize_bullets(self, value) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            text = self._flatten_text(value)
            return [text] if text else []
        bullets = []
        for item in value:
            text = self._flatten_text(item)
            if text:
                bullets.append(text)
        return bullets

    def _normalize_parliament(self, value) -> list[str]:
        notes = []
        if not isinstance(value, list):
            return notes
        for item in value:
            if isinstance(item, dict):
                agent = self._flatten_text(item.get("agent"))
                role = self._flatten_text(item.get("role"))
                stance = self._flatten_text(item.get("stance"))
                prefix = " / ".join(part for part in [agent, role] if part)
                if prefix and stance:
                    notes.append(f"{prefix}: {stance}")
                elif stance:
                    notes.append(stance)
            else:
                text = self._flatten_text(item)
                if text:
                    notes.append(text)
        return notes

    def _build_citations(self, items: list[dict]) -> list[dict]:
        citations = []
        for index, paper in enumerate(items):
            citations.append(
                {
                    "ref": f"[{index + 1}]",
                    "title": paper.get("title"),
                    "authors": paper.get("authors", []),
                    "published": paper.get("published"),
                    "sourceType": paper.get("sourceType"),
                    "evidenceClass": paper.get("evidenceClass"),
                    "id": paper.get("id"),
                    "url": paper.get("url"),
                }
            )
        return citations

    def _build_evidence_stats(self, items: list[dict]) -> dict:
        stats = {"topic-core": 0, "topic-framework": 0, "supporting": 0, "payment-rail": 0, "off-topic": 0}
        for item in items:
            key = item.get("evidenceClass", "off-topic")
            stats[key] = stats.get(key, 0) + 1
        return stats

    def _build_source_summary(self, items: list[dict]) -> dict:
        summary = {"arxiv": 0, "openreview": 0, "local-framework": 0, "other": 0}
        for item in items:
            source = item.get("sourceType")
            if source in summary:
                summary[source] += 1
            else:
                summary["other"] += 1
        return summary
