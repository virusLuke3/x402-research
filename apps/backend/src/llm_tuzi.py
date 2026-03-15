import json
import sys

from research.llm.providers import call_openai_format


def main():
    payload = json.load(sys.stdin)
    try:
        response = call_openai_format(
            messages=payload["messages"],
            temperature=payload.get("temperature", 0),
            model=payload.get("model"),
        )
        print(json.dumps(response, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
