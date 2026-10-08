"""Guards against a mistake that happened while writing regexes: a lost backslash turning a word boundary into a backspace character."""

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def test_no_source_file_contains_a_control_character():
    offenders = {}
    for folder in ("app", "tests"):
        for p in (ROOT / folder).rglob("*.py"):
            ctrl = sorted({hex(ord(c)) for c in p.read_text(encoding="utf-8") if ord(c) < 32 and c not in "\n\r\t"})
            if ctrl:
                offenders[str(p.relative_to(ROOT))] = ctrl
    assert offenders == {}
