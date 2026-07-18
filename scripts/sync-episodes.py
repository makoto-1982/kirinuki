#!/usr/bin/env python3
"""Sync 10+ minute numbered episodes from the official Megaphone RSS feed."""

import csv
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_URL = "https://feeds.megaphone.fm/TBS1798776830"
APPLE_LOOKUP_URL = "https://itunes.apple.com/lookup?id=1680512344&entity=podcastEpisode&limit=200"
ITUNES = "http://www.itunes.com/dtds/podcast-1.0.dtd"
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def seconds(value: str) -> int:
    if ":" not in value:
        return int(value or 0)
    parts = [int(part) for part in value.split(":")]
    return sum(part * (60 ** power) for power, part in enumerate(reversed(parts)))


def clean_title(full_title: str, episode: int) -> str:
    title = re.sub(rf"^#{episode}\s*[「『]?", "", full_title).strip()
    title = re.sub(r"[」』]?\s*(?:-|–|—)?\s*カラタチの最果てのセンセイ！\s*$", "", title).strip()
    return title.strip("「」『』 ")


with urllib.request.urlopen(FEED_URL, timeout=30) as response:
    root = ET.fromstring(response.read())

with urllib.request.urlopen(APPLE_LOOKUP_URL, timeout=30) as response:
    apple_results = json.loads(response.read())["results"]

apple_urls = {
    item["episodeGuid"]: item["trackViewUrl"].replace("podcasts.apple.com/us/", "podcasts.apple.com/jp/")
    for item in apple_results
    if item.get("kind") == "podcast-episode" and item.get("episodeGuid") and item.get("trackViewUrl")
}

episodes = []
for item in root.findall("./channel/item"):
    full_title = (item.findtext("title") or "").strip()
    match = re.match(r"^#(\d+)", full_title)
    duration = seconds(item.findtext(f"{{{ITUNES}}}duration") or "0")
    if not match or duration < 600:
        continue

    number = int(match.group(1))
    published = parsedate_to_datetime(item.findtext("pubDate") or "").date().isoformat()
    enclosure = item.find("enclosure")
    guid = item.findtext("guid") or ""
    episodes.append({
        "episode": number,
        "title": clean_title(full_title, number),
        "publishedAt": published,
        "durationSeconds": duration,
        "durationMinutes": round(duration / 60),
        "guid": guid,
        "audioUrl": enclosure.get("url", "") if enclosure is not None else "",
        "appleUrl": apple_urls.get(guid, ""),
    })

episodes.sort(key=lambda episode: episode["episode"])
DATA_DIR.mkdir(parents=True, exist_ok=True)

(DATA_DIR / "episodes.json").write_text(
    json.dumps(episodes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

with (DATA_DIR / "episodes.csv").open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=episodes[0].keys())
    writer.writeheader()
    writer.writerows(episodes)

expected = list(range(1, max(item["episode"] for item in episodes) + 1))
actual = [item["episode"] for item in episodes]
if actual != expected:
    raise SystemExit("Episode numbers contain gaps or duplicates; review the generated files.")
if any(not item["appleUrl"] for item in episodes):
    raise SystemExit("One or more Apple Podcasts episode URLs could not be matched.")

print(f"Synced {len(episodes)} episodes ({actual[0]}-{actual[-1]}) at {datetime.now().isoformat(timespec='seconds')}")
