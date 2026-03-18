from __future__ import annotations

import json
import re
import sys

from research.core.config import ResearchConfig
from research.crawlers.arxiv import ArxivCrawler
from research.crawlers.openreview import OpenReviewCrawler
from research.parliament.debate import ResearchParliament
from research.report.generator import ReportGenerator


TOPIC_FRAMEWORKS = {
    "forecast": [
        {
            "id": "fw-forecast-001",
            "title": "Scenario planning for frontier software ecosystems",
            "summary": "Forecast through scenarios rather than single-point predictions. Track adoption friction, standardization pressure, monetization rails, and trust boundaries.",
            "keywords": ["forecast", "scenario", "future", "adoption"],
            "sourceType": "local-framework",
            "category": "topic-framework",
            "published": "2026-03-12",
            "authors": ["AutoScholar Topic Framework"],
            "url": None,
        }
    ],
    "solidity": [
        {
            "id": "fw-sol-001",
            "title": "Solidity vulnerability taxonomy and exploit surface mapping",
            "summary": "A topic scaffold covering reentrancy, access control failures, oracle manipulation, integer/precision pitfalls, upgradeability hazards, denial-of-service vectors, and unsafe external calls.",
            "keywords": ["solidity", "smart contract", "vulnerability", "reentrancy", "audit"],
            "sourceType": "local-framework",
            "category": "topic-framework",
            "published": "2026-03-12",
            "authors": ["AutoScholar Topic Framework"],
            "url": None,
        },
        {
            "id": "fw-sol-002",
            "title": "Security review patterns for Solidity systems",
            "summary": "Security analysis should separate vulnerability class, exploit preconditions, realistic attack path, impact, mitigation pattern, and whether the issue is mostly architectural or implementation-specific.",
            "keywords": ["solidity", "security review", "exploit path", "mitigation", "audit checklist"],
            "sourceType": "local-framework",
            "category": "topic-framework",
            "published": "2026-03-12",
            "authors": ["AutoScholar Topic Framework"],
            "url": None,
        },
    ],
    "commerce": [
        {
            "id": "fw-commerce-001",
            "title": "Machine-to-machine commerce protocol design on x402 and Stacks",
            "summary": "A topic scaffold for agentic commerce covering challenge schemas, settlement rails, invoice lifecycle, entitlement release, replay protection, and specialist service pricing.",
            "keywords": ["x402", "stacks", "agentic commerce", "molbot", "entitlement", "invoice lifecycle"],
            "sourceType": "local-framework",
            "category": "topic-framework",
            "published": "2026-03-12",
            "authors": ["AutoScholar Topic Framework"],
            "url": None,
        }
    ],
    "general": [
        {
            "id": "fw-general-001",
            "title": "General deep research workflow scaffold",
            "summary": "A general-purpose scaffold for literature search, relevance filtering, skeptical review, and synthesis for arbitrary research topics.",
            "keywords": ["literature review", "research workflow", "analysis"],
            "sourceType": "local-framework",
            "category": "topic-framework",
            "published": "2026-03-12",
            "authors": ["AutoScholar Topic Framework"],
            "url": None,
        }
    ],
}


def derive_research_mode(topic: str) -> str:
    text = (topic or "").lower()
    if re.search(r"(predict|forecast|future|outlook|scenario|预测|未来|趋势|演化路径)", text, re.I):
        return "forecast"
    if re.search(r"(survey|literature review|systematic review|综述|文献综述|系统综述)", text, re.I):
        return "literature-review"
    return "analysis"


