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
        f"# 研究报告：{topic}",
        "",
        "## 1. 执行摘要",
        (
            f"围绕“{topic}”已完成 arXiv + OpenReview 多源检索与筛选。"
            f"本次回退报告基于前 {min(len(evidence), config.report_citation_limit)} 条核心证据生成，原因是在线 LLM 调用失败。"
        ),
        "",
        "## 2. 研究范围与方法",
        (
            "采用 multi-source retrieval (arXiv + OpenReview) -> relevance filtering -> evidence ranking "
            "-> fallback synthesis 的流程，并要求至少 40 篇论文证据才进入报告生成。"
        ),
        "",
        "## 3. 证据来源概览",
        f"- arXiv: {source_summary.get('arxiv', 0)}",
        f"- OpenReview: {source_summary.get('openreview', 0)}",
        f"- Local frameworks: {source_summary.get('local-framework', 0)}",
        "",
        "## 4. 核心证据",
    ]
    markdown_sections.extend(f"- {title}" for title in top_titles)
    markdown_sections.extend(
        [
            "",
            "## 5. 初步判断",
            f"- 当前主题被识别为 `{topic_profile.get('label', research_mode)}`。",
            f"- 当前纳入综合的证据数量为 {len(evidence)} 条，其中论文证据至少为 {sum(1 for item in evidence if item.get('sourceType') in {'arxiv', 'openreview'})} 篇。",
            "- 当前报告为兜底版本，因此更偏向结构化综述，不包含完整的议会式长文综合。",
            "",
            "## 6. 局限性",
            "- 在线模型调用失败，因此未完成完整的多 Agent 讨论与长文写作。",
            "- 当前结论主要基于标题、摘要与多源排序，尚未下载全文做更细粒度审查。",
            "",
            "## 7. 参考文献",
        ]
    )
    markdown_sections.extend(
        f"{index + 1}. [{item['title']}]({item['url']}) — {item['published']} · {item['sourceType']}"
        for index, item in enumerate(citations)
        if item.get("url")
    )

    return {
        "mode": "python-fallback",
        "executiveSummary": f"围绕 {topic} 已完成多源抓取与筛选，但最终长文报告因模型调用失败而回退。",
        "researchQuestion": topic,
        "methodology": "Python research pipeline over arXiv + OpenReview retrieval, relevance filtering, agent debate, and fallback synthesis.",
        "keyFindings": top_titles[:5],
        "implications": ["多源检索与筛选流程已可用。", "报告质量仍取决于在线模型与 agent 讨论链路。"],
        "limitations": ["未完成完整 LLM parliament 综合。", error_message],
        "noveltyAssessment": "Medium",
        "consensus": "当前流程已具备 arXiv + OpenReview 双源检索能力，但高质量写作仍依赖可用的在线模型。",
        "nextResearchActions": [
            "恢复可用的模型额度与稳定性。",
            "在 40+ 篇论文证据基础上重新触发议会式综合。",
            "后续可加入 PDF 下载后的全文审查与证据聚类。",
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
