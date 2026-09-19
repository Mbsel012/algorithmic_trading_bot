"""
Append-only time-series storage shared by the premium and pairs monitors.

Both strategies answer the same shape of question -- does an edge *persist*, or
did it show up once and vanish? -- and neither can answer it from a single
reading. So both log every observation here and report over the history.

Records are JSON Lines: one self-describing object per line, appended never
rewritten. That survives interruption, is readable with any text editor, and
needs no database. Stdlib only.
"""

import json
import os
from datetime import datetime, timezone

DEFAULT_DIR = os.path.join(os.path.expanduser("~"), ".arbitrage")


def default_path(name):
    """
    Location of a named log file inside the user's data directory.

    :param name: log name without extension, e.g. "premium".
    :return: absolute path to the .jsonl file.
    """
    return os.path.join(DEFAULT_DIR, f"{name}.jsonl")


def append(path, record):
    """
    Append one observation, stamping it with the current UTC time.

    An existing "ts" in the record is preserved, so historical data can be
    backfilled without being relabelled as today.

    :param path: destination .jsonl file; parent directories are created.
    :param record: JSON-serialisable dict.
    :return: the record as written, including its timestamp.
    """
    record = dict(record)
    record.setdefault("ts", datetime.now(timezone.utc).isoformat())
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "a+", encoding="utf-8") as handle:
        # A previous write cut short by a crash leaves a line with no newline.
        # Appending straight onto it would fuse the two records and destroy the
        # good one as well as the partial, so close the dangling line first.
        handle.seek(0, os.SEEK_END)
        if handle.tell():
            handle.seek(handle.tell() - 1)
            if handle.read(1) != "\n":
                handle.write("\n")
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return record


def load(path, limit=None):
    """
    Read observations back, oldest first.

    Malformed lines are skipped rather than raising: a truncated final write
    (power loss, Ctrl-C) must not make the whole history unreadable.

    :param path: .jsonl file to read; a missing file yields an empty list.
    :param limit: if given, return only the most recent N records.
    :return: list of dicts.
    """
    if not os.path.exists(path):
        return []
    records = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records[-limit:] if limit else records


def summary(path):
    """
    Describe what a log currently holds, without loading it into a report.

    :param path: .jsonl file to inspect.
    :return: dict with count, first and last timestamps, and the path.
    """
    records = load(path)
    return {
        "path": path,
        "count": len(records),
        "first": records[0].get("ts") if records else None,
        "last": records[-1].get("ts") if records else None,
    }
