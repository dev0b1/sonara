import json
import os
import hashlib
from datetime import datetime, date

LICENSE_FILE = os.path.join(os.path.expanduser("~"), ".sonara_license.json")
ADMIN_KEYS_FILE = os.path.join(os.path.dirname(__file__), "admin_keys.json")

FREE_LIMIT_SECONDS = 1200  # 20 minutes per day
PRO_UPLOAD_LIMIT_SECONDS = 30 * 3600  # 30 hours per file (Pro)


def _load():
    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, "r") as f:
                data = json.load(f)
                # Daily reset for free tier usage
                today = date.today().isoformat()
                last = data.get("usage_date")
                if last != today:
                    data["usage_date"] = today
                    data["used_seconds"] = 0
                    try:
                        _save(data)
                    except Exception:
                        pass
                return data
        except Exception:
            pass
    return {
        "tier": "free",
        "used_seconds": 0,
        "usage_date": date.today().isoformat(),
        "license_key": None,
        "activated_at": None,
        "export_unlocked": False,
    }


def _save(data):
    with open(LICENSE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def has_export_unlocked():
    return _load().get("export_unlocked", False)


def get_tier():
    return _load().get("tier", "free")


def is_pro():
    return get_tier() == "pro"


def get_used_seconds():
    return _load().get("used_seconds", 0)


def get_remaining_free_seconds():
    used = get_used_seconds()
    return max(0, FREE_LIMIT_SECONDS - used)


def add_used_seconds(seconds):
    data = _load()
    data["used_seconds"] = data.get("used_seconds", 0) + seconds
    _save(data)


def get_pro_upload_limit_seconds():
    return PRO_UPLOAD_LIMIT_SECONDS


def activate_license(key: str) -> dict:
    """
    Activate license. Returns {"ok": bool, "message": str}.
    Priority order:
      1. If key matches an unused admin key in `admin_keys.json`, mark it used and activate.
      2. MASTER_LICENSE_KEY env (exact match).
      3. Keys containing EXPORT (export unlock).
      4. Built-in hashed lifetime key (with or without SONARA- prefix).
    """

    def _ok(msg: str) -> dict:
        return {"ok": True, "message": msg}

    def _fail(msg: str) -> dict:
        return {"ok": False, "message": msg}

    def _load_admin_keys():
        if not os.path.exists(ADMIN_KEYS_FILE):
            return []
        try:
            with open(ADMIN_KEYS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # legacy format: list of strings
                if data and isinstance(data[0], str):
                    keys = [{"key": k, "used": False, "issued_to": None, "issued_at": None} for k in data]
                    # persist normalized format
                    with open(ADMIN_KEYS_FILE, "w", encoding="utf-8") as fw:
                        json.dump(keys, fw, indent=2)
                    return keys
                return data
        except Exception:
            return []

    def _save_admin_keys(keys):
        try:
            with open(ADMIN_KEYS_FILE, "w", encoding="utf-8") as f:
                json.dump(keys, f, indent=2)
        except Exception:
            pass

    def _use_admin_key(k: str):
        keys = _load_admin_keys()
        if not keys:
            return None
        for item in keys:
            if item.get("key", "").strip().upper() == k.strip().upper():
                if item.get("used"):
                    return False
                item["used"] = True
                item["issued_at"] = datetime.now().isoformat()
                _save_admin_keys(keys)
                return True
        return None

    raw = (key or "").strip()
    if not raw:
        return _fail("Enter your license key.")

    admin_result = _use_admin_key(raw)
    if admin_result is True:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = raw
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return _ok("Lifetime Pro activated.")

    if admin_result is False:
        # Same key re-entered after a successful activation (common in Support / reinstall edge cases).
        data = _load()
        if (
            (data.get("license_key") or "").strip().upper() == raw.strip().upper()
            and data.get("tier") == "pro"
        ):
            return _ok("Lifetime Pro is already active on this device.")
        return _fail(
            "This license key was already redeemed. Each purchase key works once. "
            "Use the key from your latest Whop receipt, or contact support for a replacement."
        )

    # Fallback: single master hash-based key
    MASTER = os.environ.get("MASTER_LICENSE_KEY")
    if MASTER and raw == MASTER:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = raw
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return _ok("Lifetime Pro activated.")

    # Detect export unlock keys (convention: contain 'EXPORT')
    if "EXPORT" in raw.upper():
        data = _load()
        data["export_unlocked"] = True
        data["license_key"] = raw
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return _ok("Extended export options saved.")

    SECRET = "SONARA2024LIFETIME"
    valid_hash = hashlib.sha256(f"SONARA-PRO-{SECRET}".encode()).hexdigest()[:16].upper()
    upper = raw.upper()
    body = upper[7:] if upper.startswith("SONARA-") else upper
    if body == valid_hash or upper == valid_hash:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = raw
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return _ok("Lifetime Pro activated.")

    return _fail(
        "That key is not recognized. Only keys issued for your purchase will work — paste the exact key from your "
        "Whop receipt or email (no spaces). Keys you invent or copy from elsewhere cannot activate. "
        "If you build from source, add buyer keys to python/admin_keys.json and bundle them in the app. "
        "Contact support with your order ID if you never received a key."
    )


def get_admin_keys():
    """Return admin keys (list of dicts)."""
    if not os.path.exists(ADMIN_KEYS_FILE):
        return []
    try:
        with open(ADMIN_KEYS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if data and isinstance(data[0], str):
                return [{"key": k, "used": False, "issued_to": None, "issued_at": None} for k in data]
            return data
    except Exception:
        return []


def reset_for_testing():
    if os.path.exists(LICENSE_FILE):
        os.remove(LICENSE_FILE)


def _save_admin_keys(keys):
    try:
        with open(ADMIN_KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f, indent=2)
    except Exception:
        pass


def use_admin_key(key: str) -> bool:
    """Mark an admin key as used (no buyer info). Returns True if marked."""
    keys = get_admin_keys()
    if not keys:
        return False
    for k in keys:
        if k.get("key", "").strip().upper() == key.strip().upper():
            if k.get("used"):
                return False
            k["used"] = True
            k["issued_at"] = datetime.now().isoformat()
            _save_admin_keys(keys)
            return True
    return False


def issue_admin_key(key: str, issued_to: str | None = None) -> bool:
    """Mark an admin key as used and record `issued_to` buyer info.

    Returns True if the key was found and updated.
    """
    keys = get_admin_keys()
    if not keys:
        return False
    for k in keys:
        if k.get("key", "").strip().upper() == key.strip().upper():
            if k.get("used"):
                return False
            k["used"] = True
            k["issued_at"] = datetime.now().isoformat()
            k["issued_to"] = issued_to
            _save_admin_keys(keys)
            return True
    return False
