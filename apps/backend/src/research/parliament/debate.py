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
            "研究主席",
            ParliamentPrompts.CHAIR_SYSTEM_PROMPT,
            {
                "task": "给出研究 framing、agenda、sourcePriorities、qualityChecks。返回 JSON。",
                "topic": topic,
                "researchMode": research_mode,
                "topicProfile": topic_profile,
                "overview": overview,
                "evidence": compact_evidence[:16],
            },
            {
                "framing": f"围绕主题“{topic}”做文献综合，限制过度推断。",
                "agenda": ["识别主题主线", "检查来源结构", "总结共识与争议", "明确边界与建议"],
                "sourcePriorities": ["优先关注多源重复出现的主题", "避免只凭少量论文下结论"],
                "qualityChecks": ["检查来源偏斜", "检查时间窗口与方法局限"],
            },
        )

        curator = self._call_json(
            "Evidence Curator Agent",
            "证据策展人",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["curator"],
            {
                "task": "返回 JSON：clusters, sourceBalance, mustReadRefs, openQuestions。",
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
            "主题证据分析员",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["analyst"],
            {
                "task": "返回 JSON：thesis, keyPoints, evidencePatterns, caveats。",
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
            "审稿型怀疑者",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["skeptic"],
            {
                "task": "返回 JSON：caution, weakPoints, disagreementPoints。",
                "topic": topic,
                "topicProfile": topic_profile,
                "overview": overview,
                "chair": chair,
                "curator": curator,
                "analyst": analyst,
                "evidence": skeptic_evidence,
            },
            {"caution": "避免过度推断。", "weakPoints": [], "disagreementPoints": []},
        )

        synthesizer = self._call_json(
            "Synthesis Agent",
            "最终综合者",
            ParliamentPrompts.MEMBER_SYSTEM_PROMPTS["synthesizer"],
            {
                "task": (
                    "返回 JSON，包含 executiveSummary, keyFindings, implications, limitations, "
                    "consensus, nextResearchActions。数组字段请返回 4-7 条，并明确来源结构和证据边界。"
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
                "executiveSummary": f"已围绕 {topic} 完成多源证据综合。",
                "keyFindings": [],
                "implications": [],
                "limitations": [],
                "consensus": "",
                "nextResearchActions": [],
            },
        )

        return {
            "mode": "python-parliament",
            "executiveSummary": synthesizer.get("executiveSummary") or f"已围绕 {topic} 完成多源证据综合。",
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
                {"agent": "Chair Agent", "role": "研究主席", "stance": chair.get("framing", "")},
                {"agent": "Evidence Curator Agent", "role": "证据策展人", "stance": curator.get("sourceBalance", "")},
                {"agent": "Security Researcher Agent", "role": "主题证据分析员", "stance": analyst.get("thesis", "")},
                {"agent": "Audit Skeptic Agent", "role": "审稿型怀疑者", "stance": skeptic.get("caution", "")},
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
            {"role": "system", "content": system_prompt + " 严格输出 JSON。"},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
        try:
            return self.client.call_json(messages=messages, fallback=fallback, temperature=0.15, model=self.model)
        except Exception:
            return fallback
