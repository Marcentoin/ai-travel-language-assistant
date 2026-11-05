"""Flask web application: HTML interface + JSON API."""
from flask import Flask, jsonify, render_template, request

from assistant import LANGUAGES, PhraseRequest, TravelLanguageAssistant
from llm import DemoClient, LLMError, get_client

EXAMPLES = [
    "Ordering food at a restaurant",
    "Asking for directions to the train station",
    "Checking in at a hotel",
    "Buying medicine at a pharmacy",
    "Taking a taxi to the airport",
]


def create_app(client=None) -> Flask:
    app = Flask(__name__)
    app.json.ensure_ascii = False  # keep native scripts readable in the JSON API
    assistant = TravelLanguageAssistant(client or get_client())

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            languages=LANGUAGES,
            examples=EXAMPLES,
            model=assistant.client.name,
            demo=isinstance(assistant.client, DemoClient),
        )

    @app.post("/api/phrases")
    def phrases():
        try:
            req = PhraseRequest.from_dict(request.get_json(silent=True) or {})
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        try:
            return jsonify(assistant.generate(req).to_dict())
        except LLMError as exc:
            return jsonify(error=str(exc)), 503
        except ValueError as exc:
            app.logger.warning("Invalid model output: %s", exc)
            return jsonify(error="The model gave an unusable answer. Please try again."), 502

    @app.get("/health")
    def health():
        return jsonify(status="ok", model=assistant.client.name)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