def derive_topic_profile(topic: str) -> dict:
    text = (topic or "").lower()
    if re.search(r"(solidity|smart contract|reentrancy|erc-20|erc20|defi|evm|合约|漏洞|审计|重入)", text, re.I):
        return {
            "key": "solidity",
            "label": "Solidity Security Research",
            "description": "Topic-specific security research on Solidity vulnerabilities, exploit paths, and mitigations.",
            "retrieverHint": "solidity vulnerabilities smart contract security audit exploit reentrancy access control",
            "specialistRoles": [
                {"agent": "Chair Agent", "role": "Debate chair"},
                {"agent": "Evidence Curator Agent", "role": "Cross-source evidence clustering and source balance review"},
                {"agent": "Security Researcher Agent", "role": "Vulnerability taxonomy and evidence synthesis"},
                {"agent": "Audit Skeptic Agent", "role": "Challenge weak or overclaimed security conclusions"},
            ],
        }
    if re.search(r"(x402|stacks|molbot|agentic commerce|usdcx|sbtc|invoice|entitlement|payment rail)", text, re.I):
        return {
            "key": "commerce",
            "label": "Agentic Commerce Protocol Research",
            "description": "Protocol research for molbot-to-molbot commerce and settlement design.",
            "retrieverHint": "x402 stacks agentic commerce molbot payment rail entitlement invoice lifecycle usdcx sbtc",
            "specialistRoles": [
                {"agent": "Chair Agent", "role": "Debate chair"},
                {"agent": "Evidence Curator Agent", "role": "Cross-source evidence clustering and source balance review"},
                {"agent": "Protocol Researcher Agent", "role": "Protocol evidence synthesis"},
                {"agent": "Method Skeptic Agent", "role": "Challenge weak protocol assumptions"},
            ],
        }
    if derive_research_mode(topic) == "forecast":
        return {
            "key": "forecast",
            "label": "Forecast Research",
            "description": "Future-oriented research with scenario analysis.",
            "retrieverHint": "future outlook trend scenario market evolution adoption",
            "specialistRoles": [
                {"agent": "Chair Agent", "role": "Debate chair"},
                {"agent": "Evidence Curator Agent", "role": "Cross-source evidence clustering and source balance review"},
                {"agent": "Market Analyst Agent", "role": "Future market analysis"},
                {"agent": "Method Skeptic Agent", "role": "Challenge uncertainty control"},
            ],
        }
    return {
        "key": "general",
        "label": "General Deep Research",
        "description": "Topic-agnostic literature synthesis with skeptical review.",
        "retrieverHint": "research papers literature analysis",
        "specialistRoles": [
            {"agent": "Chair Agent", "role": "Debate chair"},
            {"agent": "Evidence Curator Agent", "role": "Cross-source evidence clustering and source balance review"},
            {"agent": "Research Analyst Agent", "role": "Topic evidence synthesis"},
            {"agent": "Method Skeptic Agent", "role": "Challenge weak methods and overclaims"},
        ],
    }


def clean_topic_for_search(topic: str) -> str:
    cleaned = topic or ""
    replacements = [
        (r"predict the future of", "future outlook for"),
        (r"over the next \d+ years?", "near term outlook"),
        (r"研究关于", ""),
        (r"我想研究", ""),
        (r"research-grade|technical|report|analysis", " "),
    ]
    for pattern, replacement in replacements:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.I)
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_query(topic: str, research_mode: str, topic_profile: dict) -> str:
    cleaned = clean_topic_for_search(topic)
    english_keywords = " ".join(re.findall(r"[a-z0-9-]+", cleaned, flags=re.I))
    if re.search(r"[\u4e00-\u9fff]", cleaned):
        return " ".join(part for part in [topic_profile["retrieverHint"], english_keywords] if part).strip()
    if topic_profile["key"] in {"solidity", "forecast", "commerce"}:
        return " ".join(part for part in [cleaned, topic_profile["retrieverHint"]] if part).strip()
    return cleaned or topic_profile["retrieverHint"]


def build_query_variants(topic: str, research_mode: str, topic_profile: dict) -> list[str]:
    base_query = extract_query(topic, research_mode, topic_profile)
    cleaned = clean_topic_for_search(topic)
    variants = []
    for value in [base_query, cleaned, topic_profile.get("retrieverHint", "")]:
        normalized = re.sub(r"\s+", " ", str(value or "")).strip()
        if normalized and normalized not in variants:
            variants.append(normalized)
    return variants


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", str(value or "").lower())


