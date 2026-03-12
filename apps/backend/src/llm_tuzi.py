import json
import os
import sys
from urllib import request, error


def main():
    payload = json.load(sys.stdin)
    api_key = os.environ.get('OPENAI_API_KEY', '')
    base_url = os.environ.get('OPENAI_BASE_URL', 'https://api.tu-zi.com/v1').rstrip('/')
    model = os.environ.get('OPENAI_MODEL', 'gpt-5.4')

    if not api_key:
        print(json.dumps({"error": "OPENAI_API_KEY is missing"}, ensure_ascii=False))
        sys.exit(1)

    body = {
        "model": model,
        "messages": payload["messages"],
        "temperature": payload.get("temperature", 0),
        "stream": False,
    }

    req = request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with request.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode("utf-8")
            print(raw)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        print(json.dumps({"http_status": exc.code, "error": raw}, ensure_ascii=False))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
