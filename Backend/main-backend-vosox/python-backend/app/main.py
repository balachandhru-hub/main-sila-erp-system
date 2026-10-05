"""FastAPI entry point of the OCR service. Run: uvicorn app.main:app --port 8010

Uploads are read into memory only (never written by this service); the multipart spool file of the framework is
closed in `finally`. Errors answer a short code and message, never a stack trace; the server log keeps the
exception without file contents.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import JSONResponse

from .ocr import OcrError, process, tesseract_available
from .settings import settings

logger = logging.getLogger("python-backend.ocr")

# Room for the multipart envelope around the file itself.
MULTIPART_OVERHEAD_BYTES = 64 * 1024
MAX_LOGGED_NAME = 120

app = FastAPI(title="VOSOX python-backend", version="1.0.0")


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "message": message})


def _safe_name(filename: str | None) -> str:
    """The upload's name for logs: no line breaks, shortened."""
    name = (filename or "").replace("\r", " ").replace("\n", " ")
    return name[:MAX_LOGGED_NAME]


@app.middleware("http")
async def limit_request_size(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Refuses a body larger than the upload limit before it is parsed (when the client sends Content-Length)."""
    length = request.headers.get("content-length")
    if length is not None:
        try:
            too_large = int(length) > settings.max_upload_bytes + MULTIPART_OVERHEAD_BYTES
        except ValueError:
            return _error(400, "BAD_REQUEST", "The Content-Length header is not valid.")
        if too_large:
            return _error(413, "FILE_TOO_LARGE", f"Upload an invoice of at most {settings.max_upload_mb} MB.")
    return await call_next(request)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exception: Exception) -> JSONResponse:
    # The trace stays in the server log; the client only gets a generic message.
    logger.error("Unexpected error on %s %s: %s", request.method, request.url.path, type(exception).__name__, exc_info=exception)
    return _error(500, "INTERNAL_ERROR", "The OCR service could not handle the request. Try again later.")


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "tesseract": tesseract_available(settings)}


@app.post("/ocr/invoice")
async def ocr_invoice(file: UploadFile = File(...)) -> JSONResponse:
    """Reads an invoice (PDF, JPEG or PNG): text, confidence 0..1, header fields and lines."""
    name = _safe_name(file.filename)
    try:
        data = await file.read(settings.max_upload_bytes + 1)
    finally:
        await file.close()
    if not data:
        return _error(400, "EMPTY_FILE", "The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        return _error(413, "FILE_TOO_LARGE", f"Upload an invoice of at most {settings.max_upload_mb} MB.")

    try:
        result = process(data, file.filename, file.content_type, settings)
    except OcrError as error:
        logger.warning("OCR refused %s: %s", name, error.code)
        return _error(error.status, error.code, error.message)
    except Exception as exception:  # noqa: BLE001 - never answer 500 with a stack trace for a bad document
        logger.error("Unexpected OCR failure for %s: %s", name, type(exception).__name__, exc_info=exception)
        return _error(422, "OCR_FAILED", "The invoice could not be read.")

    logger.info("OCR done for %s: %s, %d pages, confidence %.2f", name, result.document_type, result.page_count, result.confidence)
    return JSONResponse(status_code=200, content=result.to_json())