def dedupe_papers(items: list[dict]) -> list[dict]:
    seen = set()
    deduped = []
    for item in items:
        dedupe_key = (
            normalize_title(item.get("title"))
            or str(item.get("url") or item.get("id") or "").strip().lower()
        )
        if not dedupe_key or dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append(item)
    return deduped


def score_evidence(topic: str, item: dict, index: int) -> int:
    topic_terms = [token for token in re.split(r"[^a-z0-9\u4e00-\u9fff]+", (topic or "").lower()) if token]
    haystack = f"{item.get('title', '')} {item.get('summary', '')} {' '.join(item.get('keywords', []))}".lower()
    term_hits = sum(1 for term in topic_terms if term and term in haystack)
    published = item.get("published", "")
    recency_boost = 2 if str(published).startswith(("2024", "2025", "2026")) else 0
    source_boost = 1 if item.get("sourceType") in {"arxiv", "openreview"} else 0
    category_boost = 2 if item.get("category") == "topic-framework" else 0
    return term_hits + recency_boost + source_boost + category_boost + max(0, 6 - index)


def classify_evidence(topic_profile: dict, item: dict) -> str:
    haystack = f"{item.get('title', '')} {item.get('summary', '')} {' '.join(item.get('keywords', []))}".lower()
    if item.get("category") == "topic-framework":
        return "topic-framework"
    if topic_profile["key"] == "solidity" and re.search(r"(solidity|smart contract|reentrancy|access control|audit|exploit|evm|defi)", haystack):
        return "topic-core"
    if topic_profile["key"] == "forecast" and re.search(r"(forecast|future|market|trend|agent|commerce|payment)", haystack):
        return "topic-core"
    if topic_profile["key"] == "commerce" and re.search(r"(x402|stacks|agent|commerce|payment|invoice|entitlement|sbtc|usdcx)", haystack):
        return "topic-core"
    if re.search(r"(agent|security|contract|payment|analysis|review|benchmark|evaluation|repair|auditing)", haystack):
        return "supporting"
    return "off-topic"


def build_topic_framework_evidence(topic: str, topic_profile: dict) -> list[dict]:
    frameworks = TOPIC_FRAMEWORKS.get(topic_profile["key"], TOPIC_FRAMEWORKS["general"])
    enriched = []
    for index, entry in enumerate(frameworks):
        item = dict(entry)
        item["relevanceScore"] = score_evidence(topic, item, index)
        item["evidenceClass"] = classify_evidence(topic_profile, item)
        enriched.append(item)
    return enriched


def build_source_summary(items: list[dict]) -> dict:
    summary = {"arxiv": 0, "openreview": 0, "local-framework": 0, "other": 0}
    for item in items:
        source = item.get("sourceType")
        if source in summary:
            summary[source] += 1
        else:
            summary["other"] += 1
    return summary


