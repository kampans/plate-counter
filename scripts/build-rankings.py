"""Build ranking cohorts from an OpenPowerlifting CSV or ZIP."""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timedelta, timezone
import gzip
import io
import json
import math
from pathlib import Path
import random
import re
from contextlib import contextmanager
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
CATEGORY_CEILINGS = [(18, "SJ"), (23, "JR"), (39, "OPEN"), (49, "M1"), (59, "M2"), (69, "M3")]
DOTS = {
    "M": (210, [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076]),
    "F": (150, [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288]),
}
GL = {"M": (1199.72839, 1025.18162, 0.00921), "F": (610.32796, 1045.59282, 0.03048)}


@contextmanager
def open_csv(path):
    if path.suffix.lower() == ".zip":
        with ZipFile(path) as archive:
            names = [name for name in archive.namelist() if name.endswith(".csv")]
            if len(names) != 1:
                raise ValueError("Expected exactly one CSV in the OpenPowerlifting ZIP")
            print(f"Reading {names[0]}")
            with archive.open(names[0]) as source, io.TextIOWrapper(source, encoding="utf-8-sig", newline="") as stream:
                yield stream, names[0]
    else:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            yield stream, path.name


def months_ago(day, months):
    year, month = divmod(day.year * 12 + day.month - 1 - months, 12)
    first_next_month = day.replace(year=year + (month == 11), month=(month + 1) % 12 + 1, day=1)
    return first_next_month.replace(
        year=year, month=month + 1, day=min(day.day, (first_next_month - timedelta(days=1)).day)
    )


def number(text):
    try:
        value = float(text)
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None


def category(age):
    if age < 14:
        return None
    return next((name for limit, name in CATEGORY_CEILINGS if age <= limit), "M4")


def row_category(row):
    year_class = re.fullmatch(r"(\d+)(?:-(\d+)|(\+))", row["BirthYearClass"])
    if year_class:
        low = int(year_class[1])
        high = int(year_class[2]) if year_class[2] else math.inf
        if category(low) == category(high):
            return category(low)
    age = number(row["Age"])
    if age is not None and category(math.floor(age)) == category(math.ceil(age)):
        return category(math.floor(age))
    return None


def score100(value):
    return math.floor(value * 100 + 0.5)


def validate_scores(rows, column):
    sample = random.Random(19).sample(rows, min(200, len(rows)))
    if not sample:
        raise ValueError(f"No rows available to validate {column}")
    matches = 0
    for row in sample:
        sex, bw, total = row["Sex"], float(row["BodyweightKg"]), float(row["TotalKg"])
        if column == "Dots":
            upper, coefficients = DOTS[sex]
            weight = min(max(bw, 40), upper)
            denominator = 0
            for coefficient in coefficients:
                denominator = denominator * weight + coefficient
            expected = total * 500 / denominator
        else:
            a, b, c = GL[sex]
            expected = total * 100 / (a - b * math.exp(-c * bw))
        matches += abs(score100(expected) - score100(float(row[column]))) <= 1
    print(f"{column} validation: {matches}/{len(sample)} within 0.01")
    if matches / len(sample) < 0.99:
        raise ValueError(f"{column} validation failed")


