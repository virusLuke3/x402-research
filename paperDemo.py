"""
Multi-Agent Academic Paper Review Framework

Uses LangGraph + direct LLM API (Qwen style via urllib3) to analyze arXiv papers.
Input: Full text from PDF (PyMuPDF extracted)
Output: Final agreed-upon summary
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import TypedDict, Literal

# 从 .env 加载环境变量（优先导入）
from dotenv import load_dotenv
load_dotenv()

from langgraph.graph import StateGraph, START, END

logging.basicConfig(
    format="[%(asctime)s %(levelname)s] %(message)s",
    datefmt="%m/%d/%Y %H:%M:%S",
    level=logging.INFO,
)

# =============================================================================
# LLM API（参考 qwen.py 调用方式）
# =============================================================================

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    urllib3 = None  # type: ignore

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

API_URL = os.getenv("API_URL", "https://aigc-api.hkust-gz.edu.cn/v1/chat/completions")
API_KEY = os.getenv("API_KEY", os.getenv("OPENAI_API_KEY", ""))
MODEL = os.getenv("MODEL", os.getenv("OPENAI_MODEL", "Qwen"))
# 延长超时：长论文分析需要更长时间
TIMEOUT = float(os.getenv("API_TIMEOUT", "180.0"))


def _get_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }


def _get_http_pool():
    if urllib3 is None:
        raise ImportError("urllib3 is required. pip install urllib3")
    return urllib3.PoolManager(
        cert_reqs="CERT_NONE",
        assert_hostname=False,
        timeout=TIMEOUT,
    )


def _should_retry(exc: BaseException) -> bool:
    """超时或 API 临时故障（AI not responding）可重试"""
    if isinstance(exc, (urllib3.exceptions.ReadTimeoutError, urllib3.exceptions.TimeoutError)):
        return True
    if isinstance(exc, RuntimeError) and "API error:" in str(exc):
        msg = str(exc).lower()
        return "not responding" in msg or "try again" in msg
    return False


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception(_should_retry),
)
def _call_llm(system: str, user: str) -> str:
    """
    调用 LLM API（参考 qwen.py 的 urllib3 POST 方式）
    从 .env 读取 API_URL, API_KEY, MODEL
    超时 180s，失败时指数退避重试最多 3 次
    """
    if not API_KEY:
        raise ValueError("Set API_KEY or OPENAI_API_KEY in .env")
    data = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": int(os.getenv("API_MAX_TOKENS", "4096")),  # 避免默认截断
    }
    http = _get_http_pool()
    try:
        response = http.request(
            "POST",
            API_URL,
            body=json.dumps(data, ensure_ascii=False),
            headers=_get_headers(),
        )
        if response.status != 200:
            raise RuntimeError(
                f"API error {response.status}: {response.data.decode('utf-8', errors='replace')[:500]}"
            )
        result = json.loads(response.data.decode("utf-8"))
        if "error" in result:
            err = result["error"]
            msg = err.get("message", str(err))
            raise RuntimeError(f"API error: {msg}")
        if "choices" not in result or not result["choices"]:
            raise RuntimeError(f"Invalid API response: {result}")
        content = result["choices"][0].get("message", {}).get("content", "")
        return content.strip() if content else ""
    finally:
        http.clear()


# =============================================================================
# State Management (TypedDict)
# =============================================================================


class PaperState(TypedDict):
    """Shared state for the multi-agent paper review workflow."""

    paper_text: str
    paper_id: str
    paper_title: str
    context_summary: str
    technical_analysis: str
    draft_report: str
    critique_feedback: list
    revision_iterations: int
    final_report: str


# =============================================================================
# Section Extraction（缩小 Deep Analyst 输入，避免超时 + lost-in-the-middle）
# =============================================================================

# 常见方法论/实验章节标题（正则）
_SECTION_PATTERNS = [
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Methodology|Methods|Method)\s*[:\.]?\s*\n",
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Experiments?|Experimental)\s*[:\.]?\s*\n",
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Implementation|System Design)\s*[:\.]?\s*\n",
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Architecture|Framework)\s*[:\.]?\s*\n",
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Technical Approach|Approach)\s*[:\.]?\s*\n",
    r"(?i)(?:^|\n)\s*(?:[\d\.]+)?\s*(?:Proposed (?:Method|Model|System))\s*[:\.]?\s*\n",
]

# 单次请求最大字符（避免超时）
_MAX_DEEP_ANALYST_CHARS = int(os.getenv("MAX_DEEP_ANALYST_CHARS", "12000"))
# Context Agent 输入上限：过长会导致 API 超时或 "AI not responding"
_MAX_CONTEXT_AGENT_CHARS = int(os.getenv("MAX_CONTEXT_AGENT_CHARS", "35000"))


def _truncate_for_context_agent(text: str) -> str:
    """
    为 Context Agent 截断输入：优先取 Abstract / Intro / Conclusion 区域。
    过长输入易触发 API 'AI not responding' 或超时。
    """
    if len(text) <= _MAX_CONTEXT_AGENT_CHARS:
        return text
    # 尝试提取 Abstract 和 Conclusion
    abstract_pat = re.compile(r"(?i)(?:^|\n)\s*(?:abstract)\s*[:\.]?\s*\n(.*?)(?=\n\s*(?:introduction|1\.|keywords)|$)", re.DOTALL)
    conclusion_pat = re.compile(r"(?i)(?:^|\n)\s*(?:conclusion|conclusions|summary)\s*[:\.]?\s*\n(.*?)(?=\n\s*(?:references?|acknowledgments?)|$)", re.DOTALL)
    parts = []
    for pat in (abstract_pat, conclusion_pat):
        m = pat.search(text)
        if m:
            chunk = m.group(1).strip()
            if len(chunk) > 100:
                parts.append(chunk)
    if parts:
        combined = "\n\n[...]\n\n".join(parts)
        return combined[:_MAX_CONTEXT_AGENT_CHARS] + "..." if len(combined) > _MAX_CONTEXT_AGENT_CHARS else combined
    # Fallback: 首部 + 尾部
    head = text[:25000]
    tail = text[-10000:] if len(text) > 35000 else ""
    return head + "\n\n[... truncated ...]\n\n" + tail


def _extract_technical_sections(text: str) -> str:
    """
    提取 Methodology/Experiments 等关键段落，缩小 Deep Analyst 输入。
    找不到时用首尾截断（首 7000 + 尾 3000）避免 lost-in-the-middle。
    """
    if len(text) <= _MAX_DEEP_ANALYST_CHARS:
        return text

    sections = []
    for pat in _SECTION_PATTERNS:
        for m in re.finditer(pat, text):
            start = m.end()
            # 找到下一同级标题或结尾
            next_match = re.search(r"\n\s*(?:[\d]+\.|[A-Z][a-z]+)\s", text[start:start + 5000])
            end = start + (next_match.start() if next_match else min(5000, len(text) - start))
            chunk = text[start:end].strip()
            if len(chunk) > 100:
                sections.append(chunk)
    if sections:
        combined = "\n\n[...]\n\n".join(sections[:4])  # 最多 4 段
        if len(combined) <= _MAX_DEEP_ANALYST_CHARS:
            return combined
        return combined[:_MAX_DEEP_ANALYST_CHARS] + "..."

    # Fallback: 首 + 尾
    head = text[:7000]
    tail = text[-3000:] if len(text) > 10000 else ""
    return head + "\n\n[... truncated middle ...]\n\n" + tail


# =============================================================================
# PDF / Text Ingestion
# =============================================================================


def parse_document(state: PaperState) -> dict:
    """Node 1: Clean paper text (from PDF full-text extraction)."""
    print("\n" + "=" * 60)
    print("[NODE] parse_document: Ingestion")
    print("=" * 60)
    text = state["paper_text"]
    cleaned = re.sub(r"\s+", " ", text).strip()
    print(f"Paper text length: {len(cleaned)} chars")
    return {"paper_text": cleaned}


# =============================================================================
# Agent Prompts
# =============================================================================

CONTEXT_AGENT_SYSTEM = """You are a top-tier academic researcher. Read the provided paper text (focusing on the Abstract, Intro, and Conclusion). Extract the core problem being solved, the main contribution, and the real-world implications. Be concise but thorough."""

DEEP_ANALYST_SYSTEM = """You are a rigorous technical analyst. Dive into the methodology, formulas, and experimental data of the paper. Break down the system architecture, identify key parameters (like testnet environments or dataset constraints), and explain *how* the solution works under the hood. Be precise and technical."""

SYNTHESIZER_SYSTEM = """You are the lead author. Combine the context_summary and technical_analysis into a cohesive draft report.

