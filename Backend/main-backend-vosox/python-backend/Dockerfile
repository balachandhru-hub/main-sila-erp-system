FROM python:3.12-slim

# Tesseract reads scanned invoices; digital PDFs are read from their text layer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/python-backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

ENV OCR_LANGUAGE=eng \
    MAX_UPLOAD_MB=20

EXPOSE 8010
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
