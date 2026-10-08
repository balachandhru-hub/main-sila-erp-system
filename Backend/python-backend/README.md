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

## Buyer assistant (chat)

Besides invoice OCR, this service hosts a **buyer assistant** that does the buyer's manual work (create an RFQ, list and compare bids, award, un-award,
create contracts, purchase orders) by conversation, inside the real Buyer system. Through the gateway it is **Python API's v1** (`/api/v1/python/chat/...`).

- Sign in at Identity (`/api/v1/identity/auth/login`); the `access_token` cookie, or `Authorization: Bearer <token>`, identifies you. The token is checked by
  Identity's `token-claim`; no signing key is held here, and every action is made with your own token, so you can do only what your permissions allow.
- `POST /api/v1/chat/message` `{ "message": "...", "session_id": null }` (send the returned `session_id` to continue), `GET /chat/sessions`,
  `GET|DELETE /chat/sessions/{id}`, `GET /chat/me` (what you may do), `GET /chat/material-groups[?search=]`.
- Conversations are stored in `chat_session` / `chat_message` of the database in `ConnectionStrings:DefaultConnection` (required; a SQLAlchemy URL such as `sqlite:///./chat.db` also works for local tests).
  The RFQ itself lives in the Buyer database.
- Settings are read the way the .NET services' `Program.cs` does: `appsettings.json`, then `appsettings.<Environment>.json` (`ASPNETCORE_ENVIRONMENT`, for example `UAT`),
  then environment variables, which win (`Section__Key`, for example `ConnectionStrings__DefaultConnection`). Both files are committed and hold **no password**:
  put yours in `appsettings.Local.json` (git-ignored, loaded last) or in `ConnectionStrings__DefaultConnection`.
  Sections: `ConnectionStrings:DefaultConnection` (a .NET SQL Server connection string, as the .NET services use, or a SQLAlchemy URL) and `ConnectionStrings:OdbcDriver`
  (needs `pyodbc` and the Microsoft ODBC driver; the Docker image installs Driver 18), `InterCallService:BuyerUrl|MasterDataUrl|SupplierUrl|IdentityUrl`,
  `Rfq:VerificationTemplateId|InviteTemplateId`, `Assistant:AuthCacheSeconds|HttpTimeoutSeconds`.
  The chat tables `chat_session` and `chat_message` are created in that database on start-up.

### Everything in the first message

The assistant asks only what the first message did not state. Each fact is written as `<label> <value>`, and a value runs to the next label:

```
Create an RFQ for frozen mutton 20 kg, material group MEAT, department Kitchen, deliver to Hotel Marina, bidding closes in 3 days,
delivery in 10 days, budget 2000, category Food Beverage and Tobacco Products, sub-category Meat and poultry products, supplier Al Barsha Meats
```

Labels: `material group` / `material code` (after the item they belong to), `department`, `deliver to` / `delivery location`, `bidding closes`,
`delivery in` / `delivery by`, `budget`, `category`, `sub-category`, `supplier(s)`. With all of them it goes straight to the question about supplier
questions. A name that cannot be found (a department, category or supplier) is mentioned and asked again.