【严格要求 - 针对 Telegram 排版】
1. 输出语言：全程使用中文
2. 格式：直接输出排版好的内容，绝对不要使用 ```markdown 代码块包裹整个回复。
3. 使用 HTML 标签：<b>粗体</b>、<i>斜体</i>、<code>行内代码</code>，以便 Telegram 正确渲染。
4. 数学公式：Telegram 不支持 LaTeX。请将所有数学公式（如 $k = a/b$）转为易读的 Unicode 纯文本（如 k = a / b），或放在 <code> 中。
5. 使用 Emoji 辅助排版：📌 一级标题、🔹 列表项，提升阅读体验。
6. 结构示例：
   📌 研究背景与问题
   🔹 问题描述...
   🔹 动机...
   📌 核心贡献
   🔹 1. ...
   🔹 2. ...
   📌 技术方法
   🔹 ...
   📌 实验与结果
   🔹 ...
   📌 总结与启示
   🔹 ...

If you receive critique_feedback, you MUST adjust the draft to address the reviewer's concerns, ensuring absolute technical accuracy."""

CRITIC_SYSTEM = """You are a strict, 'Red Team' peer reviewer. Compare the draft_report against the original paper_text. Look for logical leaps, missing assumptions, or hallucinated metrics. Output a specific list of flaws (可用中文). If the draft is accurate and faithful to the source, output exactly: PASS"""


# =============================================================================
# Node Functions (Agents)
# =============================================================================


def extract_context(state: PaperState) -> dict:
    """Node 2: Context Agent. 截断输入避免超长导致 API 'AI not responding'."""
    print("\n" + "=" * 60)
    print("[NODE] extract_context: Context Agent")
    print("=" * 60)
    truncated = _truncate_for_context_agent(state["paper_text"])
    print(f"Context Agent input: {len(truncated)} chars (from {len(state['paper_text'])} total)")
    summary = _call_llm(CONTEXT_AGENT_SYSTEM, f"Paper text:\n\n{truncated}")
    print(f"Context summary length: {len(summary)} chars")
    return {"context_summary": summary}


def analyze_technical_details(state: PaperState) -> dict:
    """Node 3: Deep Analyst. 只传入 Methodology/Experiments 等关键段落，避免超时."""
    print("\n" + "=" * 60)
    print("[NODE] analyze_technical_details: Deep Analyst")
    print("=" * 60)
    technical_text = _extract_technical_sections(state["paper_text"])
    print(f"Input size: {len(technical_text)} chars (extracted from {len(state['paper_text'])} total)")
    analysis = _call_llm(DEEP_ANALYST_SYSTEM, f"Paper text (methodology/experiments focus):\n\n{technical_text}")
    print(f"Technical analysis length: {len(analysis)} chars")
    return {"technical_analysis": analysis}


def draft_and_revise(state: PaperState) -> dict:
    """Node 4: Synthesizer."""
    print("\n" + "=" * 60)
    print("[NODE] draft_and_revise: Synthesizer")
    if state.get("critique_feedback"):
        print("  (Revising based on critique feedback)")
    print("=" * 60)
    feedback_text = ""
    if state.get("critique_feedback") and len(state["critique_feedback"]) > 0:
        feedback_text = "\n\nReviewer's critique (address these):\n" + "\n".join(
            f"- {c}" for c in state["critique_feedback"]
        )
    user = (
        f"Context summary:\n{state['context_summary']}\n\nTechnical analysis:\n{state['technical_analysis']}"
        f"{feedback_text}\n\n请结合以上内容，用中文撰写报告。要求：1) 不要用 ```markdown 包裹；2) 使用 <b>、<code> 等 HTML 标签；3) 数学公式转 Unicode 纯文本；4) 用 📌 🔹 等 Emoji 分点呈现。"
    )
    draft = _call_llm(SYNTHESIZER_SYSTEM, user)
    print(f"Draft report length: {len(draft)} chars")
    return {"draft_report": draft}


