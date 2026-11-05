import pytest
import requests

import geo
from catalog import local_languages

# Shortened real Nominatim answers (zoom=8, accept-language=en)
COIMBATORE = {"address": {"county": "Coimbatore North", "state_district": "Coimbatore", "state": "Tamil Nadu",
                          "country": "India", "country_code": "in"}}
BOLZANO = {"address": {"county": "South Tyrol", "state": "Trentino – Alto Adige/Südtirol", "country": "Italy", "country_code": "it"}}


class FakeResponse:
    ok = True

    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


def test_region_and_area_are_extracted(monkeypatch):
    monkeypatch.setattr(geo.requests, "get", lambda *args, **kwargs: FakeResponse(COIMBATORE))
    assert geo.reverse_geocode(11.0168, 76.9558) == ("IN", "Tamil Nadu", "Tamil Nadu, Coimbatore, Coimbatore North")


def test_county_names_select_the_regional_language(monkeypatch):
    monkeypatch.setattr(geo.requests, "get", lambda *args, **kwargs: FakeResponse(BOLZANO))
    country, region, area = geo.reverse_geocode(46.498, 11.354)
    assert (country, region) == ("IT", "Trentino – Alto Adige/Südtirol") and local_languages(country, area)[0] == "German"


def test_position_is_rounded_and_the_app_identifies_itself(monkeypatch):
    seen = {}

    def fake_get(url, params, headers, timeout):
        seen.update(params=params, headers=headers)
        return FakeResponse(COIMBATORE)

    monkeypatch.setattr(geo.requests, "get", fake_get)
    geo.reverse_geocode(11.016844, 76.955832)
    assert (seen["params"]["lat"], seen["params"]["lon"]) == (11.017, 76.956)
    assert "ai-travel-language-assistant" in seen["headers"]["User-Agent"]


@pytest.mark.parametrize("failure", [requests.ConnectionError("offline"), {"error": "Unable to geocode"}])
def test_failures_raise_geo_error(monkeypatch, failure):
    def fake_get(*args, **kwargs):
        if isinstance(failure, Exception):
            raise failure
        return FakeResponse(failure)

    monkeypatch.setattr(geo.requests, "get", fake_get)
    with pytest.raises(geo.GeoError):
        geo.reverse_geocode(0, -30)


def test_ip_location_falls_back_to_the_second_service(monkeypatch):
    calls = []

    def fake_get(url, headers, timeout):
        calls.append(url)
        if "ipinfo" in url:
            raise requests.Timeout("slow")
        return FakeResponse({"country_code": "in", "region": "Tamil Nadu"})

    monkeypatch.setattr(geo.requests, "get", fake_get)
    assert geo.locate_ip("127.0.0.1") == ("IN", "Tamil Nadu", "Tamil Nadu")
    assert calls == ["https://ipinfo.io/json", "https://ipapi.co/json/"]  # a private address is not sent


def test_ip_location_of_a_public_address(monkeypatch):
    seen = []
    monkeypatch.setattr(geo.requests, "get", lambda url, **kwargs: seen.append(url) or FakeResponse({"country": "JP", "region": "Tokyo"}))
    assert geo.locate_ip("8.8.8.8")[:2] == ("JP", "Tokyo") and seen == ["https://ipinfo.io/8.8.8.8/json"]


def test_ip_location_failure(monkeypatch):
    monkeypatch.setattr(geo.requests, "get", lambda url, **kwargs: FakeResponse({"error": "rate limited"}))
    with pytest.raises(geo.GeoError):
        geo.locate_ip("")
