from __future__ import annotations


def describe_server() -> dict:
    return {
        "name": "autoscholar-research-mcp",
        "purpose": "Expose research pipeline capabilities to an MCP host.",
        "tools": [
            {"name": "prepare_research", "description": "Run large-scale retrieval and ranking for a topic."},
            {"name": "generate_report", "description": "Run parliament synthesis and generate a markdown report."},
            {"name": "download_pdf", "description": "Download a PDF for a selected paper when a pdf_url is available."},
        ],
    }