def build(source, settings, output, dedupe, now):
    since = months_ago(now.date(), settings["windowYears"] * 12).isoformat()
    recent = months_ago(now.date(), settings["maxMonthsSinceLastMeet"]).isoformat()
    until = now.date().isoformat()
    index = {code: fed for fed in settings["federations"] for code in fed["oplCodes"]}
    rows = defaultdict(list)
    places = Counter()
    year_classes = Counter()
    alias_meets = Counter()

    with open_csv(source) as (stream, source_name):
        reader = csv.DictReader(stream)
        required = set(
            "Name Sex Event Equipment Age BirthYearClass BodyweightKg TotalKg Place Dots Goodlift "
            "Federation Date MeetName Best3SquatKg Best3BenchKg Best3DeadliftKg".split()
        )
        if missing := required.difference(reader.fieldnames or ()):
            raise ValueError(f"Missing OpenPowerlifting columns: {', '.join(sorted(missing))}")
        for row in reader:
            code = row["Federation"]
            fed = index.get(code)
            if fed is None:
                continue
            prefix = fed.get("meetNamePrefixByCode", {}).get(code)
            if prefix:
                alias_meets[(code, row["MeetName"])] += 1
                if not row["MeetName"].casefold().startswith(prefix.casefold()):
                    continue
            if row["Event"] != "SBD" or row["Sex"] not in DOTS or not since <= row["Date"] <= until:
                continue
            place = row["Place"]
            places[place] += 1
            year_classes[row["BirthYearClass"]] += 1
            if place != "G" and (not place.isdecimal() or int(place) < 1):
                continue
            if (number(row["TotalKg"]) or 0) <= 0 or number(row["Dots"]) is None:
                continue
            row["category"] = row_category(row)
            rows[fed["id"]].append(row)

    print("Alias meets:", dict(alias_meets))
    print("Place values:", ", ".join(sorted(places)))
    print("BirthYearClass values:", ", ".join(repr(key) for key in sorted(year_classes)))
    print("Federation | Lifters | Rows | Last meet | Usable age | Equipment mix")

    snapshot = re.search(r"openpowerlifting-(\d{4}-\d{2}-\d{2})", source_name)
    manifest = {
        "builtAt": now.isoformat(timespec="seconds"),
        "dataAsOf": snapshot[1] if snapshot else until,
        "federations": [],
    }
    files = {}
    validation = []
    for fed in settings["federations"]:
        entries = rows[fed["id"]]
        unique = len({entry["Name"] for entry in entries})
        latest = max((entry["Date"] for entry in entries), default="")
        coverage = sum(entry["category"] is not None for entry in entries) / max(1, len(entries))
        equipment = Counter(entry["Equipment"] for entry in entries)
        print(f"{fed['label']} | {unique} | {len(entries)} | {latest or '-'} | {coverage:.1%} | {dict(equipment)}")
        if unique < settings["minUniqueLifters"] or latest < recent:
            print(f"  Skipped (requires {settings['minUniqueLifters']} lifters and a meet since {recent})")
            continue

        validation.extend(entries)
        best = {}
        for entry in entries:
            key = (entry["Name"], entry["Equipment"])
            order = (float(entry["Dots"]), entry["Date"])
            if dedupe == "latest":
                order = order[::-1]
            if key not in best or order > best[key][0]:
                best[key] = (order, entry)

        cohorts = defaultdict(lambda: {"dots": [], "gl": []})
        lifters = []
        for _, entry in best.values():
            lifter_index = len(lifters)
            lifters.append({
                "name": entry["Name"],
                "bodyweight": number(entry["BodyweightKg"]),
                "squat": number(entry["Best3SquatKg"]),
                "bench": number(entry["Best3BenchKg"]),
                "deadlift": number(entry["Best3DeadliftKg"]),
                "total": number(entry["TotalKg"]),
            })
            categories = ["ALL"] + ([entry["category"]] if entry["category"] else [])
            for age in categories:
                cohort = cohorts[f"{entry['Sex']}|{entry['Equipment']}|{age}"]
                cohort["dots"].append((score100(float(entry["Dots"])), lifter_index))
                goodlift = number(entry["Goodlift"])
                if goodlift is not None:
                    cohort["gl"].append((score100(goodlift), lifter_index))
        for cohort in cohorts.values():
            for metric in ("dots", "gl"):
                ordered = sorted(cohort[metric])
                cohort[metric] = [score for score, _ in ordered]
                cohort[f"{metric}Lifters"] = [index for _, index in ordered]

        base = {"id": fed["id"], "label": fed["label"], "builtAt": manifest["builtAt"], "uniqueLifters": unique}
        data = dict(base, window={"since": since}, dedupe=f"{dedupe}-per-lifter-per-equipment",
                    lastMeet=latest, coverage={"ageCategory": coverage}, equipment=sorted(equipment),
                    cohorts=cohorts, lifters=lifters)
        filename = f"{fed['id']}.json"
        content = json.dumps(data, separators=(",", ":")).encode()
        if len(gzip.compress(content)) > 1_000_000:
            print(f"  Warning: {filename} exceeds 1 MB gzipped")
        files[filename] = content
        manifest["federations"].append(dict(
            base, file=filename, size=len(content), ageReliable=coverage >= 0.6,
            defaultAllAges=fed.get("defaultAllAges", False),
        ))

    if not files:
        raise ValueError("No federations met the configured ranking thresholds")
    usable = [row for row in validation if (number(row["BodyweightKg"]) or 0) > 0]
    validate_scores(usable, "Dots")
    validate_scores([row for row in usable if row["Equipment"] == "Raw" and number(row["Goodlift"]) is not None], "Goodlift")

    output.mkdir(parents=True, exist_ok=True)
    for filename, content in files.items():
        (output / filename).write_bytes(content)
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--config", type=Path, default=ROOT / "config/federations.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data/rankings")
    parser.add_argument("--dedupe", choices=("best", "latest"), default="best")
    args = parser.parse_args()
    build(args.source, json.loads(args.config.read_text(encoding="utf-8-sig")), args.output,
          args.dedupe, datetime.now(timezone.utc))
