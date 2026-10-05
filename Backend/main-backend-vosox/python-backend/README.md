# python-backend (invoice OCR)

Small FastAPI service the Buyer API calls to read supplier invoices for SILA ME receiving.

- `POST /ocr/invoice` (multipart, field `file`: PDF, JPEG or PNG) returns
  `{ text, confidence, documentType, pageCount, preprocessingProfile, fields: { invoiceNumber, invoiceDate, currency, grossAmount, supplierName, poNumber }, lines: [{ description, quantity, unitPrice, amount }] }`.
  Errors are `{ "error": CODE, "message": text }`: 503 `TESSERACT_MISSING`, 415 `UNSUPPORTED_FILE`, 413 `FILE_TOO_LARGE`, 422 `OCR_EMPTY` / `PDF_UNREADABLE` / `RENDER_FAILED`.
- `GET /health` returns `{ status, tesseract }`.

Digital PDFs are read from their text layer (pdfplumber, then pypdf). Scanned PDFs and images are rendered and read
with Tesseract, trying the preprocessing profiles of the prototype until the text is good enough.

## Run

```
python -m venv .venv
.venv\Scripts\activate        # Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8010
```

Install Tesseract (Windows: the UB Mannheim build; Linux: `apt install tesseract-ocr`) for scanned invoices.

Environment variables (no secrets): `TESSERACT_CMD` (path of tesseract when it is not on the PATH),
`OCR_LANGUAGE` (default `eng`), `MAX_UPLOAD_MB` (default 20).

The Buyer API finds the service through `InterCallService:OcrUrl` (e.g. `http://localhost:8010`).

## Test

```
python -m pytest
```

## Docker

```
docker build -t vosox-python-backend .
docker run -p 8010:8010 vosox-python-backend
```
