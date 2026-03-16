from __future__ import annotations

from http.client import IncompleteRead
import json
import socket
import ssl
import time
from urllib import error, request

from research.core.config import ResearchConfig


def resolve_api_target(base_url: str, api_style: str) -> tuple[str, str]:
    normalized_style = (api_style or "chat-completions").strip().lower()
    normalized_url = base_url.rstrip("/")

    if normalized_url.endswith("/responses"):
        return "responses", normalized_url
    if normalized_url.endswith("/chat/completions"):
        return "chat-completions", normalized_url
    if normalized_style == "responses":
        return "responses", f"{normalized_url}/responses"
    return "chat-completions", f"{normalized_url}/chat/completions"


def convert_messages_to_responses_input(messages: list[dict]) -> list[dict]:
    converted = []
    for item in messages:
        role = item.get("role") or "user"
        content = item.get("content") or ""
        if isinstance(content, list):
            parts = []
            for entry in content:
                if isinstance(entry, dict) and entry.get("text"):
                    parts.append({"type": "input_text", "text": str(entry["text"])})
                elif isinstance(entry, str):
                    parts.append({"type": "input_text", "text": entry})
            if not parts:
                parts = [{"type": "input_text", "text": json.dumps(content, ensure_ascii=False)}]
        else:
            parts = [{"type": "input_text", "text": str(content)}]
        converted.append({"role": role, "content": parts})
    return converted


def parse_sse_payload(raw_text: str) -> dict:
    last_payload = None
    output_text_parts: list[str] = []

    for line in raw_text.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue

        data = line[5:].strip()
        if not data or data == "[DONE]":
            continue

        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            continue

        if payload.get("type") == "response.output_text.delta" and payload.get("delta"):
            output_text_parts.append(str(payload["delta"]))

        if isinstance(payload.get("response"), dict):
            last_payload = payload["response"]
        else:
            last_payload = payload

    if not last_payload:
        raise ValueError("empty SSE payload from provider")

    if output_text_parts and not last_payload.get("output_text"):
        last_payload["output_text"] = "".join(output_text_parts)

    return last_payload


def decode_response_body(raw_bytes: bytes, content_type: str | None) -> dict:
    raw_text = raw_bytes.decode("utf-8", errors="ignore")
    if "text/event-stream" in (content_type or "").lower():
        return parse_sse_payload(raw_text)
    return json.loads(raw_text)


def should_retry_http(exc: error.HTTPError) -> bool:
    return exc.code in {408, 409, 425, 429, 500, 502, 503, 504}


def should_retry_network(exc: Exception) -> bool:
    if isinstance(exc, (TimeoutError, socket.timeout, IncompleteRead)):
        return True

    reason = getattr(exc, "reason", None)
    if isinstance(reason, (TimeoutError, socket.timeout, IncompleteRead)):
        return True

    text = f"{type(exc).__name__}: {exc}"
    if reason:
        text = f"{text} | reason={reason}"
    text = text.lower()
    retry_markers = [
        "temporarily unavailable",
        "connection reset",
        "connection aborted",
        "remote end closed",
        "timed out",
        "timeout",
        "ssl",
        "eof occurred in violation of protocol",
        "unexpected eof",
        "bad gateway",
        "service unavailable",
        "gateway timeout",
    ]
    return any(marker in text for marker in retry_markers)


def call_openai_format(messages: list[dict], temperature: float = 0.1, model: str | None = None) -> dict:
    config = ResearchConfig.load()
    if not config.openai_api_key:
        raise ValueError("OPENAI_API_KEY is missing")

    api_style, url = resolve_api_target(config.openai_base_url, config.openai_api_style)
    if api_style == "responses":
        body = {
            "model": model or config.openai_model,
            "input": convert_messages_to_responses_input(messages),
            "temperature": temperature,
            "stream": False,
        }
    else:
        body = {
            "model": model or config.openai_model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }

    req = request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.openai_api_key}",
        },
    )
    ssl_context = None
    if "aigc-api.hkust-gz.edu.cn" in url:
        # Match paperDemo.py's relaxed TLS behavior as closely as stdlib urllib allows.
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    last_error = None
    for attempt in range(1, config.llm_max_retries + 1):
        try:
            with request.urlopen(req, timeout=config.llm_timeout_seconds, context=ssl_context) as resp:
                return decode_response_body(resp.read(), resp.headers.get("Content-Type"))
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="ignore")
            last_error = RuntimeError(raw or f"HTTP {exc.code}")
            if attempt >= config.llm_max_retries or not should_retry_http(exc):
                raise last_error from exc
        except (error.URLError, OSError, TimeoutError, socket.timeout, IncompleteRead) as exc:
            last_error = exc
            if attempt >= config.llm_max_retries or not should_retry_network(exc):
                raise

        time.sleep(min(2 ** (attempt - 1), 4))

    if last_error:
        raise RuntimeError(str(last_error))
    raise RuntimeError("LLM request failed without a response")


def extract_text(response: dict) -> str:
    output_text = response.get("output_text")
    if isinstance(output_text, str) and output_text:
        return output_text

    output = response.get("output") or []
    for item in output:
        content = item.get("content") or []
        for entry in content:
            text = entry.get("text")
            if isinstance(text, str) and text:
                return text

    choices = response.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return message.get("content") or choices[0].get("text") or ""
