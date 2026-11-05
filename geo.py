"""Reverse geocoding: GPS coordinates -> country code and region, with OpenStreetMap Nominatim."""
from __future__ import annotations

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
# Nominatim's usage policy asks every application to identify itself.
USER_AGENT = "ai-travel-language-assistant/2.0 (+https://github.com/Marcentoin/ai-travel-language-assistant)"


class GeoError(RuntimeError):
    """The position could not be turned into a country."""


def reverse_geocode(lat: float, lon: float) -> tuple[str, str, str]:
    """Return (ISO country code, region, every area name) for a position.

    e.g. ("IN", "Tamil Nadu", "Tamil Nadu, Coimbatore, Coimbatore North"): the region is shown to the user,
    all the area names are used to find the local languages (South Tyrol is a county inside an Italian region).
    """
    try:
        response = requests.get(
            NOMINATIM_URL,
            # ~100 m precision is enough to find the region and keeps the exact position private
            params={"lat": round(lat, 3), "lon": round(lon, 3), "format": "jsonv2", "zoom": 8, "accept-language": "en"},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        address = response.json().get("address") or {}
    except (requests.RequestException, ValueError, AttributeError) as exc:
        raise GeoError("The location service is not reachable. Please choose your country in the list.") from exc
    country = str(address.get("country_code", "")).upper()
    if not country:
        raise GeoError("No country was found at your position. Please choose your country in the list.")
    names = [address[key] for key in ("state", "region", "province", "state_district", "county") if address.get(key)]
    return country, (names[0] if names else ""), ", ".join(dict.fromkeys(names))