def retrieve_evidence(topic: str, research_mode: str | None = None, topic_profile: dict | None = None) -> dict:
    config = ResearchConfig.load()
    research_mode = research_mode or derive_research_mode(topic)
    topic_profile = topic_profile or derive_topic_profile(topic)
    queries = build_query_variants(topic, research_mode, topic_profile)

    crawlers = [
        ArxivCrawler(max_results=config.arxiv_max_results),
        OpenReviewCrawler(max_results=config.openreview_max_results),
    ]
    external = []
    for query in queries:
        for crawler in crawlers:
            try:
                external.extend(crawler.fetch_papers(query))
            except Exception:
                continue

    external = dedupe_papers(external)
    scored_external = []
    for index, item in enumerate(external):
        enriched = dict(item)
        enriched["relevanceScore"] = score_evidence(topic, enriched, index)
        enriched["evidenceClass"] = classify_evidence(topic_profile, enriched)
        scored_external.append(enriched)

    ranked_external = sorted(scored_external, key=lambda item: item["relevanceScore"], reverse=True)
    filtered_external = []
    for item in ranked_external:
        if topic_profile["key"] == "general":
            keep = item["evidenceClass"] != "off-topic" and item["relevanceScore"] >= 4
        elif topic_profile["key"] == "commerce":
            keep = item["evidenceClass"] in {"topic-core", "supporting"} and item["relevanceScore"] >= 5
        else:
            keep = item["evidenceClass"] in {"topic-core", "supporting"} or item["relevanceScore"] >= 5
        if keep:
            filtered_external.append(item)

    if len(filtered_external) < config.minimum_paper_count:
        reserve = [item for item in ranked_external if item not in filtered_external and item["relevanceScore"] >= 3]
        filtered_external.extend(reserve[: max(0, config.minimum_paper_count - len(filtered_external))])

    if len(filtered_external) < config.minimum_paper_count:
        raise ValueError(
            f"insufficient paper evidence: found {len(filtered_external)} papers across arXiv and OpenReview, "
            f"need at least {config.minimum_paper_count}"
        )

    topic_evidence = filtered_external[: config.evidence_limit]
    if len(topic_evidence) < config.evidence_limit:
        frameworks = build_topic_framework_evidence(topic, topic_profile)
        topic_evidence.extend(frameworks[: max(0, config.evidence_limit - len(topic_evidence))])

    source_summary = build_source_summary(topic_evidence)
    paper_evidence_count = sum(1 for item in topic_evidence if item.get("sourceType") in {"arxiv", "openreview"})

    return {
        "query": queries[0] if queries else "",
        "queryVariants": queries,
        "researchMode": research_mode,
        "topicProfile": topic_profile,
        "topicEvidence": topic_evidence,
        "paymentEvidence": [],
        "combined": topic_evidence,
        "sourceSummary": source_summary,
        "paperEvidenceCount": paper_evidence_count,
        "minimumPaperCount": config.minimum_paper_count,
    }


def generate_report(topic: str, research_mode: str, topic_profile: dict, evidence_bundle: dict) -> dict:
    config = ResearchConfig.load()
    paper_count = sum(1 for item in evidence_bundle.get("topicEvidence", []) if item.get("sourceType") in {"arxiv", "openreview"})
    if paper_count < config.minimum_paper_count:
        return build_fallback_report(
            topic,
            research_mode,
            topic_profile,
            evidence_bundle,
            f"insufficient paper evidence for report generation: {paper_count} < {config.minimum_paper_count}",
        )

    try:
        parliament = ResearchParliament(model=config.openai_model)
        parliament_result = parliament.analyze(topic, research_mode, topic_profile, evidence_bundle)
        generator = ReportGenerator(model=config.openai_model)
        return generator.generate(topic, research_mode, topic_profile, evidence_bundle, parliament_result)
    except Exception as exc:
        return build_fallback_report(topic, research_mode, topic_profile, evidence_bundle, str(exc))


