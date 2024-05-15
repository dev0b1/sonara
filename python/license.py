import json
import os
import hashlib
from datetime import datetime

LICENSE_FILE = os.path.join(os.path.expanduser("~"), ".sonara_license.json")
ADMIN_KEYS_FILE = os.path.join(os.path.dirname(__file__), "admin_keys.json")

FREE_LIMIT_SECONDS = 600  # 10 minutes


def _load():
    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"tier": "free", "used_seconds": 0, "license_key": None, "activated_at": None, "export_unlocked": False}


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


def activate_license(key: str):
    """
    Activate license.
    Priority order:
      1. If key matches an unused admin key in `admin_keys.json`, mark it used and activate.
      2. If key matches the built-in hashed master key, activate.
    """

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

    admin_result = _use_admin_key(key)
    if admin_result is True:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = key.strip()
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return True
    if admin_result is False:
        return False

    # Fallback: single master hash-based key
    # Check for a configured master license key (exact match)
    MASTER = os.environ.get("MASTER_LICENSE_KEY")
    if MASTER and key.strip() == MASTER:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = key.strip()
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return True

    # Detect export unlock keys (convention: contain 'EXPORT')
    if "EXPORT" in key.strip().upper():
        data = _load()
        data["export_unlocked"] = True
        data["license_key"] = key.strip()
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return True

    SECRET = "SONARA2024LIFETIME"
    valid_hash = hashlib.sha256(f"SONARA-PRO-{SECRET}".encode()).hexdigest()[:16].upper()
    if key.strip().upper() == valid_hash:
        data = _load()
        data["tier"] = "pro"
        data["license_key"] = key.strip()
        data["activated_at"] = datetime.now().isoformat()
        _save(data)
        return True
    return False


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
