"""Language-model back-ends.

Any OpenAI-compatible Chat Completions API works: Google Gemini, Groq,
OpenAI, Azure OpenAI (v1 endpoint), or a local model served by Ollama.
Without an API key the app falls back to an offline demo client.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import requests

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
DEFAULT_MODEL = "gemini-3.6-flash"
DEMO_FILE = Path(__file__).with_name("demo_responses.json")


class LLMError(RuntimeError):
    """The language model could not be reached or refused the request."""


def load_dotenv(path: str | Path = ".env") -> None:
    """Minimal .env reader (KEY=VALUE lines), so no extra dependency is needed."""
    path = Path(path)
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


class OpenAICompatibleClient:
    def __init__(self, api_key: str, base_url: str, model: str, temperature: float = 0.3, timeout: int = 60):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        self.name = model

    def complete(self, messages: list[dict]) -> str:
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "temperature": self.temperature},
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.RequestException as exc:
            raise LLMError(f"Could not reach the language model: {exc}") from exc
        except (KeyError, IndexError, ValueError) as exc:
            raise LLMError("Unexpected answer format from the language model API.") from exc


class DemoClient:
    """Offline mode: replays answers recorded from the real model, one per language."""

    name = "demo mode (recorded answers)"

    def __init__(self, path: Path = DEMO_FILE):
        path = Path(path)
        self.answers: dict[str, str] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def complete(self, messages: list[dict]) -> str:
        prompt = messages[-1]["content"]
        for language, answer in self.answers.items():
            if f"Target language: {language}\n" in prompt:
                return answer
        raise LLMError(
            "Demo mode only has recorded answers for: " + ", ".join(self.answers)
            + ". Set LLM_API_KEY to use the live model."
        )


def get_client():
    """Live client when LLM_API_KEY is set (in the environment or a .env file), demo client otherwise."""
    load_dotenv()
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        return DemoClient()
    return OpenAICompatibleClient(
        api_key,
        os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL),
        os.getenv("LLM_MODEL", DEFAULT_MODEL),
    )
