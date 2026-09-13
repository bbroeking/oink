#!/usr/bin/env python3
"""Verify that a simulator app's main executable can request Sign in with Apple."""

from __future__ import annotations

import argparse
import plistlib
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any


BUNDLE_ID = "com.broeking.ttp"
LC_SEGMENT_64 = 0x19
LC_CODE_SIGNATURE = 0x1D
CSMAGIC_EMBEDDED_SIGNATURE = 0xFADE0CC0
CSMAGIC_EMBEDDED_ENTITLEMENTS = 0xFADE7171


class VerificationError(Exception):
    pass


def command(*args: str) -> str:
    result = subprocess.run(args, check=False, capture_output=True, text=True)
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise VerificationError(detail or f"command failed: {' '.join(args)}")
    return result.stdout.strip()


def default_app_path() -> Path:
    return Path(command("xcrun", "simctl", "get_app_container", "booted", BUNDLE_ID, "app"))


def plist_from_blob(blob: bytes) -> dict[str, Any] | None:
    try:
        value = plistlib.loads(blob.rstrip(b"\0"))
    except (plistlib.InvalidFileException, ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


def macho_entitlements(executable: Path) -> dict[str, Any] | None:
    data = executable.read_bytes()
    if len(data) < 32:
        raise VerificationError(f"main executable is too small: {executable}")

    magic = data[:4]
    if magic == b"\xcf\xfa\xed\xfe":
        endian = "<"
    elif magic == b"\xfe\xed\xfa\xcf":
        endian = ">"
    else:
        raise VerificationError("main executable is not a supported 64-bit Mach-O")

    ncmds = struct.unpack_from(endian + "I", data, 16)[0]
    cursor = 32
    signature: tuple[int, int] | None = None

    for _ in range(ncmds):
        if cursor + 8 > len(data):
            raise VerificationError("truncated Mach-O load commands")
        cmd, cmdsize = struct.unpack_from(endian + "II", data, cursor)
        if cmdsize < 8 or cursor + cmdsize > len(data):
            raise VerificationError("invalid Mach-O load command")

        if cmd == LC_SEGMENT_64:
            nsects = struct.unpack_from(endian + "I", data, cursor + 64)[0]
            section_cursor = cursor + 72
            for _ in range(nsects):
                if section_cursor + 80 > cursor + cmdsize:
                    raise VerificationError("truncated Mach-O section table")
                sectname = data[section_cursor : section_cursor + 16].split(b"\0", 1)[0]
                segname = data[section_cursor + 16 : section_cursor + 32].split(b"\0", 1)[0]
                size = struct.unpack_from(endian + "Q", data, section_cursor + 40)[0]
                offset = struct.unpack_from(endian + "I", data, section_cursor + 48)[0]
                if segname == b"__TEXT" and sectname == b"__entitlements":
                    parsed = plist_from_blob(data[offset : offset + size])
                    if parsed is not None:
                        return parsed
                section_cursor += 80
        elif cmd == LC_CODE_SIGNATURE:
            signature = struct.unpack_from(endian + "II", data, cursor + 8)
        cursor += cmdsize

    if signature is None:
        return None
    offset, size = signature
    blob = data[offset : offset + size]
    if len(blob) < 12:
        return None
    magic, total_length, count = struct.unpack_from(">III", blob)
    if magic != CSMAGIC_EMBEDDED_SIGNATURE or total_length > len(blob):
        return None
    for index in range(count):
        entry = 12 + index * 8
        if entry + 8 > total_length:
            break
        _, child_offset = struct.unpack_from(">II", blob, entry)
        if child_offset + 8 > total_length:
            continue
        child_magic, child_length = struct.unpack_from(">II", blob, child_offset)
        if child_magic != CSMAGIC_EMBEDDED_ENTITLEMENTS:
            continue
        end = child_offset + child_length
        if child_length >= 8 and end <= total_length:
            parsed = plist_from_blob(blob[child_offset + 8 : end])
            if parsed is not None:
                return parsed
    return None


def verify(app: Path) -> None:
    info_path = app / "Info.plist"
    if not app.is_dir() or not info_path.is_file():
        raise VerificationError(f"not an app bundle: {app}")
    with info_path.open("rb") as handle:
        info = plistlib.load(handle)

    platforms = info.get("CFBundleSupportedPlatforms", [])
    if "iPhoneSimulator" not in platforms:
        raise VerificationError("bundle platform is not iPhoneSimulator")
    bundle_id = info.get("CFBundleIdentifier")
    executable_name = info.get("CFBundleExecutable")
    if not isinstance(bundle_id, str) or not isinstance(executable_name, str):
        raise VerificationError("bundle identifier or executable name is missing")

    executable = app / executable_name
    if not executable.is_file():
        raise VerificationError(f"main executable is missing: {executable}")
    entitlements = macho_entitlements(executable)
    if entitlements is None:
        dylib_note = " (a debug dylib is present, but the main executable must carry it)" if (app / f"{executable_name}.debug.dylib").exists() else ""
        raise VerificationError(f"main executable has no readable entitlement plist{dylib_note}")

    apple_sign_in = entitlements.get("com.apple.developer.applesignin")
    if not isinstance(apple_sign_in, list) or "Default" not in apple_sign_in:
        raise VerificationError("main executable lacks Sign in with Apple entitlement value Default")

    application_id = entitlements.get("application-identifier")
    if application_id is not None:
        if not isinstance(application_id, str) or not application_id.endswith(f".{bundle_id}"):
            raise VerificationError(
                f"application-identifier {application_id!r} does not match bundle {bundle_id!r}"
            )

    print(f"PASS: {app} embeds Sign in with Apple for simulator bundle {bundle_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", nargs="?", type=Path, help="simulator .app path (defaults to booted Tickle the Pig app)")
    args = parser.parse_args()
    try:
        verify(args.app.expanduser().resolve() if args.app else default_app_path())
    except (OSError, plistlib.InvalidFileException, VerificationError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        print("Rebuild and install normally with: NODE_OPTIONS=\"--max-old-space-size=16384\" npx expo run:ios", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