def build_fallback_report(topic: str, research_mode: str, topic_profile: dict, evidence_bundle: dict, error_message: str) -> dict:
    config = ResearchConfig.load()
    evidence = evidence_bundle.get("topicEvidence", [])
    top_titles = [item.get("title", "Unknown paper") for item in evidence[:8]]
    citations = []
    for index, paper in enumerate(evidence[: config.report_citation_limit]):
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

    source_summary = build_source_summary(evidence)
    markdown_sections = [
        f"# Research Report: {topic}",
        "",
        "## 1. Executive Summary",
        (
            f"Multi-source retrieval and filtering across arXiv and OpenReview completed for '{topic}'. "
            f"This fallback report was generated from the top {min(len(evidence), config.report_citation_limit)} evidence items because the online LLM synthesis step failed."
        ),
        "",
        "## 2. Scope and Method",
        (
            "The pipeline uses multi-source retrieval (arXiv + OpenReview) -> relevance filtering -> evidence ranking "
            f"-> fallback synthesis, and requires at least {config.minimum_paper_count} paper records before long-form report generation."
        ),
        "",
        "## 3. Source Overview",
        f"- arXiv: {source_summary.get('arxiv', 0)}",
        f"- OpenReview: {source_summary.get('openreview', 0)}",
        f"- Local frameworks: {source_summary.get('local-framework', 0)}",
        "",
        "## 4. Core Evidence",
    ]
    markdown_sections.extend(f"- {title}" for title in top_titles)
    markdown_sections.extend(
        [
            "",
            "## 5. Provisional Assessment",
            f"- The topic is currently classified as `{topic_profile.get('label', research_mode)}`.",
            f"- The current synthesis includes {len(evidence)} evidence records, including at least {sum(1 for item in evidence if item.get('sourceType') in {'arxiv', 'openreview'})} paper records.",
            "- This is a fallback report, so it emphasizes structured synthesis rather than the full parliament-style long-form write-up.",
            "",
            "## 6. Limitations",
            "- The online model call failed, so the full multi-agent discussion and long-form writing pass did not complete.",
            "- The current conclusions rely mainly on titles, abstracts, and ranked evidence rather than deeper full-text review.",
            "",
            "## 7. References",
        ]
    )
    markdown_sections.extend(
        f"{index + 1}. [{item['title']}]({item['url']}) — {item['published']} · {item['sourceType']}"
        for index, item in enumerate(citations)
        if item.get("url")
    )

    return {
        "mode": "python-fallback",
        "executiveSummary": f"Multi-source retrieval and filtering completed for {topic}, but the long-form report fell back because the model synthesis step failed.",
        "researchQuestion": topic,
        "methodology": "Python research pipeline over arXiv + OpenReview retrieval, relevance filtering, agent debate, and fallback synthesis.",
        "keyFindings": top_titles[:5],
        "implications": ["The multi-source retrieval and filtering pipeline is operational.", "Final report quality still depends on the online model and the downstream agent deliberation path."],
        "limitations": ["The full LLM parliament synthesis did not complete.", error_message],
        "noveltyAssessment": "Medium",
        "consensus": "The current pipeline can retrieve from both arXiv and OpenReview, but high-quality long-form writing still depends on a working online model.",
        "nextResearchActions": [
            "Restore stable model availability and retry the synthesis pass.",
            "Re-run parliament-style synthesis once 40+ paper records are available.",
            "Add full-text PDF review and evidence clustering in a later iteration.",
        ],
        "scenarios": [],
        "timeline": [],
        "domainSections": None,
        "parliament": [],
        "quality": {
            "evidenceCoverage": len(evidence),
            "synthesisMode": "python-fallback",
            "confidence": "medium",
            "evidenceStats": {
                "topic-core": sum(1 for item in evidence if item.get("evidenceClass") == "topic-core"),
                "topic-framework": sum(1 for item in evidence if item.get("evidenceClass") == "topic-framework"),
                "supporting": sum(1 for item in evidence if item.get("evidenceClass") == "supporting"),
                "payment-rail": 0,
                "off-topic": sum(1 for item in evidence if item.get("evidenceClass") == "off-topic"),
            },
            "sourceSummary": source_summary,
        },
        "citations": citations,
        "markdown": "\n".join(markdown_sections),
        "error": error_message,
    }


def main() -> None:
    payload = json.load(sys.stdin)
    action = payload.get("action")
    if action == "prepare":
        result = retrieve_evidence(
            topic=payload.get("topic", ""),
            research_mode=payload.get("researchMode"),
            topic_profile=payload.get("topicProfile"),
        )
        print(json.dumps(result, ensure_ascii=False))
        return
    if action == "report":
        result = generate_report(
            topic=payload.get("topic", ""),
            research_mode=payload.get("researchMode", "analysis"),
            topic_profile=payload.get("topicProfile", {}),
            evidence_bundle=payload.get("evidenceBundle", {}),
        )
        print(json.dumps(result, ensure_ascii=False))
        return
    raise ValueError(f"unknown action: {action}")


if __name__ == "__main__":
    main()
