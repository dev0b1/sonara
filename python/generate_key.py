#!/usr/bin/env python3
"""Generate SONARA admin keys.

Usage:
  python generate_key.py [--export] [--append]

"""
import uuid
import argparse
import json
from pathlib import Path


def make_key(export=False):
    base = uuid.uuid4().hex[:20].upper()
    key = f"SONARA-{base}"
    if export:
        key = f"SONARA-EXPORT-{base}"
    return key


def append_to_admin(key):
    p = Path(__file__).resolve().parent / "admin_keys.json"
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        data = []
    data.append(key)
    p.write_text(json.dumps(data, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--export', action='store_true')
    parser.add_argument('--append', action='store_true')
    args = parser.parse_args()
    key = make_key(export=args.export)
    print(key)
    if args.append:
        append_to_admin(key)
        print("Appended to admin_keys.json")


if __name__ == '__main__':
    main()
