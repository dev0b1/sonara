#!/usr/bin/env python3
import sys
import json
import argparse
import subprocess
import os
import soundfile as sf

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import license as lic

TRANSCRIBE_SCRIPT = os.path.join(os.path.dirname(__file__), "transcribe.py")


def _run_subprocess_hidden(cmd, **kwargs):
    """On Windows, avoid a flashing console when `bridge.py` spawns the transcribe worker."""
    if sys.platform == "win32":
        cf = kwargs.pop("creationflags", 0)
        try:
            no_win = subprocess.CREATE_NO_WINDOW
        except AttributeError:
            no_win = 0x08000000
        kwargs["creationflags"] = cf | no_win
    return subprocess.run(cmd, **kwargs)


def cmd_transcribe(file_path, model=None):
    # Enforce free daily limit and pro max upload limit (best-effort duration read).
    try:
        info = sf.info(file_path)
        duration_seconds = float(info.frames) / float(info.samplerate)
    except Exception:
        duration_seconds = None

    if duration_seconds is not None:
        pro_limit = lic.get_pro_upload_limit_seconds()
        pro_h = max(1, int(pro_limit // 3600))
        if lic.is_pro():
            if duration_seconds > pro_limit:
                return {
                    "error": f"This file exceeds the Lifetime Pro upload limit ({pro_h} hours per file). Split the file or contact support.",
                    "duration": duration_seconds,
                }
        else:
            remaining = lic.get_remaining_free_seconds()
            if duration_seconds > remaining:
                return {
                    "error": "Free daily limit reached.",
                    "error_code": "FREE_DAILY_LIMIT",
                    "duration": duration_seconds,
                    "remaining_free_seconds": remaining,
                    "free_daily_limit_seconds": lic.FREE_LIMIT_SECONDS,
                    "pro_upload_limit_seconds": pro_limit,
                }

    # Use the same interpreter as this process (Rust usually starts `pythonw`, so this stays `pythonw`).
    # A bare "python" string would resolve to python.exe and can flash a console even with CREATE_NO_WINDOW.
    python = os.getenv("PYTHON_PATH") or sys.executable
    cmd = [python, TRANSCRIBE_SCRIPT, "--file", file_path]
    if model:
        cmd += ["--model", model]
    proc = _run_subprocess_hidden(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {"error": proc.stderr or proc.stdout}
    try:
        out = json.loads(proc.stdout)
        # Count usage against today's free allowance.
        try:
            if (not lic.is_pro()) and out and out.get("duration"):
                lic.add_used_seconds(int(float(out["duration"])))
        except Exception:
            pass
        return out
    except Exception as e:
        return {"error": f"invalid json from transcribe script: {e}", "raw": proc.stdout}


def cmd_probe_duration(file_path):
    """Fast duration read for UI ETA (same logic as transcribe pre-check)."""
    try:
        info = sf.info(file_path)
        duration_seconds = float(info.frames) / float(info.samplerate)
        return {"duration_seconds": duration_seconds}
    except Exception as e:
        return {"error": str(e)}


def cmd_check_license():
    return {
        "is_pro": lic.is_pro(),
        "tier": lic.get_tier(),
        "export_unlocked": lic.has_export_unlocked(),
        "remaining_free_seconds": lic.get_remaining_free_seconds(),
    }


def cmd_activate(key):
    return lic.activate_license(key)


def cmd_issue_admin(key, issued_to=None):
    ok = lic.issue_admin_key(key, issued_to)
    return {"ok": ok}

def cmd_reset_license():
    lic.reset_for_testing()
    return {"ok": True}


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

    pd = sub.add_parser("probe_duration")
    pd.add_argument("--file", required=True)

    rl = sub.add_parser("reset_license")

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
    elif args.cmd == "probe_duration":
        out = cmd_probe_duration(args.file)
        print(json.dumps(out))
    elif args.cmd == "reset_license":
        out = cmd_reset_license()
        print(json.dumps(out))
    else:
        p.print_help()

if __name__ == "__main__":
    main()
