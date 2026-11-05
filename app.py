"""Flask web application: chat interface + JSON API."""
from __future__ import annotations

import mimetypes
import os
import time
from collections import defaultdict, deque
from functools import lru_cache

from flask import Flask, jsonify, render_template, request

from assistant import ChatRequest, PhraseRequest, Settings, TravelLanguageAssistant
from catalog import COUNTRIES, ESSENTIALS, LANGUAGES, TOPICS, local_languages, place_name
from geo import GeoError, locate_ip, reverse_geocode
from llm import DemoClient, LLMError, get_client

# Some Windows registries map .js to text/plain, which browsers refuse to run with "nosniff".
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'",
    "Permissions-Policy": "geolocation=(self), microphone=(self)",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
}


class RateLimiter:
    """At most `limit` model requests per client in any 60-second window (protects the API key)."""

    def __init__(self, limit: int):
        self.limit = limit
        self.calls: dict[str, deque] = defaultdict(deque)

    def allow(self, client: str) -> bool:
        now, calls = time.monotonic(), self.calls[client]
        while calls and now - calls[0] > 60:
            calls.popleft()
        if len(calls) >= self.limit:
            return False
        calls.append(now)
        return True


def create_app(client=None, geocoder=reverse_geocode, ip_locator=locate_ip) -> Flask:
    app = Flask(__name__)
    app.json.ensure_ascii = False  # keep native scripts readable in the JSON API
    assistant = TravelLanguageAssistant(client or get_client())
    demo = isinstance(assistant.client, DemoClient)
    limiter = RateLimiter(int(os.getenv("RATE_LIMIT_PER_MINUTE") or 30))

    # Topic phrasebooks and essentials are the same for everyone: generate them once.
    phrasebook = lru_cache(maxsize=512)(lambda req: assistant.generate(req).to_dict())
    essentials = lru_cache(maxsize=512)(lambda settings: assistant.essentials(settings).to_dict())

    def too_many_requests():
        if limiter.allow(request.remote_addr or "local"):
            return None
        return jsonify(error="Too many requests. Please wait a minute."), 429

    def model_answer(parse, produce):
        """Validate the JSON body, call the model and turn every failure into a clear error."""
        if refused := too_many_requests():
            return refused
        data = request.get_json(silent=True)
        try:
            req = parse(data if isinstance(data, dict) else {})
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        try:
            return jsonify(produce(req) | {"demo": demo})
        except LLMError as exc:
            return jsonify(error=str(exc)), 503
        except ValueError as exc:
            app.logger.warning("Invalid model output: %s", exc)
            return jsonify(error="The model gave an unusable answer. Please try again."), 502

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/config")
    def config():
        return jsonify(
            languages={name: info["code"] for name, info in LANGUAGES.items()},
            countries={code: {"name": c["name"], "languages": c["languages"]} for code, c in COUNTRIES.items()},
            topics=[{"id": key, "label": label} for key, (label, _) in TOPICS.items()],
            essentials=[{"title": title, "phrases": phrases} for title, phrases in ESSENTIALS.items()],  # ordered
            model=assistant.client.name,
            demo=demo,
        )

    @app.post("/api/locate")
    def locate():
        if refused := too_many_requests():
            return refused
        data = request.get_json(silent=True)
        data = data if isinstance(data, dict) else {}
        approximate = "lat" not in data  # no GPS position: use the internet connection
        try:
            if approximate:
                country, region, area = ip_locator(request.access_route[0] if request.access_route else "")
            else:
                lat, lon = float(data["lat"]), float(data["lon"])
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    raise ValueError
                country, region, area = geocoder(lat, lon)
        except (KeyError, TypeError, ValueError):
            return jsonify(error="Invalid coordinates."), 400
        except GeoError as exc:
            return jsonify(error=str(exc)), 503
        if country not in COUNTRIES:
            return jsonify(error="Your country is not in the list yet. Please choose the closest one."), 404
        return jsonify(country=country, region=region, place=place_name(country, region),
                       languages=local_languages(country, area), approximate=approximate)

    @app.post("/api/chat")
    def chat():
        return model_answer(ChatRequest.from_dict, lambda req: assistant.chat(req).to_dict())

    @app.post("/api/phrases")
    def phrases():
        return model_answer(PhraseRequest.from_dict, phrasebook)

    @app.post("/api/essentials")
    def essential_phrases():
        if demo:
            return jsonify(error="Demo mode has no recorded essentials. Add LLM_API_KEY in .env for live answers."), 503
        return model_answer(Settings.from_dict, essentials)

    @app.get("/health")
    def health():
        return jsonify(status="ok", model=assistant.client.name)

    @app.after_request
    def add_security_headers(response):
        response.headers.update({k: v for k, v in SECURITY_HEADERS.items() if k not in response.headers})
        return response

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
