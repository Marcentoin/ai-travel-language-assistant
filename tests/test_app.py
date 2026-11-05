from conftest import CHAT, ESSENTIALS, PHRASEBOOK, FakeClient, dump

from app import create_app
from geo import GeoError
from llm import DemoClient


def client_for(*answers, geocoder=None, ip_locator=None):
    app = create_app(FakeClient(*answers),
                     geocoder=geocoder or (lambda lat, lon: ("IN", "Tamil Nadu", "Tamil Nadu, Coimbatore")),
                     ip_locator=ip_locator or (lambda ip: ("ES", "Catalonia", "Catalonia")))
    return app.test_client()


def test_config_lists_countries_languages_and_topics():
    data = client_for().get("/api/config").get_json()
    assert data["countries"]["IN"]["name"] == "India" and data["languages"]["Tamil"] == "ta-IN"
    assert len(data["topics"]) == 12 and data["essentials"][0]["title"] == "Greetings and courtesy"


def test_api_returns_a_phrasebook():
    response = client_for(dump(PHRASEBOOK)).post("/api/phrases", json={"situation": "Ordering ramen", "language": "Japanese", "count": 3})
    assert response.status_code == 200
    assert response.get_json()["phrases"][1]["romanization"] == "Sumimasen, wakarimasen."


def test_topic_phrasebooks_are_cached():
    client = client_for(dump(PHRASEBOOK))  # a single model answer for two identical requests
    body = {"topic": "restaurant", "language": "Japanese", "country": "JP"}
    assert client.post("/api/phrases", json=body).status_code == 200
    assert client.post("/api/phrases", json=body).status_code == 200


def test_api_rejects_invalid_input():
    response = client_for().post("/api/phrases", json={"situation": "", "language": "Japanese"})
    assert response.status_code == 400 and "situation" in response.get_json()["error"]
    assert client_for().post("/api/chat", data="not json").status_code == 400


def test_chat_endpoint():
    response = client_for(dump(CHAT)).post("/api/chat", json={"message": "Help me order", "language": "Japanese"})
    data = response.get_json()
    assert response.status_code == 200 and data["reply"] and len(data["phrases"]) == 1 and data["demo"] is False


def test_essentials_endpoint():
    response = client_for(dump(ESSENTIALS)).post("/api/essentials", json={"language": "Japanese"})
    assert response.status_code == 200 and len(response.get_json()["phrases"]) == len(ESSENTIALS["phrases"])


def test_unusable_model_output_is_a_502():
    response = client_for("no json", "still no json").post("/api/chat", json={"message": "Hi", "language": "Thai"})
    assert response.status_code == 502


def test_locate_returns_the_local_languages():
    data = client_for().post("/api/locate", json={"lat": 11.0, "lon": 76.96}).get_json()
    assert data["place"] == "Tamil Nadu, India" and data["languages"][0] == "Tamil" and data["approximate"] is False


def test_locate_without_gps_uses_the_internet_connection():
    data = client_for().post("/api/locate", json={}).get_json()
    assert data["place"] == "Catalonia, Spain" and data["languages"][0] == "Catalan" and data["approximate"] is True


def test_locate_errors():
    def unreachable(lat, lon):
        raise GeoError("The location service is not reachable.")

    assert client_for().post("/api/locate", json={"lat": 200, "lon": 0}).status_code == 400
    assert client_for(geocoder=unreachable).post("/api/locate", json={"lat": 1, "lon": 1}).status_code == 503


def test_rate_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "2")
    client = client_for()
    codes = [client.post("/api/chat", json={}).status_code for _ in range(3)]
    assert codes == [400, 400, 429]


def test_demo_mode_replays_recorded_answers():
    client = create_app(DemoClient()).test_client()
    data = client.post("/api/chat", json={"message": "Help", "language": "Japanese"}).get_json()
    assert data["demo"] is True and data["phrases"]
    assert client.post("/api/essentials", json={"language": "Japanese"}).status_code == 503


def test_security_headers():
    headers = client_for().get("/").headers
    assert "default-src 'self'" in headers["Content-Security-Policy"] and headers["X-Content-Type-Options"] == "nosniff"


def test_model_client_retries_when_the_provider_is_busy(monkeypatch):
    import llm

    class Response:
        def __init__(self, status):
            self.status_code = status

        def raise_for_status(self):
            if self.status_code >= 400:
                raise llm.requests.HTTPError(str(self.status_code))

        def json(self):
            return {"choices": [{"message": {"content": "ok"}}]}

    statuses = [503, 503, 200]
    monkeypatch.setattr(llm.requests, "post", lambda *args, **kwargs: Response(statuses.pop(0)))
    monkeypatch.setattr(llm.time, "sleep", lambda seconds: None)
    client = llm.OpenAICompatibleClient("key", "https://example.test/v1", "model")
    assert client.complete([{"role": "user", "content": "hi"}]) == "ok"

    statuses[:] = [503, 503, 503]
    try:
        client.complete([{"role": "user", "content": "hi"}])
    except llm.LLMError as exc:
        assert "busy" in str(exc)
    else:
        raise AssertionError("a busy provider must raise LLMError")
