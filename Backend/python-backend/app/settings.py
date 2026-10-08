"""Settings of the OCR service, read from environment variables. No secrets live here."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Full path of the tesseract executable; empty means "tesseract" on the PATH.
    tesseract_cmd: str
    # Tesseract language(s), e.g. "eng" or "eng+ara".
    ocr_language: str
    # Largest accepted upload, in megabytes.
    max_upload_mb: int
    # Most PDF pages read per invoice; longer documents are refused.
    max_pdf_pages: int = 20
    # Most pixels of one image or rendered page (protects against decompression bombs).
    max_image_pixels: int = 40_000_000

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


def load_settings() -> Settings:
    return Settings(
        tesseract_cmd=os.getenv("TESSERACT_CMD", "").strip(),
        ocr_language=os.getenv("OCR_LANGUAGE", "eng").strip() or "eng",
        max_upload_mb=max(1, _int_env("MAX_UPLOAD_MB", 20)),
        max_pdf_pages=max(1, _int_env("MAX_PDF_PAGES", 20)),
        max_image_pixels=max(1_000_000, _int_env("MAX_IMAGE_PIXELS", 40_000_000)),
    )


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


settings = load_settings()
