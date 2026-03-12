#!/usr/bin/env python3
import json
import os
import sys
import urllib.request
import urllib.error
import ssl

def request_with_env(url: str, payload: dict, api_key: str):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        return resp.read().decode('utf-8')


def main():
    raw = sys.stdin.read()
    body = json.loads(raw)
    api_url = body['api_url']
    api_key = body['api_key']
    model = body['model']
    topic = body['topic']
    papers = body['papers']

    payload = {
        'model': model,
        'messages': [
            {
                'role': 'user',
                'content': f'Produce a concise research summary for topic: {topic}. Based on these arXiv papers: {json.dumps(papers[:5])}. Return JSON only with keys summary, keyFindings, implications.'
            }
        ],
        'temperature': 0,
    }

    try:
        text = request_with_env(api_url, payload, api_key)
        parsed = json.loads(text)
        content = parsed['choices'][0]['message']['content']
        try:
            result = json.loads(content)
        except Exception:
            result = {
                'summary': content,
                'keyFindings': [],
                'implications': []
            }
        print(json.dumps({'ok': True, 'result': result, 'raw': parsed}, ensure_ascii=False))
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', 'ignore')
        print(json.dumps({'ok': False, 'error': f'HTTP {e.code}: {err}'}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
