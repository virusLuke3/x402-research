from __future__ import annotations

import json

from research.llm.client import LLMClient
from research.prompts.zh import ParliamentPrompts


class ResearchParliament:
    def __init__(self, model: str):
        self.model = model
        self.client = LLMClient()

    def analyze(self, topic: str, research_mode: str, topic_profile: dict, evidence_bundle: dict) -> dict:
        topic_evidence = evidence_bundle.get("topicEvidence", [])
        source_summary = evidence_bundle.get("sourceSummary", {})

        compact_evidence = self._compact_evidence(topic_evidence, limit=28, summary_chars=360)
        analyst_evidence = self._compact_evidence(topic_evidence, limit=22, summary_chars=700)
        skeptic_evidence = self._skeptic_evidence(topic_evidence)
        overview = self._build_overview(topic, topic_profile, topic_evidence, source_summary)

        chair = self._call_json(
            "Chair Agent",
            "Research Chair",
            ParliamentPrompts.CHAIR_SYSTEM_PROMPT,
            {
                "task": "Return JSON with framing, agenda, sourcePriorities, and qualityChecks.",
                "topic": topic,
                "researchMode": research_mode,
                "topicProfile": topic_profile,
                "overview": overview,
                "evidence": compact_evidence[:16],
            },
            {
                "framing": f"Synthesize the literature around '{topic}' while strictly constraining overclaiming.",
                "agenda": ["Identify the topic backbone", "Inspect source balance", "Summarize consensus and disagreements", "State boundaries and recommendations"],
                "sourcePriorities": ["Prioritize themes repeated across independent sources", "Avoid conclusions based on a handful of papers"],
                "qualityChecks": ["Check source imbalance", "Check time-window and methodological limitations"],
            },
        )

        curator = self._call_json(
            "Evidence Curator Agent",
            "Evidence Curator",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["curator"],
            {
                "task": "Return JSON with clusters, sourceBalance, mustReadRefs, and openQuestions.",
                "topic": topic,
                "topicProfile": topic_profile,
                "overview": overview,
                "chair": chair,
                "evidence": compact_evidence,
            },
            {
                "clusters": [],
                "sourceBalance": f"Current source mix: {source_summary}",
                "mustReadRefs": [],
                "openQuestions": [],
            },
        )

        analyst = self._call_json(
            "Security Researcher Agent",
            "Topic Evidence Analyst",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["analyst"],
            {
                "task": "Return JSON with thesis, keyPoints, evidencePatterns, and caveats.",
                "topic": topic,
                "topicProfile": topic_profile,
                "overview": overview,
                "chair": chair,
                "curator": curator,
                "evidence": analyst_evidence,
            },
            {"thesis": "", "keyPoints": [], "evidencePatterns": [], "caveats": []},
        )

        skeptic = self._call_json(
            "Audit Skeptic Agent",
            "Review Skeptic",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["skeptic"],
            {
                "task": "Return JSON with caution, weakPoints, and disagreementPoints.",
                "topic": topic,
                "topicProfile": topic_profile,
                "overview": overview,
                "chair": chair,
                "curator": curator,
                "analyst": analyst,
                "evidence": skeptic_evidence,
            },
            {"caution": "Avoid overclaiming.", "weakPoints": [], "disagreementPoints": []},
        )

        synthesizer = self._call_json(
            "Synthesis Agent",
            "Final Synthesizer",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["synthesizer"],
            {
                "task": (
                    "Return JSON with executiveSummary, keyFindings, implications, limitations, "
                    "consensus, and nextResearchActions. Arrays should contain 4-7 items and make source balance "
                    "and evidence boundaries explicit."
                ),
                "topic": topic,
                "researchMode": research_mode,
                "topicProfile": topic_profile,
                "overview": overview,
                "chair": chair,
                "curator": curator,
                "analyst": analyst,
                "skeptic": skeptic,
            },
            {
                "executiveSummary": f"A multi-source evidence synthesis has been completed for {topic}.",
                "keyFindings": [],
                "implications": [],
                "limitations": [],
                "consensus": "",
                "nextResearchActions": [],
            },
        )

        return {
            "mode": "python-parliament",
            "executiveSummary": synthesizer.get("executiveSummary") or f"A multi-source evidence synthesis has been completed for {topic}.",
            "researchQuestion": topic,
            "methodology": (
                "Python research pipeline over multi-source retrieval (arXiv + OpenReview), "
                "relevance filtering, evidence curation, agent debate, and report synthesis."
            ),
            "keyFindings": synthesizer.get("keyFindings") or analyst.get("keyPoints") or [],
            "implications": synthesizer.get("implications") or [],
            "limitations": synthesizer.get("limitations") or skeptic.get("weakPoints") or analyst.get("caveats") or [],
            "noveltyAssessment": "Medium",
            "consensus": synthesizer.get("consensus") or analyst.get("thesis") or "",
            "nextResearchActions": synthesizer.get("nextResearchActions") or curator.get("openQuestions") or [],
            "scenarios": [],
            "timeline": [],
            "domainSections": {
                "sourceSummary": source_summary,
                "clusters": curator.get("clusters") or [],
                "evidencePatterns": analyst.get("evidencePatterns") or [],
                "disagreementPoints": skeptic.get("disagreementPoints") or [],
            },
            "parliament": [
                {"agent": "Chair Agent", "role": "Research Chair", "stance": chair.get("framing", "")},
                {"agent": "Evidence Curator Agent", "role": "Evidence Curator", "stance": curator.get("sourceBalance", "")},
                {"agent": "Security Researcher Agent", "role": "Topic Evidence Analyst", "stance": analyst.get("thesis", "")},
                {"agent": "Audit Skeptic Agent", "role": "Review Skeptic", "stance": skeptic.get("caution", "")},
            ],
        }

    def _build_overview(self, topic: str, topic_profile: dict, evidence: list[dict], source_summary: dict) -> dict:
        by_year = {}
        for item in evidence:
            year = str(item.get("published") or "")[:4] or "unknown"
            by_year[year] = by_year.get(year, 0) + 1

        return {
            "topic": topic,
            "topicLabel": topic_profile.get("label"),
            "evidenceCount": len(evidence),
            "sourceSummary": source_summary,
            "yearSummary": by_year,
            "topTitles": [item.get("title") for item in evidence[:12]],
        }

    def _compact_evidence(self, items: list[dict], limit: int, summary_chars: int) -> list[dict]:
        return [
            {
                "rank": idx + 1,
                "ref": f"[{idx + 1}]",
                "title": item.get("title"),
                "published": item.get("published"),
                "authors": item.get("authors", []),
                "sourceType": item.get("sourceType"),
                "evidenceClass": item.get("evidenceClass"),
                "relevanceScore": item.get("relevanceScore"),
                "summary": item.get("summary", "")[:summary_chars],
            }
            for idx, item in enumerate(items[:limit])
        ]

    def _skeptic_evidence(self, items: list[dict]) -> list[dict]:
        supporting = [item for item in items if item.get("evidenceClass") in {"supporting", "topic-framework"}]
        lower_ranked = items[18:34]
        chosen = supporting[:10] + lower_ranked[:12]
        if not chosen:
            chosen = items[:18]
        return self._compact_evidence(chosen, limit=18, summary_chars=420)

    def _call_json(self, agent_name: str, role: str, system_prompt: str, payload: dict, fallback: dict) -> dict:
        messages = [
            {"role": "system", "content": system_prompt + " Return strict JSON only."},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
        try:
            return self.client.call_json(messages=messages, fallback=fallback, temperature=0.15, model=self.model)
        except Exception:
            return fallback
