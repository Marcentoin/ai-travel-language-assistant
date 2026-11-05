import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalog import ESSENTIAL_PHRASES  # noqa: E402

PHRASES = [
    {"english": "One ramen, please.", "translation": "ラーメンを一つください。", "romanization": "Rāmen o hitotsu kudasai.",
     "pronunciation": "RAH-men oh hee-TOH-tsoo koo-DAH-sigh", "note": "Point at the menu."},
    {"english": "Sorry, I don't understand.", "translation": "すみません、わかりません。", "romanization": "Sumimasen, wakarimasen.",
     "pronunciation": "soo-mee-mah-SEN, wah-kah-ree-mah-SEN", "note": ""},
]
PHRASEBOOK = {"situation": "At a ramen restaurant", "phrases": PHRASES, "tips": ["Slurping noodles is polite.", "Tipping is not expected."]}
CHAT = {"reply": "Point at the menu and use these.", "phrases": PHRASES[:1], "tips": []}
ESSENTIALS = {"phrases": [{"english": text, "translation": "はい", "romanization": "hai", "pronunciation": "HIGH", "note": ""}
                          for text in ESSENTIAL_PHRASES]}


def dump(answer: dict) -> str:
    return json.dumps(answer, ensure_ascii=False)


class FakeClient:
    """Returns the given answers in order and records the messages it received, like a model would."""

    name = "fake"

    def __init__(self, *answers):
        self.answers = list(answers)
        self.calls: list[list[dict]] = []

    def complete(self, messages):
        self.calls.append(messages)
        return self.answers.pop(0)
