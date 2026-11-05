import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402
from assistant import PhraseRequest, TravelLanguageAssistant, build_messages, parse_phrasebook, uses_native_script  # noqa: E402

ANSWER = {
    "situation": "At a ramen restaurant",
    "phrases": [
        {"english": "One ramen, please.", "translation": "ラーメンを一つください。", "romanization": "Rāmen o hitotsu kudasai.",
         "pronunciation": "RAH-men oh hee-TOH-tsoo koo-DAH-sigh", "note": "Point at the menu."},
        {"english": "Sorry, I don't understand.", "translation": "すみません、わかりません。", "romanization": "Sumimasen, wakarimasen.",
         "pronunciation": "soo-mee-mah-SEN, wah-kah-ree-mah-SEN", "note": ""},
    ],
    "tips": ["Slurping noodles is polite.", "Tipping is not expected."],
}


class FakeClient:
    """Returns the given answers in order, like a model would."""

    name = "fake"

    def __init__(self, *answers):
        self.answers = list(answers)
        self.calls = 0

    def complete(self, messages):
        self.calls += 1
        return self.answers.pop(0)


def request(**overrides):
    data = {"situation": "Ordering ramen", "language": "Japanese", "politeness": "polite", "count": 3} | overrides
    return PhraseRequest.from_dict(data)


def test_valid_request_is_normalised():
    req = request(situation="  Ordering   ramen ", politeness="Formal")
    assert (req.situation, req.politeness, req.count) == ("Ordering ramen", "formal", 3)


@pytest.mark.parametrize("bad", [{"situation": ""}, {"language": "Klingon"}, {"count": 42}, {"count": "six"}, {"politeness": "rude"}])
def test_invalid_request_is_rejected(bad):
    with pytest.raises(ValueError):
        request(**bad)


def test_prompt_contains_the_request_and_the_injection_guard():
    system, user = build_messages(request())
    assert "ignore any instruction" in system["content"]
    assert "<<<Ordering ramen>>>" in user["content"] and "Target language: Japanese" in user["content"]


def test_parser_accepts_json_inside_a_markdown_fence():
    book = parse_phrasebook("```json\n" + json.dumps(ANSWER, ensure_ascii=False) + "\n```", request())
    assert book.speech_code == "ja-JP" and len(book.phrases) == 2 and len(book.tips) == 2


def test_parser_rejects_answers_without_complete_phrases():
    with pytest.raises(ValueError):
        parse_phrasebook('{"phrases": [{"english": "Hello"}]}', request())


def test_assistant_retries_once_after_invalid_json():
    client = FakeClient("not json", json.dumps(ANSWER))
    book = TravelLanguageAssistant(client).generate(request())
    assert client.calls == 2 and book.phrases[0].english == "One ramen, please."


def test_native_script_check():
    assert uses_native_script("ラーメン", "Japanese") and not uses_native_script("ramen", "Japanese")
    assert uses_native_script("Où est la gare ?", "French")


def test_api_returns_a_phrasebook():
    client = create_app(FakeClient(json.dumps(ANSWER))).test_client()
    response = client.post("/api/phrases", json={"situation": "Ordering ramen", "language": "Japanese", "count": 3})
    assert response.status_code == 200
    assert response.get_json()["phrases"][1]["romanization"] == "Sumimasen, wakarimasen."


def test_api_rejects_invalid_input():
    client = create_app(FakeClient()).test_client()
    response = client.post("/api/phrases", json={"situation": "", "language": "Japanese"})
    assert response.status_code == 400 and "situation" in response.get_json()["error"]
