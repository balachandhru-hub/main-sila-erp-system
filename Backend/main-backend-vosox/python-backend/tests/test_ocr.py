import io

import pytest
from fastapi.testclient import TestClient

from app import ocr
from app.main import app
from app.ocr import OcrError, extract_fields, parse_date, parse_lines, process, score_text

SAMPLE = """Gulf Fresh Trading LLC
PO Box 1234, Dubai
TAX INVOICE
Invoice No: INV-2026-0042
Invoice Date: 03/10/2026
Due Date: 02/11/2026
PO Number: 4500012345
Currency: AED
Bill To: Grand Hotel Dubai
1 Tomato Fresh 10 KG 4.50 45.00
2 Olive Oil Extra Virgin 5 BTL 32.00 160.00
Subtotal 205.00
VAT 5% 10.25
Grand Total AED 215.25
"""


def test_quality_rewards_invoice_keywords():
    weak = score_text("hello world")
    strong = score_text("Invoice Supplier TRN Purchase Order Grand Total 997.50 AED")
    assert strong["quality"] > weak["quality"]
    assert strong["keywordHits"] >= 4


def test_image_without_tesseract_reports_missing(monkeypatch):
    from PIL import Image

    monkeypatch.setattr(ocr.shutil, "which", lambda name: None)
    buffer = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(buffer, "PNG")
    with pytest.raises(OcrError) as error:
        process(buffer.getvalue(), "scan.png")
    assert error.value.code == "TESSERACT_MISSING"
    assert error.value.status == 503


def test_unsupported_file_is_refused():
    with pytest.raises(OcrError) as error:
        process(b"hello", "notes.txt")
    assert error.value.code == "UNSUPPORTED_FILE"


def test_fields_are_extracted():
    fields = extract_fields(SAMPLE)
    assert fields["invoiceNumber"] == "INV-2026-0042"
    assert fields["invoiceDate"] == "2026-10-03"
    assert fields["currency"] == "AED"
    assert fields["grossAmount"] == 215.25
    assert fields["poNumber"] == "4500012345"
    assert fields["supplierName"] == "Gulf Fresh Trading LLC"


def test_lines_are_parsed():
    lines = parse_lines(SAMPLE)
    assert [line["description"] for line in lines] == ["Tomato Fresh", "Olive Oil Extra Virgin"]
    assert lines[0]["quantity"] == 10
    assert lines[0]["unitPrice"] == 4.5
    assert lines[1]["amount"] == 160.0


def test_dates_are_normalised():
    assert parse_date("2026-10-03") == "2026-10-03"
    assert parse_date("3 Oct 2026") == "2026-10-03"
    assert parse_date("10/25/2026") == "2026-10-25"


def test_api_answers_503_when_tesseract_is_missing(monkeypatch):
    from PIL import Image

    monkeypatch.setattr(ocr.shutil, "which", lambda name: None)
    buffer = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(buffer, "PNG")
    client = TestClient(app)
    response = client.post("/ocr/invoice", files={"file": ("scan.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 503
    assert response.json()["error"] == "TESSERACT_MISSING"


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ---------------------------------------------------------------- input limits


def _png(width: int = 40, height: int = 20, mode: str = "RGB") -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new(mode, (width, height), "white").save(buffer, "PNG")
    return buffer.getvalue()


def test_health_is_ok_json():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_extension_must_match_content():
    with pytest.raises(OcrError) as error:
        process(_png(), "invoice.pdf")
    assert error.value.code == "FILE_TYPE_MISMATCH"
    assert error.value.status == 415


def test_declared_content_type_must_be_allowed():
    with pytest.raises(OcrError) as error:
        process(_png(), "scan.png", "text/html")
    assert error.value.code == "UNSUPPORTED_FILE"


def test_unknown_extension_is_refused_even_with_a_valid_signature():
    with pytest.raises(OcrError) as error:
        process(_png(), "scan.exe")
    assert error.value.code == "UNSUPPORTED_FILE"


def test_too_many_pdf_pages_are_refused():
    with pytest.raises(OcrError) as error:
        ocr._check_page_count(21, 20)
    assert error.value.code == "TOO_MANY_PAGES"
    assert error.value.status == 413
    ocr._check_page_count(20, 20)


def test_huge_image_is_refused_before_decoding():
    with pytest.raises(OcrError) as error:
        process(_png(8000, 6000, "1"), "scan.png")
    assert error.value.code == "IMAGE_TOO_LARGE"


def test_api_refuses_a_body_over_the_limit(monkeypatch):
    from app import main
    from app.settings import Settings

    monkeypatch.setattr(main, "settings", Settings(tesseract_cmd="", ocr_language="eng", max_upload_mb=1))
    client = TestClient(app)
    response = client.post("/ocr/invoice", files={"file": ("big.pdf", b"%PDF-" + b"0" * (2 * 1024 * 1024), "application/pdf")})
    assert response.status_code == 413
    assert response.json()["error"] == "FILE_TOO_LARGE"


def test_api_answers_generic_message_on_unexpected_error(monkeypatch):
    from app import main

    def boom(*args, **kwargs):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(main, "process", boom)
    response = TestClient(app).post("/ocr/invoice", files={"file": ("scan.png", _png(), "image/png")})
    assert response.status_code == 422
    assert "secret" not in response.text
    assert "Traceback" not in response.text


def test_net_tax_and_type_are_extracted():
    fields = extract_fields(SAMPLE)
    assert fields["netAmount"] == 205.0
    assert fields["taxAmount"] == 10.25
    assert fields["invoiceType"] == "MATERIAL"


def test_supplier_trn_is_extracted():
    fields = extract_fields("Supplier: Gulf Fresh Trading LLC\nTRN: 100 2345 6789 0003\nInvoice No: INV-9\nTotal incl VAT 105.00")
    assert fields["supplierTaxNumber"] == "100234567890003"
    assert fields["taxAmount"] is None


def test_service_invoice_without_goods_lines():
    text = "Cool Air Services LLC\nTax Invoice\nInvoice No: INV-77\nAC maintenance service for October\nSubtotal 1,000.00\nVAT 5% 50.00\nTotal 1,050.00"
    fields = extract_fields(text)
    assert fields["invoiceType"] == "SERVICE"
    assert fields["netAmount"] == 1000.0
    assert fields["taxAmount"] == 50.0