def critique_draft(state: PaperState) -> dict:
    """Node 5: Critic. 截断 paper_text 避免超长导致 API 'AI not responding'."""
    print("\n" + "=" * 60)
    print("[NODE] critique_draft: Critic / Reviewer")
    print("=" * 60)
    truncated_paper = _truncate_for_context_agent(state["paper_text"])
    print(f"Critic input: {len(truncated_paper)} chars (from {len(state['paper_text'])} total paper)")
    user = (
        f"Original paper text (truncated):\n{truncated_paper}\n\nDraft report:\n{state['draft_report']}\n\n"
        "Compare and critique. Output PASS if accurate, else list specific flaws."
    )
    response = _call_llm(CRITIC_SYSTEM, user)
    content = response.strip().upper()
    print(f"Critic output: {content[:200]}...")
    if content == "PASS" or content.startswith("PASS"):
        return {"critique_feedback": [], "final_report": state["draft_report"]}
    lines = response.strip().split("\n")
    critiques = []
    for line in lines:
        line = line.strip()
        if not line or line.upper().startswith("PASS"):
            continue
        line = re.sub(r"^[\-\*\d\.\)]\s*", "", line).strip()
        if line:
            critiques.append(line)
    if not critiques:
        critiques = [response.strip()]
    return {"critique_feedback": critiques, "final_report": state["draft_report"]}


