"""Invoice OCR: text from the PDF text layer first, otherwise rasterised pages read by Tesseract,
then simple field and line extraction with regular expressions.

Ported from the SILA ME prototype (ocr_preprocess.py): document classification, the preprocessing
profiles tried in order until the text is good enough, and the quality score.
"""

from __future__ import annotations

import io
import os
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .settings import Settings, settings as default_settings

PDF = "PDF"
IMAGE = "IMAGE"

DIGITAL_TEXT = "DIGITAL_TEXT"
SCANNED = "SCANNED"

PROFILES = ("ORIGINAL", "GRAYSCALE_CONTRAST", "ADAPTIVE_THRESHOLD", "DESKEWED_ENHANCED")
GOOD_ENOUGH_QUALITY = 0.55
# A PDF text layer with fewer words than this is treated as a scan.
MIN_TEXT_LAYER_WORDS = 15
RENDER_DPI = 300

CURRENCIES = ("AED", "USD", "EUR", "GBP", "SAR", "QAR", "OMR", "BHD", "KWD", "INR")
MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), start=1)}


class OcrError(Exception):
    """A document that cannot be read. `status` is the HTTP status the API answers with."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass
class OcrResult:
    text: str
    confidence: float
    document_type: str
    page_count: int
    profile: str | None
    fields: dict[str, Any] = field(default_factory=dict)
    lines: list[dict[str, Any]] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "confidence": self.confidence,
            "documentType": self.document_type,
            "pageCount": self.page_count,
            "preprocessingProfile": self.profile,
            "fields": self.fields,
            "lines": self.lines,
        }


# ---------------------------------------------------------------- quality


def score_text(text: str, engine_confidence: float | None = None) -> dict[str, float | int]:
    """How much the text looks like a readable invoice (0..1), as in the prototype."""
    words = [word for word in text.split() if word]
    keywords = ("invoice", "total", "supplier", "purchase", "trn", "vat", "amount")
    lowered = text.lower()
    keyword_hits = sum(lowered.count(word) for word in keywords)
    numeric = sum(ch.isdigit() for ch in text)
    return {
        "characters": len(text),
        "words": len(words),
        "numericDensity": round(numeric / max(len(text), 1), 4),
        "keywordHits": keyword_hits,
        "engineConfidence": engine_confidence or 0,
        "quality": round(min(1.0, (len(words) / 80) + (keyword_hits / 20) + (numeric / 400)), 4),
    }


# ---------------------------------------------------------------- file type


# Accepted file name extensions and declared content types (octet-stream: clients that do not know the type).
ALLOWED_EXTENSIONS = {".pdf": PDF, ".jpg": IMAGE, ".jpeg": IMAGE, ".png": IMAGE}
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "application/octet-stream"}


def _signature_kind(data: bytes) -> str | None:
    if data[:5] == b"%PDF-":
        return PDF
    if data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n":
        return IMAGE
    return None


def detect_kind(data: bytes, filename: str | None, content_type: str | None) -> str:
    """PDF or IMAGE from the file signature; the extension and declared type, when given, must agree with it."""
    unsupported = OcrError("UNSUPPORTED_FILE", "Upload the invoice as a PDF, JPEG or PNG file.", 415)
    kind = _signature_kind(data)
    if kind is None:
        raise unsupported
    extension = os.path.splitext(filename or "")[1].lower()
    if extension and extension not in ALLOWED_EXTENSIONS:
        raise unsupported
    declared = (content_type or "").split(";")[0].strip().lower()
    if declared and declared not in ALLOWED_CONTENT_TYPES:
        raise unsupported
    if extension and ALLOWED_EXTENSIONS[extension] != kind:
        raise OcrError("FILE_TYPE_MISMATCH", "The file content does not match its extension. Export the invoice again.", 415)
    return kind


# ---------------------------------------------------------------- tesseract


def tesseract_available(config: Settings = default_settings) -> bool:
    if config.tesseract_cmd:
        return shutil.which(config.tesseract_cmd) is not None
    return shutil.which("tesseract") is not None


def _require_tesseract(config: Settings) -> Any:
    if not tesseract_available(config):
        raise OcrError(
            "TESSERACT_MISSING",
            "Tesseract is not installed on the OCR service. Install it or set TESSERACT_CMD.",
            503,
        )
    import pytesseract

    if config.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = config.tesseract_cmd
    return pytesseract


def preprocess(image: Any, profile: str) -> Any:
    """One preprocessing profile of the prototype, applied to a PIL image."""
    from PIL import ImageFilter, ImageOps, ImageStat

    image = image.convert("RGB")
    if profile == "ORIGINAL":
        return image
    gray = ImageOps.grayscale(image)
    if profile == "GRAYSCALE_CONTRAST":
        return ImageOps.autocontrast(gray)
    if profile == "DESKEWED_ENHANCED":
        return ImageOps.autocontrast(gray.filter(ImageFilter.UnsharpMask(radius=1.4, percent=140)))
    # ADAPTIVE_THRESHOLD
    mean = ImageStat.Stat(gray).mean[0]
    return gray.point(lambda pixel: 255 if pixel > mean else 0)


def ocr_images(images: list[Any], config: Settings) -> tuple[str, str]:
    """Reads the pages with each profile until the text is good enough; returns (text, profile)."""
    pytesseract = _require_tesseract(config)
    best_text, best_profile, best_score = "", PROFILES[0], -1.0
    for profile in PROFILES:
        pages = []
        for image in images:
            prepared = preprocess(image, profile)
            pages.append(pytesseract.image_to_string(prepared, lang=config.ocr_language, config="--psm 6").strip())
        text = "\n\n".join(page for page in pages if page)
        quality = float(score_text(text)["quality"])
        if quality > best_score:
            best_text, best_profile, best_score = text, profile, quality
        if quality >= GOOD_ENOUGH_QUALITY:
            break
    return best_text, best_profile


# ---------------------------------------------------------------- PDF


def _check_page_count(page_count: int, max_pages: int) -> None:
    if page_count > max_pages:
        raise OcrError("TOO_MANY_PAGES", f"The PDF has {page_count} pages. Upload an invoice of at most {max_pages} pages.", 413)


def pdf_text_layer(data: bytes, max_pages: int = default_settings.max_pdf_pages) -> tuple[str, int]:
    """Text of a digital PDF (pdfplumber, else pypdf) and its page count. Too many pages is refused before reading."""
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            _check_page_count(len(pdf.pages), max_pages)
            pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n\n".join(p for p in pages if p.strip()), len(pages)
    except OcrError:
        raise
    except Exception:  # noqa: BLE001 - fall back to pypdf on any parser error
        pass
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        _check_page_count(len(reader.pages), max_pages)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p for p in pages if p.strip()), len(pages)
    except OcrError:
        raise
    except Exception as exception:  # noqa: BLE001
        raise OcrError("PDF_UNREADABLE", "The PDF could not be opened. Upload it again or as an image.", 422) from exception


def render_pdf(data: bytes) -> list[Any]:
    """The pages of a scanned PDF as images (pdfplumber renders with pypdfium2, no poppler needed)."""
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return [page.to_image(resolution=RENDER_DPI).original.copy() for page in pdf.pages]
    except Exception as exception:  # noqa: BLE001
        raise OcrError("RENDER_FAILED", "The PDF pages could not be rendered for OCR.", 422) from exception


# ---------------------------------------------------------------- process


def process(data: bytes, filename: str | None = None, content_type: str | None = None, config: Settings = default_settings) -> OcrResult:
    kind = detect_kind(data, filename, content_type)
    profile: str | None = None
    if kind == PDF:
        text, page_count = pdf_text_layer(data, config.max_pdf_pages)
        if len(text.split()) >= MIN_TEXT_LAYER_WORDS:
            document_type = DIGITAL_TEXT
        else:
            document_type = SCANNED
            text, profile = ocr_images(render_pdf(data), config)
    else:
        from PIL import Image

        try:
            image = Image.open(io.BytesIO(data))
            width, height = image.size
        except Exception as exception:  # noqa: BLE001
            raise OcrError("IMAGE_UNREADABLE", "The image could not be opened. Upload it again.", 422) from exception
        # The size is known from the header: a huge image is refused before its pixels are decoded.
        if width * height > config.max_image_pixels:
            raise OcrError("IMAGE_TOO_LARGE", "The image has too many pixels. Scan or photograph the invoice at a lower resolution.", 413)
        try:
            image.load()
        except Exception as exception:  # noqa: BLE001
            raise OcrError("IMAGE_UNREADABLE", "The image could not be opened. Upload it again.", 422) from exception
        document_type, page_count = IMAGE, 1
        text, profile = ocr_images([image], config)

    if not text.strip():
        raise OcrError("OCR_EMPTY", "No text could be read from the invoice.", 422)

    quality = float(score_text(text)["quality"])
    confidence = round(max(quality, 0.95) if document_type == DIGITAL_TEXT else quality, 4)
    return OcrResult(
        text=text,
        confidence=confidence,
        document_type=document_type,
        page_count=page_count,
        profile=profile,
        fields=extract_fields(text),
        lines=parse_lines(text),
    )


# ---------------------------------------------------------------- fields

_SEP = r"\s*[:#.\-=]*\s*"
_AMOUNT = r"(-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,4})?|-?\d+(?:\.\d{1,4})?)"

_INVOICE_NUMBER = [
    re.compile(r"(?im)\b(?:supplier\s+invoice|tax\s+invoice|invoice|inv)\s*(?:number|no\.?|num|#|ref(?:erence)?|id)" + _SEP + r"([A-Z0-9][A-Z0-9._/\-]{2,40})"),
    re.compile(r"(?im)\b(?:document|bill)\s*(?:number|no\.?|#)" + _SEP + r"([A-Z0-9][A-Z0-9._/\-]{2,40})"),
    re.compile(r"(?i)\b((?:INV|TAX)[\-/.]?[A-Z0-9]*\d[A-Z0-9._/\-]{1,38})\b"),
]
_PO_NUMBER = [
    re.compile(r"(?im)\b(?:purchase\s+order|customer\s+p\.?o\.?|your\s+p\.?o\.?|p\.?\s?o\.?)\s*(?:number|no\.?|#|ref(?:erence)?)?" + _SEP + r"([A-Z0-9][A-Z0-9./\-]{2,30})"),
    re.compile(r"(?im)\border\s+ref(?:erence)?" + _SEP + r"([A-Z0-9][A-Z0-9./\-]{2,30})"),
]
_DATE_LABEL = re.compile(r"(?im)^.*?\b(?:tax\s+invoice\s+date|invoice\s+date|document\s+date|date\s+of\s+issue|issue\s+date|dated|date)\b" + _SEP + r"(.+)$")
_DATE_PATTERNS = [
    re.compile(r"\b(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})[./\-](\d{1,2})[./\-](20\d{2}|\d{2})\b"),
    re.compile(r"\b(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,]+(20\d{2})\b"),
    re.compile(r"\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(20\d{2})\b"),
]
_TOTAL_LABELS = [
    r"grand\s+total",
    r"gross\s+(?:amount|total)",
    r"invoice\s+(?:total|amount)",
    r"total\s+incl(?:uding|\.)?\s*(?:vat|tax)",
    r"total\s+amount(?:\s+due)?",
    r"total\s+payable",
    r"net\s+payable",
    r"amount\s+due",
    r"total\s+due",
    r"(?<!sub)(?<!sub\s)total",
]
_SUPPLIER_LABEL = re.compile(r"(?im)^\s*(?:supplier\s+name|vendor\s+name|supplier|vendor|seller|sold\s+by|issued\s+by|billed\s+from|from)\s*[:\-]\s*(.*)$")
_BUYER_LINE = re.compile(r"(?i)^(bill\s+to|ship\s+to|sold\s+to|customer|buyer|deliver(?:y)?\s+to)\b")
_NOT_A_NAME = re.compile(
    r"(?i)\b(tax\s+invoice|invoice|purchase\s+order|p\.?o\.?\s+(?:number|no)|date|trn|vat|total|amount|currency|page|bill\s+to|ship\s+to|tel|phone|fax|email|www\.|http)\b"
)


def _first(patterns: list[re.Pattern[str]], text: str, need_digit: bool = True) -> str | None:
    for pattern in patterns:
        for match in pattern.finditer(text):
            value = match.group(1).strip(" .:-/")
            if len(value) >= 3 and (not need_digit or any(ch.isdigit() for ch in value)):
                return value
    return None


def parse_amount(raw: str) -> float | None:
    cleaned = raw.replace(" ", "").replace(",", "")
    try:
        return round(float(cleaned), 4)
    except ValueError:
        return None


def parse_date(raw: str) -> str | None:
    """The first date in the text as ISO yyyy-mm-dd (day-first for numeric dates)."""
    for index, pattern in enumerate(_DATE_PATTERNS):
        match = pattern.search(raw)
        if not match:
            continue
        try:
            if index == 0:
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            elif index == 1:
                day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                if year < 100:
                    year += 2000
                if month > 12 and day <= 12:
                    day, month = month, day
            elif index == 2:
                day, month, year = int(match.group(1)), MONTHS.get(match.group(2)[:3].lower(), 0), int(match.group(3))
            else:
                month, day, year = MONTHS.get(match.group(1)[:3].lower(), 0), int(match.group(2)), int(match.group(3))
            return datetime(year, month, day).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _invoice_date(text: str) -> str | None:
    for match in _DATE_LABEL.finditer(text):
        line = match.group(0)
        if re.search(r"(?i)\bdue\s+date\b", line) and not re.search(r"(?i)invoice\s+date", line):
            continue
        value = parse_date(match.group(1))
        if value:
            return value
    for line in text.splitlines():
        if re.search(r"(?i)\bdue\b", line):
            continue
        value = parse_date(line)
        if value:
            return value
    return None


def _currency(text: str) -> str | None:
    labelled = re.search(r"(?im)\bcurrency" + _SEP + r"(" + "|".join(CURRENCIES) + r")\b", text)
    if labelled:
        return labelled.group(1).upper()
    anywhere = re.search(r"(?i)\b(" + "|".join(CURRENCIES) + r")\b", text)
    return anywhere.group(1).upper() if anywhere else None


def _gross_amount(text: str) -> float | None:
    lines = text.splitlines()
    for label in _TOTAL_LABELS:
        pattern = re.compile(r"(?i)\b" + label + r"\b")
        # The last matching line wins: the grand total is usually below the other totals.
        for line in reversed(lines):
            match = pattern.search(line)
            if not match:
                continue
            amounts = re.findall(_AMOUNT, line[match.end():])
            values = [parse_amount(a) for a in amounts]
            values = [v for v in values if v is not None]
            if values:
                return values[-1]
    return None


def _supplier_name(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines()]
    for index, line in enumerate(lines):
        match = _SUPPLIER_LABEL.match(line)
        if not match:
            continue
        value = match.group(1).strip()
        if not value:
            value = next((candidate for candidate in lines[index + 1:index + 3] if candidate), "")
        if value and not _NOT_A_NAME.search(value) and not re.search(r"\d{6,}", value):
            return value[:120]
    # Otherwise the first line that looks like a company name, above any "bill to" block.
    for line in lines[:12]:
        if not line or _BUYER_LINE.match(line):
            if line:
                break
            continue
        letters = sum(ch.isalpha() for ch in line)
        if letters >= 4 and letters / max(len(line), 1) > 0.6 and not _NOT_A_NAME.search(line):
            return line[:120]
    return None


_NET_LABELS = [
    r"sub\s*-?\s*total",
    r"net\s+(?:amount|total|value)",
    r"total\s+(?:excl(?:uding|\.)?|before|w/o|without)\s*(?:vat|tax)",
    r"taxable\s+(?:amount|value)",
    r"amount\s+(?:excl(?:uding|\.)?|before)\s*(?:vat|tax)",
]
_TAX_LABELS = [
    r"(?:total\s+)?vat\s+amount",
    r"total\s+(?:vat|tax)",
    r"tax\s+amount",
    r"(?<!incl\s)(?<!incl\.\s)(?<!including\s)(?<!excl\s)(?<!excl\.\s)(?<!excluding\s)(?<!before\s)vat(?!\s*(?:no\b|number|reg|registration|#|trn|id\b|%?\s*incl))",
]
_TRN = re.compile(
    r"(?i)\b(?:trn|tax\s+registration\s+(?:no\.?|number)|vat\s*(?:reg(?:istration)?\s*)?(?:no\.?|number|#))" + _SEP + r"(\d[\d ]{8,22}\d)"
)
_PERCENT = re.compile(r"-?\d+(?:\.\d+)?\s*%")
_SERVICE_WORDS = re.compile(
    r"(?i)\b(services?|service\s+charge|consultancy|consulting|maintenance|labou?r|repairs?|cleaning|subscription|professional\s+fees?|rental|installation)\b"
)


def _labelled_amount(text: str, labels: list[str]) -> float | None:
    """The last amount on the last line that carries one of the labels (percentages are skipped)."""
    lines = text.splitlines()
    for label in labels:
        pattern = re.compile(r"(?i)\b" + label + r"\b")
        for line in reversed(lines):
            match = pattern.search(line)
            if not match:
                continue
            rest = _PERCENT.sub(" ", line[match.end():])
            values = [parse_amount(a) for a in re.findall(_AMOUNT, rest)]
            values = [v for v in values if v is not None]
            if values:
                return values[-1]
    return None


def _supplier_tax_number(text: str) -> str | None:
    match = _TRN.search(text)
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(1))
    return digits if 10 <= len(digits) <= 20 else None


def invoice_type(text: str, lines: list[dict[str, Any]]) -> str | None:
    """MATERIAL (goods lines), SERVICE (service wording, no goods lines), MIXED (goods and service lines), else None."""
    service_lines = [line for line in lines if _SERVICE_WORDS.search(line.get("description") or "")]
    if lines:
        return "MIXED" if 0 < len(service_lines) < len(lines) else ("SERVICE" if service_lines else "MATERIAL")
    return "SERVICE" if _SERVICE_WORDS.search(text) else None


def extract_fields(text: str) -> dict[str, Any]:
    return {
        "invoiceNumber": _first(_INVOICE_NUMBER, text),
        "invoiceDate": _invoice_date(text),
        "currency": _currency(text),
        "grossAmount": _gross_amount(text),
        "netAmount": _labelled_amount(text, _NET_LABELS),
        "taxAmount": _labelled_amount(text, _TAX_LABELS),
        "supplierName": _supplier_name(text),
        "supplierTaxNumber": _supplier_tax_number(text),
        "poNumber": _first(_PO_NUMBER, text),
        "invoiceType": invoice_type(text, parse_lines(text)),
    }


# ---------------------------------------------------------------- lines

_LINE = re.compile(
    r"^(?:\d{1,3}[.)]?\s+)?(?P<desc>.*?[A-Za-z].*?)\s+(?P<qty>\d+(?:\.\d+)?)\s+(?:[A-Za-z]{1,5}\s+)?"
    r"(?P<price>\d[\d,]*\.\d{2,4})\s+(?:\d+(?:\.\d+)?%\s+)?(?P<amount>\d[\d,]*\.\d{2,4})\s*$"
)
_NOT_A_LINE = re.compile(r"(?i)\b(sub\s*total|total|vat|tax|discount|balance|amount\s+due|payable|rounding)\b")


def parse_lines(text: str) -> list[dict[str, Any]]:
    """Table rows of the form: description  quantity  [unit]  unit price  amount."""
    result = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or _NOT_A_LINE.search(line):
            continue
        match = _LINE.match(line)
        if not match:
            continue
        result.append(
            {
                "description": match.group("desc").strip(" -:|"),
                "quantity": parse_amount(match.group("qty")),
                "unitPrice": parse_amount(match.group("price")),
                "amount": parse_amount(match.group("amount")),
            }
        )
    return result
