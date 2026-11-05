"""Static content: languages, countries with their local languages, essentials and phrasebook topics."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

DATA = Path(__file__).with_name("data")
# name -> {"code": BCP-47 code for speech synthesis, "script": Unicode script names of the native script}
LANGUAGES: dict[str, dict] = json.loads((DATA / "languages.json").read_text(encoding="utf-8"))
# ISO code -> {"name", "languages" (most useful first), "regions" (optional: "A|B" -> languages spoken first there)}
COUNTRIES: dict[str, dict] = json.loads((DATA / "countries.json").read_text(encoding="utf-8"))

ESSENTIALS = {
    "Greetings and courtesy": ["Hello", "Goodbye", "Please", "Thank you", "You're welcome", "Excuse me", "Sorry", "Yes", "No"],
    "Understanding each other": ["Do you speak English?", "I don't understand.", "Could you say that again slowly?",
                                 "Could you write it down, please?"],
    "Getting by": ["Where is the toilet?", "How much is it?", "I would like this, please.", "The bill, please.",
                   "How do I get to this address?", "One, two, three, four, five, six, seven, eight, nine, ten"],
    "Emergencies": ["Help!", "Call the police!", "I need a doctor.", "I am lost."],
}
ESSENTIAL_PHRASES = [phrase for group in ESSENTIALS.values() for phrase in group]

TOPICS = {  # id -> (icon, label, situation sent to the model)
    "restaurant": ("🍽️", "Restaurant & food", "Ordering food and drinks at a restaurant, dietary needs and paying the bill"),
    "transport": ("🚕", "Taxi & transport", "Taking a taxi, bus or train: destination, tickets, price and stops"),
    "hotel": ("🏨", "Hotel", "Checking in and out of a hotel, asking for things and reporting a problem"),
    "directions": ("🧭", "Directions", "Asking for directions and understanding simple answers"),
    "shopping": ("🛍️", "Shopping & markets", "Shopping in stores and markets: sizes, prices and bargaining"),
    "health": ("💊", "Pharmacy & doctor", "Buying medicine at a pharmacy and describing symptoms to a doctor"),
    "emergency": ("🚨", "Emergencies", "Emergencies: asking for help, calling the police or an ambulance, reporting a theft"),
    "money": ("💳", "Money & payments", "Paying by card or cash, exchanging money and using a cash machine"),
    "social": ("👋", "Small talk", "Introducing yourself, saying where you are from and making friends"),
    "sightseeing": ("🏛️", "Sightseeing", "Visiting museums and sights: tickets, opening hours and taking photos"),
    "airport": ("✈️", "Airport", "At the airport: check-in, baggage, security and customs"),
    "phone": ("📶", "Phone & internet", "Buying a SIM card, asking for the wifi password and charging a phone"),
}


def normalize(text: str) -> str:
    """Lower-case ASCII words only: "Graubünden" -> "graubunden", "KwaZulu-Natal" -> "kwazulu natal"."""
    text = "".join(ch for ch in unicodedata.normalize("NFKD", text or "") if not unicodedata.combining(ch))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def local_languages(country: str, region: str = "") -> list[str]:
    """Languages spoken where the traveller is, most useful first (the region's own languages lead)."""
    info = COUNTRIES.get(str(country or "").upper())
    if not info:
        return []
    place = normalize(region)
    first = next(
        (languages for names, languages in info.get("regions", {}).items()
         if any(re.search(rf"\b{re.escape(normalize(name))}\b", place) for name in names.split("|"))),
        [],
    )
    return list(dict.fromkeys(first + info["languages"]))


def place_name(country: str | None, region: str | None = "") -> str:
    """Readable location such as "Tamil Nadu, India" ("" for an unknown country)."""
    info = COUNTRIES.get(str(country or "").upper())
    if not info:
        return ""
    region = re.sub(r"[^\w\s,.'-]", "", str(region or ""))[:80].strip(" ,")
    return f"{region}, {info['name']}" if region else info["name"]
