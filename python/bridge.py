#!/usr/bin/env python3
import sys
import json
import argparse
import subprocess
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import license as lic

TRANSCRIBE_SCRIPT = os.path.join(os.path.dirname(__file__), "transcribe.py")


def cmd_transcribe(file_path, model=None):
    python = os.getenv("PYTHON_PATH") or "python"
    cmd = [python, TRANSCRIBE_SCRIPT, "--file", file_path]
    if model:
        cmd += ["--model", model]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {"error": proc.stderr or proc.stdout}
    try:
        return json.loads(proc.stdout)
    except Exception as e:
        return {"error": f"invalid json from transcribe script: {e}", "raw": proc.stdout}


def cmd_check_license():
    return {
        "is_pro": lic.is_pro(),
        "export_unlocked": lic.has_export_unlocked(),
        "remaining_free_seconds": lic.get_remaining_free_seconds(),
    }


def cmd_activate(key):
    ok = lic.activate_license(key)
    return {"ok": ok}


def cmd_issue_admin(key, issued_to=None):
    ok = lic.issue_admin_key(key, issued_to)
    return {"ok": ok}


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")

    t = sub.add_parser("transcribe")
    t.add_argument("--file", required=True)
    t.add_argument("--model", required=False)

    c = sub.add_parser("check_license")

    a = sub.add_parser("activate")
    a.add_argument("--key", required=True)

    i = sub.add_parser("issue_admin")
    i.add_argument("--key", required=True)
    i.add_argument("--issued_to", required=False)

    g = sub.add_parser("get_admin_keys")

    args = p.parse_args()
    if args.cmd == "transcribe":
        out = cmd_transcribe(args.file, getattr(args, "model", None))
        print(json.dumps(out))
    elif args.cmd == "check_license":
        out = cmd_check_license()
        print(json.dumps(out))
    elif args.cmd == "activate":
        out = cmd_activate(args.key)
        print(json.dumps(out))
    elif args.cmd == "issue_admin":
        out = cmd_issue_admin(args.key, getattr(args, "issued_to", None))
        print(json.dumps(out))
    elif args.cmd == "get_admin_keys":
        out = {"keys": []}
        try:
            out["keys"] = lic.get_admin_keys()
        except Exception:
            out["error"] = "failed to load admin keys"
        print(json.dumps(out))
    else:
        p.print_help()

if __name__ == "__main__":
    main()
