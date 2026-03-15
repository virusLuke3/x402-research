from __future__ import annotations

import json
import re
from typing import Any

from research.llm.providers import call_openai_format, extract_text


class LLMClient:
    def call(self, messages: list[dict], temperature: float = 0.1, model: str | None = None) -> str:
        response = call_openai_format(messages=messages, temperature=temperature, model=model)
        return extract_text(response)

    def call_json(self, messages: list[dict], fallback: Any, temperature: float = 0.1, model: str | None = None) -> Any:
        content = self.call(messages=messages, temperature=temperature, model=model)
        return parse_json_content(content, fallback)


def parse_json_content(content: str, fallback: Any) -> Any:
    if not isinstance(content, str):
        return fallback
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content, re.IGNORECASE)
        if not match:
            return fallback
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return fallback
