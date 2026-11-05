"""Automatic evaluation on a benchmark of 10 travel situations in 10 languages.

    python evaluate.py                                # query the live model (needs LLM_API_KEY)
    python evaluate.py --responses demo_responses.json  # score recorded answers

Writes results/eval_results.json, results/eval_summary.md and results/eval_chart.png.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from assistant import PhraseRequest, build_messages, is_latin, parse_phrasebook, uses_native_script
from catalog import LANGUAGES
from llm import DemoClient, get_client

BENCHMARK = [
    ("Ordering food at a ramen restaurant", "Japanese"),
    ("Asking for directions to the train station", "French"),
    ("Checking in at a hotel with a booking", "Spanish"),
    ("Buying a regional train ticket at the counter", "German"),
    ("Buying medicine for a headache at a pharmacy", "Italian"),
    ("Bargaining for a souvenir at a street market", "Hindi"),
    ("Taking an auto-rickshaw to the bus stand", "Tamil"),
    ("Asking for another size in a clothes shop", "Korean"),
    ("Going through customs at the airport", "Mandarin Chinese"),
    ("Reporting a lost passport at the police station", "Thai"),
]
METRICS = {
    "valid_json": "Valid JSON",
    "complete": "All fields filled",
    "count_ok": "Requested number of phrases",
    "native_script": "Translation in native script",
    "latin_romanization": "Romanization in Latin letters",
    "readable_pronunciation": "Latin-letter pronunciation",
    "tips_ok": "2 cultural tips",
}
OUT = Path("results")


def score(raw: str, req: PhraseRequest) -> dict:
    try:
        book = parse_phrasebook(raw, req)
    except ValueError:
        return {metric: False for metric in METRICS}
    non_latin = LANGUAGES[req.language]["script"] != ["LATIN"]
    return {
        "valid_json": True,
        "complete": all(p.english and p.translation and p.pronunciation and (p.romanization or not non_latin) for p in book.phrases),
        "count_ok": len(book.phrases) == req.count,
        "native_script": all(uses_native_script(p.translation, req.language) for p in book.phrases),
        "latin_romanization": all(is_latin(p.romanization) for p in book.phrases),
        "readable_pronunciation": all(is_latin(p.pronunciation) for p in book.phrases),
        "tips_ok": len(book.tips) >= 2,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--responses", help="JSON file {language: raw model answer} to score instead of calling the model")
    args = parser.parse_args()

    recorded = json.loads(Path(args.responses).read_text(encoding="utf-8")) if args.responses else None
    client = None if recorded else get_client()
    if isinstance(client, DemoClient):
        raise SystemExit("Set LLM_API_KEY to evaluate the live model, or use --responses.")

    rows = []
    for situation, language in BENCHMARK:
        req = PhraseRequest(situation, language, "polite", 6)
        started = time.perf_counter()
        raw = recorded.get(language, "") if recorded else client.complete(build_messages(req))
        latency = None if recorded else round(time.perf_counter() - started, 2)
        rows.append({"situation": situation, "language": language, "latency_s": latency, **score(raw, req)})
        print(f"{language:<17} " + " ".join("✓" if rows[-1][m] else "✗" for m in METRICS))

    summary = {m: round(100 * sum(r[m] for r in rows) / len(rows)) for m in METRICS}
    OUT.mkdir(exist_ok=True)
    (OUT / "eval_results.json").write_text(json.dumps({"summary_percent": summary, "cases": rows}, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["| Metric | Pass rate |", "|---|---|"] + [f"| {METRICS[m]} | {v} % |" for m, v in summary.items()]
    (OUT / "eval_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))

    try:  # optional chart
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(7, 3.5))
        ax.barh(list(METRICS.values())[::-1], list(summary.values())[::-1], color="#0f6e6e")
        ax.set_xlim(0, 100)
        ax.set_xlabel("Pass rate on the 10-case benchmark (%)")
        fig.tight_layout()
        fig.savefig(OUT / "eval_chart.png", dpi=110)
    except ImportError:
        pass


if __name__ == "__main__":
    main()