# =============================================================================
# Graph Construction
# =============================================================================


def _increment_iterations(state: PaperState) -> dict:
    return {"revision_iterations": state.get("revision_iterations", 0) + 1}


def build_graph() -> StateGraph:
    builder = StateGraph(PaperState)
    builder.add_node("parse_document", parse_document)
    builder.add_node("extract_context", extract_context)
    builder.add_node("analyze_technical_details", analyze_technical_details)
    builder.add_node("draft_and_revise", draft_and_revise)
    builder.add_node("critique_draft", critique_draft)
    builder.add_node("increment_iterations", _increment_iterations)

    builder.add_edge(START, "parse_document")
    builder.add_edge("parse_document", "extract_context")
    builder.add_edge("extract_context", "analyze_technical_details")
    builder.add_edge("analyze_technical_details", "draft_and_revise")
    builder.add_edge("draft_and_revise", "critique_draft")

    def route_fn(state: PaperState) -> Literal["end", "increment_iterations"]:
        iterations = state.get("revision_iterations", 0)
        feedback = state.get("critique_feedback") or []
        if not feedback or iterations >= 3:
            return "end"
        return "increment_iterations"

    builder.add_conditional_edges("critique_draft", route_fn, {
        "end": END,
        "increment_iterations": "increment_iterations",
    })
    builder.add_edge("increment_iterations", "draft_and_revise")

    return builder.compile()


def summarize_paper(
    paper_text: str,
    paper_id: str = "",
    paper_title: str = "",
) -> str:
    """Run multi-agent review on full paper text and return final summary."""
    graph = build_graph()
    initial: PaperState = {
        "paper_text": paper_text,
        "paper_id": paper_id,
        "paper_title": paper_title,
        "context_summary": "",
        "technical_analysis": "",
        "draft_report": "",
        "critique_feedback": [],
        "revision_iterations": 0,
        "final_report": "",
    }
    final_state = graph.invoke(initial)
    return final_state.get("final_report") or final_state.get("draft_report", "")
