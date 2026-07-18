#!/usr/bin/env python3
"""Build data/clips.json from the ID3 titles in public/audio/*.mp3."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "audio"
OUTPUT = ROOT / "data" / "clips.json"
COLORS = ("orange", "lime", "sky")
NAME = re.compile(r"^ep(?P<episode>\d{3})-(?P<number>\d{2})\.mp3$")


def title_for(path: Path) -> str:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format_tags=title",
            "-of", "default=nw=1:nk=1", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    title = result.stdout.strip()
    if not title:
        raise SystemExit(f"ID3 title is missing: {path.name}")
    return title


clips = []
for index, path in enumerate(sorted(AUDIO_DIR.glob("*.mp3"))):
    match = NAME.match(path.name)
    if not match:
        raise SystemExit(f"Unexpected filename: {path.name}")
    clips.append(
        {
            "id": path.stem,
            "episode": int(match.group("episode")),
            "clipTitle": title_for(path),
            "color": COLORS[index % len(COLORS)],
            "audioUrl": f"/audio/{path.name}",
        }
    )

OUTPUT.write_text(json.dumps(clips, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(clips)} clips to {OUTPUT.relative_to(ROOT)}")
