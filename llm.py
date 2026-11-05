"""Language-model back-ends.

Any OpenAI-compatible Chat Completions API works: Google Gemini, Groq,
OpenAI, Azure OpenAI (v1 endpoint), or a local model served by Ollama.
Without an API key the app falls back to an offline demo client.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import requests

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
DEFAULT_MODEL = "gemini-3.6-flash"
DEMO_FILE = Path(__file__).with_name("demo_responses.json")


class LLMError(RuntimeError):
    """The language model could not be reached or refused the request."""


def load_dotenv(path: str | Path = Path(__file__).with_name(".env")) -> None:
    """Minimal .env reader (KEY=VALUE lines), so no extra dependency is needed."""
    path = Path(path)
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():  # utf-8-sig: Notepad may add a BOM
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


class OpenAICompatibleClient:
    RETRY_STATUS = {429, 500, 502, 503, 504}  # busy or temporarily unavailable: worth trying again
    BUSY = {429: "The model's request quota is used up for now (429). Wait a minute, then try again.",
            503: "The model is busy right now (503). Please try again in a few seconds."}

    def __init__(self, api_key: str, base_url: str, model: str, temperature: float = 0.3, timeout: int = 60,
                 retries: int = 2, backoff: float = 1.5):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        self.retries = retries
        self.backoff = backoff
        self.name = model

    def complete(self, messages: list[dict]) -> str:
        for attempt in range(self.retries + 1):
            last = attempt == self.retries
            try:
                response = requests.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": self.model, "messages": messages, "temperature": self.temperature},
                    timeout=self.timeout,
                )
            except requests.Timeout as exc:  # already waited `timeout` seconds: do not make the traveller wait more
                raise LLMError("The language model did not answer in time. Please try again.") from exc
            except requests.ConnectionError as exc:
                if last:
                    raise LLMError(f"Could not reach the language model: {exc}") from exc
            else:
                if response.status_code not in self.RETRY_STATUS:
                    break
                if last:
                    raise LLMError(self.BUSY.get(response.status_code,
                                                 f"The model is temporarily unavailable ({response.status_code}). Please try again."))
            time.sleep(self.backoff * (attempt + 1))  # wait 1.5 s, then 3 s
        try:
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.RequestException as exc:
            raise LLMError(f"The language model refused the request: {exc}") from exc
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LLMError("Unexpected answer format from the language model API.") from exc


class DemoClient:
    """Offline mode: replays answers recorded from the real model, one per language."""

    name = "demo mode (recorded answers)"

    def __init__(self, path: Path = DEMO_FILE):
        path = Path(path)
        self.answers: dict[str, str] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def complete(self, messages: list[dict]) -> str:
        prompt = "\n".join(message["content"] for message in messages)
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
