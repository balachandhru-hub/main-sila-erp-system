#!/usr/bin/env python3
"""Send a supplier invoice when the connected API has no submit route.

The invoice is handed to the posting the server already runs. The request written
onto FIVE S4-INVOICE POSTING is the S/4 supplier-invoice document for this invoice.
"""

import base64
import datetime
import json
import re
import sys
import urllib.error
import urllib.request
import uuid
from decimal import Decimal
from pathlib import Path

import pymssql

API_NAME = "FIVE S4-INVOICE POSTING"
PROCESS_TYPE = "POST_INVOICE"
RESOURCE_PATH = "sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice"
GUID_CODE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class SubmitError(Exception):
    def __init__(self, status: int, message: str, description: str):
        super().__init__(description)
        self.status = status
        self.message = message
        self.description = description


def connect(settings_path: Path):
    settings = json.loads(settings_path.read_text())
    raw = settings["ConnectionStrings"]["DefaultConnection"]
    parts = {}
    for bit in raw.split(";"):
        if "=" in bit:
            key, value = bit.split("=", 1)
            parts[key.strip().lower()] = value.strip()
    host, port = parts["server"].split(",")
    return pymssql.connect(
        server=host,
        port=int(port),
        user=parts["user id"],
        password=parts["password"],
        database=parts.get("database") or parts.get("initial catalog"),
        login_timeout=8,
        timeout=25,
    )


def fetchone(cur, sql, params=()):
    cur.execute(sql, params)
    return cur.fetchone()


def fetchall(cur, sql, params=()):
    cur.execute(sql, params)
    return cur.fetchall()


def text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        quantized = value.quantize(Decimal("0.01"))
        rendered = format(quantized, "f")
        return rendered[:-3] if rendered.endswith(".00") else rendered.rstrip("0").rstrip(".")
    return str(value).strip()


MISSING = "INVOICE_POSTING_REQUIRED_FIELD_MISSING"
DOCUMENT_TYPE = "RE"
TAX_AUTOMATIC = "true"


def money(value) -> str:
    if value is None or text(value) == "":
        return ""
    return format(Decimal(str(value)).quantize(Decimal("0.01")), "f")


def quantity(value) -> str:
    if value is None or text(value) == "":
        return ""
    rendered = format(Decimal(str(value)), "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered


TAX_DATE_MISSING = (
    f"{MISSING}. Field: TaxDeterminationDate. "
    "Tax Determination Date is required for FIVE S/4 invoice posting because time-dependent taxes are active."
)


def ensure_five_header(prepared: dict) -> bool:
    """FIVE time-dependent taxes: store TaxDeterminationDate from the invoice date. Do not use today's date."""
    header = prepared.setdefault("header", [])
    document = ""
    for item in header:
        if item.get("apiField") == "DocumentDate":
            document = text(item.get("value"))
            break
    changed = False
    for item in header:
        if item.get("apiField") == "PostingDate" and item.get("source") == "CURRENT_DATE" and document:
            item["value"] = document
            item["source"] = "INVOICE"
            item["sourceField"] = "InvoiceDate"
            item["label"] = "Posting date"
            item["required"] = True
            changed = True
    tax = next((item for item in header if item.get("apiField") == "TaxDeterminationDate"), None)
    if tax is None:
        insert_at = 0
        for index, item in enumerate(header):
            if item.get("apiField") == "PostingDate":
                insert_at = index + 1
                break
        header.insert(insert_at, field("TaxDeterminationDate", "Tax determination date", document, "INVOICE", "InvoiceDate", True))
        changed = True
    elif document and not text(tax.get("value")):
        tax["value"] = document
        tax["source"] = "INVOICE"
        tax["sourceField"] = "InvoiceDate"
        tax["label"] = "Tax determination date"
        tax["required"] = True
        changed = True
    return changed


def sap_date(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%dT00:00:00")
    day = str(value).strip()[:10]
    return day + "T00:00:00" if len(day) == 10 and day[4] == "-" else ""


def ensure_storage(cur) -> None:
    cur.execute(
        """
        IF COL_LENGTH('buyersystem.invoice', 'posting_data') IS NULL
            ALTER TABLE buyersystem.invoice ADD posting_data nvarchar(max) NULL
        """
    )
    cur.execute(
        """
        IF COL_LENGTH('buyersystem.purchase_order_item', 'tax_code') IS NULL
            ALTER TABLE buyersystem.purchase_order_item ADD tax_code nvarchar(max) NULL
        """
    )
    cur.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = '20261017223000_InvoicePostingData')
            INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion)
            VALUES ('20261017223000_InvoicePostingData', '8.0.17')
        """
    )
    cur.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = '20261017234500_PurchaseOrderItemTaxCode')
            INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion)
            VALUES ('20261017234500_PurchaseOrderItemTaxCode', '8.0.17')
        """
    )


def field(api_field: str, label: str, value, source: str, source_field: str, required: bool) -> dict:
    rendered = text(value)
    return {
        "apiField": api_field,
        "label": label,
        "value": rendered or None,
        "source": source,
        "sourceField": source_field,
        "required": required,
    }


def fingerprint(number, invoice_date, currency, gross, net, tax, po_number, lines) -> str:
    parts = [
        text(number),
        sap_date(invoice_date)[:10],
        text(currency),
        money(gross),
        money(net),
        money(tax),
        text(po_number),
    ]
    for line in lines:
        item_id = ""
        if line["purchase_order_item_id"]:
            item_id = uuid.UUID(str(line["purchase_order_item_id"])).hex
        parts.append(":".join([
            str(int(line["line_number"])),
            quantity(line["quantity"]),
            money(line["amount"]),
            item_id,
        ]))
    return "|".join(parts)


def values_of(fields) -> dict:
    found = {}
    for item in fields or []:
        found[item.get("apiField")] = item.get("value")
    return found


def body_from_stored(prepared: dict) -> dict:
    header = values_of(prepared.get("header"))
    automatic_text = text(header.get("TaxIsCalculatedAutomatically"))
    if automatic_text.lower() not in {"true", "false"}:
        raise SubmitError(
            400,
            "Invoice cannot be submitted.",
            f"{MISSING}. Automatic tax calculation, from the invoice posting configuration.",
        )
    automatic = automatic_text.lower() == "true"
    required_header = (
        ("CompanyCode", "Company code, from the purchase order"),
        ("DocumentDate", "Document date, from the SILA invoice"),
        ("PostingDate", "Posting date, from the stored posting data"),
        ("DueCalculationBaseDate", "Due calculation base date, from the stored posting data"),
        ("TaxDeterminationDate", "Tax Determination Date is required for FIVE S/4 invoice posting because time-dependent taxes are active."),
        ("InvoicingParty", "Invoicing party, from the purchase order"),
        ("DocumentCurrency", "Currency, from the SILA invoice"),
        ("InvoiceGrossAmount", "Gross amount, from the SILA invoice"),
        ("AccountingDocumentType", "Accounting document type, from the invoice posting configuration"),
        ("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference, from the SILA invoice"),
    )
    for name, message in required_header:
        if not text(header.get(name)):
            if name == "TaxDeterminationDate":
                raise SubmitError(400, "Invoice cannot be submitted.", TAX_DATE_MISSING)
            raise SubmitError(400, "Invoice cannot be submitted.", f"{MISSING}. {message}.")
    results = []
    tax_codes = []
    for line in prepared.get("lines") or []:
        item = values_of(line.get("fields"))
        po = text(item.get("PurchaseOrder"))
        po_item = text(item.get("PurchaseOrderItem"))
        tax = text(item.get("TaxCode"))
        if not tax:
            raise SubmitError(
                400,
                "Invoice cannot be submitted.",
                f"{MISSING}. Field: TaxCode. PO: {po}. PO Item: {po_item}.",
            )
        for name, message in (
            ("SupplierInvoiceItem", "Invoice item, from the stored posting line"),
            ("PurchaseOrder", "Purchase order, from the purchase order"),
            ("PurchaseOrderItem", "Purchase order item, from the purchase order"),
            ("DocumentCurrency", "Currency, from the stored posting line"),
            ("SupplierInvoiceItemAmount", "Invoice amount, from the SILA invoice lines"),
            ("QuantityInPurchaseOrderUnit", "Invoice quantity, from the SILA invoice lines"),
            ("PurchaseOrderQuantityUnit", "PO UOM, from the purchase order item"),
        ):
            if not text(item.get(name)):
                raise SubmitError(400, "Invoice cannot be submitted.", f"{MISSING}. {message}. PO: {po}. PO Item: {po_item}.")
        tax_codes.append(tax)
        results.append({
            "SupplierInvoiceItem": text(item.get("SupplierInvoiceItem")),
            "PurchaseOrder": po,
            "PurchaseOrderItem": po_item,
            "DocumentCurrency": text(item.get("DocumentCurrency")),
            "SupplierInvoiceItemAmount": money(item.get("SupplierInvoiceItemAmount")),
            "QuantityInPurchaseOrderUnit": quantity(item.get("QuantityInPurchaseOrderUnit")),
            "PurchaseOrderQuantityUnit": text(item.get("PurchaseOrderQuantityUnit")),
            "TaxCode": tax,
        })
    if not results:
        raise SubmitError(400, "Invoice cannot be submitted.", f"{MISSING}. The invoice has no lines to post.")
    body = {
        "CompanyCode": text(header.get("CompanyCode")),
        "DocumentDate": text(header.get("DocumentDate")),
        "PostingDate": text(header.get("PostingDate")),
        "DueCalculationBaseDate": text(header.get("DueCalculationBaseDate")),
        "TaxDeterminationDate": text(header.get("TaxDeterminationDate")),
        "InvoicingParty": text(header.get("InvoicingParty")),
        "DocumentCurrency": text(header.get("DocumentCurrency")),
        "InvoiceGrossAmount": money(header.get("InvoiceGrossAmount")),
        "AccountingDocumentType": text(header.get("AccountingDocumentType")),
        "SupplierInvoiceIDByInvcgParty": text(header.get("SupplierInvoiceIDByInvcgParty")),
        "TaxIsCalculatedAutomatically": automatic,
        "to_SuplrInvcItemPurOrdRef": {"results": results},
    }
    if not automatic:
        distinct = list(dict.fromkeys(tax_codes))
        tax_amount = money(header.get("TaxAmount"))
        if not tax_amount or len(distinct) != 1:
            raise SubmitError(
                400,
                "Invoice cannot be submitted.",
                f"{MISSING}. Tax amount, from the SILA invoice. One tax code is required when tax is supplied explicitly.",
            )
        body["to_SupplierInvoiceTax"] = {
            "results": [{
                "TaxCode": distinct[0],
                "DocumentCurrency": text(header.get("DocumentCurrency")),
                "TaxAmount": tax_amount,
            }]
        }
    return body


def supplier_code(cur, buyer_id, sila_supplier_id, supplier_name) -> str:
    code = ""
    name = (supplier_name or "").strip()
    if sila_supplier_id:
        row = fetchone(
            cur,
            "SELECT supplier_code, name FROM buyersystem.sila_supplier WHERE id=%s AND is_active=1",
            (str(sila_supplier_id),),
        )
        if row:
            code = text(row[0])
            name = name or text(row[1])
    if code and not GUID_CODE.match(code):
        return code
    if name:
        rows = fetchall(
            cur,
            """
            SELECT supplier_code FROM buyersystem.sila_supplier
            WHERE buyer_id=%s AND is_active=1 AND name=%s
            """,
            (str(buyer_id), name),
        )
        for row in rows:
            candidate = text(row[0])
            if candidate and not GUID_CODE.match(candidate):
                return candidate
    raise SubmitError(
        400,
        "Invoice cannot be submitted.",
        "The purchase order supplier has no ERP supplier number. A system id cannot be sent as InvoicingParty.",
    )


def save_posting(cur, invoice_id: uuid.UUID, prepared: dict) -> None:
    cur.execute(
        "UPDATE buyersystem.invoice SET posting_data=%s, date_updated=GETUTCDATE() WHERE id=%s",
        (json.dumps(prepared, separators=(",", ":")), str(invoice_id)),
    )


def compose_posting(cur, invoice, lines) -> dict:
    order = fetchone(
        cur,
        "SELECT company_code, currency FROM buyersystem.purchase_order WHERE id=%s",
        (str(invoice[7]),),
    )
    company = text(order[0]) if order else ""
    po_currency = text(order[1]) if order else ""
    invoice_currency = text(invoice[4])
    currency_mismatch = bool(invoice_currency and po_currency and invoice_currency.upper() != po_currency.upper())
    currency = "" if currency_mismatch else (invoice_currency or po_currency)
    posted = sap_date(invoice[3])
    supplier = supplier_code(cur, invoice[1], invoice[8], invoice[9])
    prepared_lines = []
    for index, line in enumerate(lines, start=1):
        po_item = "" if line[4] is None else f"{int(line[4]):05d}"
        prepared_lines.append({
            "invoiceLine": int(line[0]),
            "invoiceItemId": str(line[6]) if line[6] else "00000000-0000-0000-0000-000000000000",
            "grnNumber": None,
            "materialDocument": None,
            "fields": [
                field("SupplierInvoiceItem", "Item", f"{index:05d}", "DERIVED", "LineNumber", True),
                field("PurchaseOrder", "PO", invoice[6], "S4_PO_HEADER", "PurchaseOrder", True),
                field("PurchaseOrderItem", "PO item", po_item, "S4_PO_ITEM", "PurchaseOrderItem", True),
                field("DocumentCurrency", "Currency", currency, "INVOICE", "Currency", True),
                field("SupplierInvoiceItemAmount", "Amount", money(line[2]), "INVOICE_LINE", "Amount", True),
                field("QuantityInPurchaseOrderUnit", "Quantity", quantity(line[1]), "INVOICE_LINE", "Quantity", True),
                field("PurchaseOrderQuantityUnit", "PO UOM", line[5], "S4_PO_ITEM", "PurchaseOrderQuantityUnit", True),
                field("TaxCode", "Tax code", line[7], "S4_PO_ITEM", "TaxCode", True),
            ],
        })
    actor = str(invoice[12]) if invoice[12] else "00000000-0000-0000-0000-000000000000"
    return {
        "version": 1,
        "preparationStatus": "VALIDATION_FAILED",
        "preparedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "preparedBy": actor,
        "purchaseOrder": text(invoice[6]) or None,
        "sourceApi": "FIVE S4 - GET PO",
        "stale": False,
        "fingerprint": fingerprint(invoice[2], invoice[3], invoice[4], invoice[5], invoice[13], invoice[14], invoice[6], [
            {
                "line_number": line[0],
                "quantity": line[1],
                "amount": line[2],
                "purchase_order_item_id": line[3],
            }
            for line in lines
        ]),
        "header": [
            field("CompanyCode", "Company code", company, "S4_PO_HEADER", "CompanyCode", True),
            field("DocumentDate", "Document date", posted, "INVOICE", "InvoiceDate", True),
            field("PostingDate", "Posting date", posted, "INVOICE", "InvoiceDate", True),
            field("TaxDeterminationDate", "Tax determination date", posted, "INVOICE", "InvoiceDate", True),
            field("DueCalculationBaseDate", "Due calculation base date", posted, "INVOICE", "InvoiceDate", True),
            field("InvoicingParty", "Invoicing party", supplier, "S4_PO_HEADER", "Supplier", True),
            field(
                "DocumentCurrency",
                "Currency does not match the purchase order" if currency_mismatch else "Currency",
                currency,
                "INVOICE",
                "Currency",
                True,
            ),
            field("InvoiceGrossAmount", "Gross amount", money(invoice[5]), "INVOICE", "GrossAmount", True),
            field("AccountingDocumentType", "Accounting document type", DOCUMENT_TYPE, "CONFIGURATION", "AccountingDocumentType", True),
            field("TaxIsCalculatedAutomatically", "Automatic tax calculation", TAX_AUTOMATIC, "CONFIGURATION", "TaxIsCalculatedAutomatically", True),
            field("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference", invoice[2], "INVOICE", "InvoiceNumber", True),
            field("PurchaseOrder", "Purchase order", invoice[6], "S4_PO_HEADER", "PurchaseOrder", False),
            field("NetAmount", "Net amount", money(invoice[13]), "INVOICE", "NetAmount", False),
            field("TaxAmount", "Tax amount", money(invoice[14]), "INVOICE", "TaxAmount", False),
        ],
        "lines": prepared_lines,
    }


def load_invoice(cur, invoice_id: uuid.UUID):
    invoice = fetchone(
        cur,
        """
        SELECT id, buyer_id, invoice_number, invoice_date, currency, gross_amount, po_number,
               purchase_order_id, sila_supplier_id, supplier_name, status, erp_posting_id, created_by,
               net_amount, tax_amount, posting_data
        FROM buyersystem.invoice
        WHERE id=%s AND is_active=1
        """,
        (str(invoice_id),),
    )
    if invoice is None:
        raise SubmitError(404, "Invoice not found.", "Open the invoice again.")
    lines = fetchall(
        cur,
        """
        SELECT ii.line_number, ii.quantity, ii.amount, ii.purchase_order_item_id,
               poi.line_number, poi.unit_of_measure, ii.id, poi.tax_code
        FROM buyersystem.invoice_item ii
        LEFT JOIN buyersystem.purchase_order_item poi ON poi.id = ii.purchase_order_item_id
        WHERE ii.invoice_id=%s AND ii.is_active=1
        ORDER BY ii.line_number
        """,
        (str(invoice_id),),
    )
    return invoice, lines


def document(cur, invoice_id: uuid.UUID) -> dict:
    """The SAP body is built from posting data stored on the invoice. This does not call GET PO."""
    ensure_storage(cur)
    invoice, lines = load_invoice(cur, invoice_id)
    number = text(invoice[2])
    if not number or not invoice[6] or invoice[7] is None:
        raise SubmitError(400, "Invoice cannot be submitted.", "The invoice needs an invoice number and a purchase order.")
    if not lines:
        raise SubmitError(400, "Invoice cannot be submitted.", "The invoice has no lines to post.")
    current = fingerprint(invoice[2], invoice[3], invoice[4], invoice[5], invoice[13], invoice[14], invoice[6], [
        {
            "line_number": line[0],
            "quantity": line[1],
            "amount": line[2],
            "purchase_order_item_id": line[3],
        }
        for line in lines
    ])
    raw = invoice[15]
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    prepared = None
    if text(raw):
        try:
            prepared = json.loads(raw)
        except json.JSONDecodeError:
            prepared = None
    if prepared is None:
        prepared = compose_posting(cur, invoice, lines)
        try:
            body_from_stored(prepared)
            prepared["preparationStatus"] = "READY_TO_POST"
        except SubmitError:
            prepared["preparationStatus"] = "VALIDATION_FAILED"
        save_posting(cur, invoice_id, prepared)
    elif prepared.get("fingerprint") != current or prepared.get("preparationStatus") == "POSTING_DATA_STALE":
        raise SubmitError(
            400,
            "Invoice cannot be submitted.",
            "Posting data is stale because the invoice changed after it was prepared. Refresh from S/4. The purchase order is not read again during reprocess.",
        )
    if ensure_five_header(prepared):
        save_posting(cur, invoice_id, prepared)
    company = text(values_of(prepared.get("header")).get("CompanyCode"))
    body = body_from_stored(prepared)
    return {
        "buyer_id": invoice[1],
        "number": number,
        "company": company,
        "created_by": invoice[12],
        "erp_posting_id": invoice[11],
        "body": body,
    }


def read_posting(cur, invoice_id: uuid.UUID) -> dict:
    ensure_storage(cur)
    row = fetchone(
        cur,
        "SELECT posting_data FROM buyersystem.invoice WHERE id=%s AND is_active=1",
        (str(invoice_id),),
    )
    if row is None or not text(row[0] if not isinstance(row[0], bytes) else row[0].decode("utf-8", "replace")):
        return {"ok": True, "postingData": None}
    raw = row[0].decode("utf-8", "replace") if isinstance(row[0], bytes) else row[0]
    try:
        prepared = json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": True, "postingData": None}
    if isinstance(prepared, dict) and ensure_five_header(prepared):
        save_posting(cur, invoice_id, prepared)
    return {"ok": True, "postingData": prepared}


GRN_POSTING_NAME = "FIVE S4-GRN POSTING"
GRN_POSTING_NAME_LEGACY = "FIVE S4 - POST GRN"


def ensure_api(cur, buyer_id, body: dict) -> None:
    payload = json.dumps(body, separators=(",", ":"))
    existing = fetchone(
        cur,
        """
        SELECT id FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND (process_type=%s OR name=%s)
        """,
        (str(buyer_id), PROCESS_TYPE, API_NAME),
    )
    if existing:
        cur.execute(
            """
            UPDATE buyersystem.api_integration_configuration
            SET name=%s, process_type=%s, status='ACTIVE', http_method='POST',
                resource_path=%s, request_body=%s, system_name='SAP S/4', date_updated=GETUTCDATE()
            WHERE id=%s
            """,
            (API_NAME, PROCESS_TYPE, RESOURCE_PATH, payload, str(existing[0])),
        )
        return
    source = fetchone(
        cur,
        """
        SELECT id FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND status='ACTIVE'
          AND name IN (%s, %s, %s)
        ORDER BY CASE name WHEN %s THEN 1 WHEN %s THEN 2 ELSE 3 END
        """,
        (
            str(buyer_id),
            API_NAME,
            GRN_POSTING_NAME,
            GRN_POSTING_NAME_LEGACY,
            API_NAME,
            GRN_POSTING_NAME,
        ),
    )
    if source is None:
        raise SubmitError(
            400,
            "Invoice cannot be submitted.",
            "No active FIVE S4-INVOICE POSTING connection is available to sign in to S/4.",
        )
    cur.execute(
        """
        INSERT INTO buyersystem.api_integration_configuration (
            id, buyer_id, entity_code, name, process_type, protocol, system_name, base_url, resource_path,
            authentication_type, username, protected_password, protected_client_id, protected_client_secret,
            protected_bearer_token, token_endpoint, token_scope, token_headers_json, token_body_json,
            api_key_header, protected_api_key, http_method, payload_format, request_body, headers_json,
            timeout_seconds, retry_count, page_size, is_running, status, date_created, date_updated, created_by, updated_by, is_active
        )
        SELECT NEWID(), buyer_id, entity_code, %s, %s, protocol, 'SAP S/4', base_url, %s,
               authentication_type, username, protected_password, protected_client_id, protected_client_secret,
               protected_bearer_token, token_endpoint, token_scope, token_headers_json, token_body_json,
               api_key_header, protected_api_key, 'POST', payload_format, %s, headers_json,
               timeout_seconds, retry_count, page_size, 0, 'ACTIVE', GETUTCDATE(), GETUTCDATE(), created_by, updated_by, 1
        FROM buyersystem.api_integration_configuration
        WHERE id=%s
        """,
        (API_NAME, PROCESS_TYPE, RESOURCE_PATH, payload, str(source[0])),
    )


def payload_of(built: dict) -> str:
    return json.dumps(built["body"], separators=(",", ":"))


def prepare(cur, invoice_id: uuid.UUID) -> dict:
    try:
        built = document(cur, invoice_id)
    except SubmitError as error:
        return {"ok": False, "status": error.status, "message": error.message, "description": error.description}
    ensure_api(cur, built["buyer_id"], built["body"])
    posting_id = built["erp_posting_id"]
    if posting_id:
        row = fetchone(
            cur,
            "SELECT status, erp_reference FROM buyersystem.inventory_erp_posting WHERE id=%s AND is_active=1",
            (str(posting_id),),
        )
        if row and (text(row[0]) in {"POSTED", "ERP_ACCEPTED", "FAILED_LOCAL"} or text(row[1])):
            raise SubmitError(409, "Invoice is already posted.", "SAP already accepted this invoice. It will not be posted again.")
        if row and text(row[0]) == "UNKNOWN":
            raise SubmitError(400, "Reconcile this invoice.", "SAP did not confirm whether the invoice was created. Reconcile it before anything is sent again.")
    else:
        posting_id = uuid.uuid4()
        actor = built["created_by"] or uuid.UUID(int=0)
        cur.execute(
            """
            INSERT INTO buyersystem.inventory_erp_posting (
                id, buyer_id, reference_type, reference_id, reference_number, movement_type, status, attempts,
                company_code, integration_system, erp_request_payload, date_created, date_updated, created_by, updated_by, is_active
            ) VALUES (%s, %s, 'INVOICE', %s, %s, 'INVOICE', 'FAILED', 0, %s, %s, %s, GETUTCDATE(), GETUTCDATE(), %s, %s, 1)
            """,
            (str(posting_id), str(built["buyer_id"]), str(invoice_id), built["number"], built["company"], API_NAME, payload_of(built), str(actor), str(actor)),
        )
        cur.execute(
            "UPDATE buyersystem.invoice SET erp_posting_id=%s, status='ERP_POSTING_FAILED', date_updated=GETUTCDATE() WHERE id=%s",
            (str(posting_id), str(invoice_id)),
        )
    cur.execute(
        """
        UPDATE buyersystem.inventory_erp_posting
        SET status='FAILED', error_message=%s, company_code=%s, integration_system=%s,
            erp_request_payload=%s, date_updated=GETUTCDATE()
        WHERE id=%s
        """,
        ("Queued for S/4 supplier invoice posting.", built["company"], API_NAME, payload_of(built), str(posting_id)),
    )
    return {"ok": True, "postingId": str(posting_id)}


def finish(cur, invoice_id: uuid.UUID, posting_id: uuid.UUID, transport_error: str) -> None:
    row = fetchone(
        cur,
        "SELECT status, error_message FROM buyersystem.inventory_erp_posting WHERE id=%s",
        (str(posting_id),),
    )
    status = text(row[0]) if row else "FAILED"
    error = text(row[1]) if row else ""
    if transport_error and status == "FAILED" and error == "Queued for S/4 supplier invoice posting.":
        error = transport_error
        cur.execute(
            "UPDATE buyersystem.inventory_erp_posting SET error_message=%s, date_updated=GETUTCDATE() WHERE id=%s",
            (error, str(posting_id)),
        )
    # A pending posting that already has an error is not still running. Leaving the invoice on POSTING hides Edit and Resubmit.
    if status == "PENDING" and error and error != "Queued for S/4 supplier invoice posting.":
        status = "FAILED"
    invoice_status = {
        "POSTED": "AWAITING_PAYMENT",
        "ERP_ACCEPTED": "AWAITING_PAYMENT",
        "UNKNOWN": "POSTING_UNKNOWN",
        "PENDING": "POSTING",
    }.get(status, "ERP_POSTING_FAILED")
    cur.execute(
        "UPDATE buyersystem.invoice SET status=%s, erp_posting_id=%s, date_updated=GETUTCDATE() WHERE id=%s",
        (invoice_status, str(posting_id), str(invoice_id)),
    )
    # The connected posting stores the body only after SAP answers. Keep the submitted JSON when that never happens.
    try:
        submitted = payload_of(document(cur, invoice_id))
    except SubmitError:
        submitted = ""
    if submitted:
        cur.execute(
            """
            UPDATE buyersystem.inventory_erp_posting
            SET erp_request_payload = CASE
                    WHEN erp_request_payload IS NULL OR LTRIM(RTRIM(erp_request_payload)) = '' THEN %s
                    ELSE erp_request_payload
                END
            WHERE id=%s
            """,
            (submitted, str(posting_id)),
        )


def delete_integration(cur, configuration_id: uuid.UUID) -> dict:
    row = fetchone(
        cur,
        """
        SELECT name, is_running
        FROM buyersystem.api_integration_configuration
        WHERE id=%s
        """,
        (str(configuration_id),),
    )
    if row is None:
        raise SubmitError(404, "Integration not found.", "Select an integration from the list.")
    if row[1]:
        raise SubmitError(409, "Integration is running.", "Wait for the current run to finish, then delete the API.")
    for table in (
        "buyersystem.api_field_mapping",
        "buyersystem.api_integration_execution",
        "buyersystem.integration_schema_snapshot",
    ):
        cur.execute(f"DELETE FROM {table} WHERE configuration_id=%s", (str(configuration_id),))
    cur.execute(
        "DELETE FROM buyersystem.api_integration_configuration WHERE id=%s",
        (str(configuration_id),),
    )
    return {"ok": True, "name": text(row[0])}


def posting_payload(cur, posting_id: uuid.UUID) -> dict:
    row = fetchone(
        cur,
        """
        SELECT reference_number, erp_request_payload, erp_response_payload, erp_http_status, error_message
        FROM buyersystem.inventory_erp_posting
        WHERE id=%s AND is_active=1
        """,
        (str(posting_id),),
    )
    if row is None:
        raise SubmitError(404, "Transaction not found.", "Select a transaction from this tracker.")
    stored = clip(row[1], 4000)
    response = clip(row[2], 4000)
    message = text(row[4])
    if response and response not in message:
        message = (message + "\n" + response).strip() if message else response
    return {
        "ok": True,
        "reference": text(row[0]),
        "technicalDetail": stored,
        "erpMessage": message,
        "erpHttpStatus": row[3],
    }


def clip(value, limit: int) -> str:
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    stored = text(value)
    return stored[:limit] if len(stored) > limit else stored


def attempt_text(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%dT%H:%M:%S.%f")
    return text(value)


def attempt(cur, posting_id: uuid.UUID) -> dict:
    posting = fetchone(
        cur,
        "SELECT reference_type, buyer_id FROM buyersystem.inventory_erp_posting WHERE id=%s AND is_active=1",
        (str(posting_id),),
    )
    if posting is None or text(posting[0]) != "INVOICE":
        return {"ok": True, "invoice": False, "lastAttemptAt": ""}
    row = fetchone(
        cur,
        """
        SELECT last_attempt_at FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND name=%s
        """,
        (str(posting[1]), API_NAME),
    )
    return {"ok": True, "invoice": True, "lastAttemptAt": attempt_text(row[0] if row else None)}


def sap_password(username: str, base_url: str) -> str:
    path = Path(__file__).resolve().parents[2] / ".data" / "custom-integrations.json"
    if not path.exists():
        raise SubmitError(400, "Invoice was not sent.", "FIVE S4-INVOICE POSTING was not called. The S/4 sign-in is not available on this machine.")
    try:
        saved = json.loads(path.read_text())
    except json.JSONDecodeError:
        raise SubmitError(400, "Invoice was not sent.", "FIVE S4-INVOICE POSTING was not called. The S/4 sign-in is not available on this machine.")
    host = base_url.rstrip("/").lower()
    for side in ("buyer", "supplier"):
        for row in saved.get(side) or []:
            public = row.get("public") or {}
            if text(public.get("username")) != username:
                continue
            if text(public.get("baseUrl")).rstrip("/").lower() != host:
                continue
            secret = text((row.get("secrets") or {}).get("password"))
            if secret:
                return secret
    raise SubmitError(400, "Invoice was not sent.", "FIVE S4-INVOICE POSTING was not called. The S/4 sign-in is not available on this machine.")


def sap_detail(body: str) -> str:
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        parsed = {}
    error = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(error, dict):
        message = error.get("message")
        detail = text(message.get("value")) if isinstance(message, dict) else text(message)
        code = text(error.get("code"))
        if code and detail:
            return f"{code}: {detail}"
        return detail or code
    flat = " ".join((body or "").split())
    return flat[:500]


def read_sap_value(body: str, names: tuple[str, ...]) -> str:
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return ""
    if isinstance(parsed, dict) and isinstance(parsed.get("d"), dict):
        parsed = parsed["d"]
    if not isinstance(parsed, dict):
        return ""
    for name in names:
        found = text(parsed.get(name))
        if found:
            return found
    return ""


def post_sap(base_url: str, resource: str, username: str, password: str, body: str, timeout: int) -> tuple[int, str, str]:
    """CSRF handshake, then one POST. Returns HTTP status, response text, and whether it was the token call or the invoice call."""
    url = f"{base_url.rstrip('/')}/{resource.lstrip('/')}"
    token_url = url + ("&" if "?" in url else "?") + "$top=0"
    auth = base64.b64encode(f"{username}:{password}".encode()).decode()
    common = {"Authorization": f"Basic {auth}", "Accept": "application/json"}
    fetch = urllib.request.Request(token_url, method="GET", headers={**common, "x-csrf-token": "Fetch"})
    try:
        with urllib.request.urlopen(fetch, timeout=timeout) as response:
            token = text(response.headers.get("x-csrf-token"))
            getter = getattr(response.headers, "get_all", None)
            cookies = getter("Set-Cookie") if getter else [response.headers.get("Set-Cookie")]
            cookies = [item for item in (cookies or []) if item]
            if response.status >= 400 or not token or token.lower() == "required":
                return response.status, response.read().decode("utf-8", "replace"), "csrf"
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), "csrf"
    cookie = "; ".join(
        part.split(";", 1)[0].strip()
        for part in cookies
        if "=" in part.split(";", 1)[0]
    )
    headers = {**common, "Content-Type": "application/json", "x-csrf-token": token}
    if cookie:
        headers["Cookie"] = cookie
    post = urllib.request.Request(url, data=body.encode("utf-8"), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(post, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace"), "post"
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), "post"


def remember_attempt(cur, buyer_id, invoice_id, attempt: int, result: str, erp_called: bool) -> None:
    """Keeps one retry-history row. The same result is not written twice, and an older HTTP error is not deleted."""
    flat = " ".join(result.split())
    if not flat:
        return
    marker = flat[:80].replace("%", "").replace("_", "")
    existing = fetchone(
        cur,
        """
        SELECT id FROM buyersystem.inventory_workflow_event
        WHERE reference_id=%s AND is_active=1 AND action='TRACKER_REPROCESS' AND comment LIKE %s
        """,
        (str(invoice_id), f"%{marker}%"),
    )
    if existing:
        return
    actor = "00000000-0000-0000-0000-000000000000"
    comment = (
        f"Stage=ERP; ErpCalled={'Yes' if erp_called else 'No'}; LocalCalled=No; "
        f"Attempt={attempt}; Previous=; Result={flat}"
    )[:1000]
    cur.execute(
        """
        INSERT INTO buyersystem.inventory_workflow_event (
            id, buyer_id, reference_type, reference_id, action, comment, actor_user_id,
            date_created, date_updated, created_by, updated_by, is_active
        ) VALUES (%s, %s, 'INVOICE', %s, 'TRACKER_REPROCESS', %s, %s, GETUTCDATE(), GETUTCDATE(), %s, %s, 1)
        """,
        (str(uuid.uuid4()), str(buyer_id), str(invoice_id), comment, actor, actor, actor),
    )


def preserve_current_attempt(cur, posting_id: uuid.UUID) -> None:
    row = fetchone(
        cur,
        """
        SELECT buyer_id, reference_id, attempts, error_message, erp_http_status
        FROM buyersystem.inventory_erp_posting
        WHERE id=%s AND is_active=1
        """,
        (str(posting_id),),
    )
    if row is None or not text(row[3]):
        return
    if row[4] is None and "HTTP" not in text(row[3]):
        return
    remember_attempt(cur, row[0], row[1], int(row[2] or 0), text(row[3]), row[4] is not None)


def deliver(cur, posting_id: uuid.UUID, attempt_before: str) -> dict:
    """The connected server drops the exception and never records an attempt. Send the stored body and keep the answer."""
    posting = fetchone(
        cur,
        """
        SELECT reference_type, reference_id, buyer_id, status, erp_reference, erp_http_status, erp_request_payload
        FROM buyersystem.inventory_erp_posting
        WHERE id=%s AND is_active=1
        """,
        (str(posting_id),),
    )
    if posting is None or text(posting[0]) != "INVOICE":
        return {"ok": True, "called": False}
    if text(posting[3]) in {"POSTED", "ERP_ACCEPTED", "FAILED_LOCAL"} or text(posting[4]):
        return {"ok": True, "called": False}
    api = fetchone(
        cur,
        """
        SELECT id, base_url, resource_path, username, timeout_seconds, last_attempt_at, request_body
        FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND name=%s
        """,
        (str(posting[2]), API_NAME),
    )
    if api is None:
        return {"ok": True, "called": False}
    if attempt_text(api[5]) != (attempt_before or ""):
        return {"ok": True, "called": False}
    preserve_current_attempt(cur, posting_id)
    invoice_id = posting[1]
    try:
        built = document(cur, invoice_id)
        body = json.dumps(built["body"], separators=(",", ":"))
    except SubmitError as error:
        record_delivery(cur, posting_id, api[0], invoice_id, None, "", "FAILED", error.description, clip(posting[6], 8000))
        return {"ok": True, "called": False, "message": error.description}
    try:
        password = sap_password(text(api[3]), text(api[1]))
        status, response, phase = post_sap(text(api[1]), text(api[2]), text(api[3]), password, body, int(api[4] or 30))
    except SubmitError as error:
        record_delivery(cur, posting_id, api[0], invoice_id, None, "", "FAILED", error.description, body)
        return {"ok": True, "called": False, "message": error.description}
    except Exception as error:
        reason = text(error) or error.__class__.__name__
        if "://" in reason:
            reason = reason.split("://", 1)[-1]
        message = f"FIVE S4-INVOICE POSTING was not reached. {reason}"[:1500]
        record_delivery(cur, posting_id, api[0], invoice_id, None, "", "FAILED", message, body)
        return {"ok": True, "called": True, "message": message}
    detail = sap_detail(response)
    if phase == "csrf":
        message = f"FIVE S4-INVOICE POSTING was not called. The sign-in token request returned HTTP {status}. {detail}".strip()
        record_delivery(cur, posting_id, api[0], invoice_id, status, response, "FAILED", message[:1500], body)
        return {"ok": True, "called": True, "http": status, "message": message[:1500]}
    if 200 <= status < 300:
        reference = read_sap_value(response, ("SupplierInvoice", "supplierInvoice"))
        record_delivery(cur, posting_id, api[0], invoice_id, status, response, "POSTED", None, body, reference, success=True)
        remember_attempt(cur, posting[2], invoice_id, int(fetch_attempts(cur, posting_id)), f"HTTP {status}. Supplier invoice {reference}".strip(), True)
        return {"ok": True, "called": True, "http": status, "reference": reference}
    outcome = "UNKNOWN" if status >= 500 or status == 408 else "FAILED"
    message = f"FIVE S4-INVOICE POSTING returned HTTP {status}. {detail}".strip()
    record_delivery(cur, posting_id, api[0], invoice_id, status, response, outcome, message[:1500], body)
    remember_attempt(cur, posting[2], invoice_id, int(fetch_attempts(cur, posting_id)), message, True)
    return {"ok": True, "called": True, "http": status, "message": message[:1500]}


def fetch_attempts(cur, posting_id: uuid.UUID) -> int:
    row = fetchone(cur, "SELECT attempts FROM buyersystem.inventory_erp_posting WHERE id=%s", (str(posting_id),))
    return int(row[0] or 0) if row else 0


def record_delivery(cur, posting_id, configuration_id, invoice_id, http_status, response: str, status: str, error: str | None, request_body: str, reference: str = "", success: bool = False) -> None:
    invoice_status = {"POSTED": "AWAITING_PAYMENT", "UNKNOWN": "POSTING_UNKNOWN"}.get(status, "ERP_POSTING_FAILED")
    cur.execute(
        """
        UPDATE buyersystem.inventory_erp_posting
        SET status=%s, error_message=%s, erp_http_status=%s,
            attempts=CASE WHEN %s IS NULL THEN attempts ELSE attempts + 1 END,
            erp_response_payload=%s,
            erp_request_payload=%s, erp_reference=CASE WHEN %s='' THEN erp_reference ELSE %s END,
            integration_system=%s, posted_on=CASE WHEN %s=1 THEN GETUTCDATE() ELSE posted_on END,
            date_updated=GETUTCDATE()
        WHERE id=%s
        """,
        (
            status,
            error,
            http_status,
            http_status,
            clip(response, 12000) or None,
            clip(request_body, 12000) or None,
            reference,
            reference,
            API_NAME,
            1 if success else 0,
            str(posting_id),
        ),
    )
    cur.execute(
        "UPDATE buyersystem.invoice SET status=%s, erp_posting_id=%s, date_updated=GETUTCDATE() WHERE id=%s",
        (invoice_status, str(posting_id), str(invoice_id)),
    )
    safe = (error or "")[:2000] or None
    cur.execute(
        """
        UPDATE buyersystem.api_integration_configuration
        SET last_attempt_at=GETUTCDATE(),
            last_error_safe=%s,
            last_successful_run_at=CASE WHEN %s=1 THEN GETUTCDATE() ELSE last_successful_run_at END,
            date_updated=GETUTCDATE()
        WHERE id=%s
        """,
        (safe, 1 if success else 0, str(configuration_id)),
    )


def fiscal_year_of(body: str) -> str:
    return read_sap_value(body, ("FiscalYear", "fiscalYear"))


def linked_key(invoice_id: str, year: str) -> str:
    number = "".join(invoice_id.split())
    fiscal = "".join(year.split())
    if not number or not fiscal:
        return ""
    return number + fiscal


def attachment_sentence(status: str, error: str, http_status, file_name: str, erp_reference: str, year: str) -> str:
    key = linked_key(erp_reference, year)
    bits = []
    if key:
        bits.append(f"key {key}")
    if file_name:
        bits.append(f"file {file_name}")
    if http_status:
        bits.append(f"HTTP {http_status}")
    detail = f" ({', '.join(bits)})" if bits else ""
    tail = f" {error}".rstrip() if error else ""
    if not status:
        return f"Attachment not sent{detail}."
    if status == "POSTED":
        return f"Attachment successful{detail}."
    if status in {"FAILED", "SKIPPED", "FAILED_LOCAL"}:
        return f"Attachment failed{detail}.{tail if error else ''}"
    if status == "UNKNOWN":
        return f"Attachment unknown{detail}.{tail if error else ' S/4 gave no clear answer.'}"
    return f"Attachment {status}{detail}."


def result_message(status: str, erp_reference: str, attachment_status: str, attachment_error: str, attachment_http, file_name: str, year: str) -> str:
    if status not in {"POSTED", "ERP_ACCEPTED"} or not erp_reference:
        return ""
    return (
        f"Successful. SAP invoice {erp_reference}. "
        + attachment_sentence(attachment_status, attachment_error, attachment_http, file_name, erp_reference, year)
    )


def retarget_posting_data(raw: str, invoice_number: str) -> str:
    if not raw or not invoice_number:
        return ""
    try:
        document = json.loads(raw)
    except json.JSONDecodeError:
        return ""
    header = document.get("header") if isinstance(document, dict) else None
    if not isinstance(header, list):
        return ""
    for field in header:
        if not isinstance(field, dict):
            continue
        name = field.get("apiField") or field.get("ApiField")
        if name != "SupplierInvoiceIDByInvcgParty":
            continue
        if "value" in field:
            field["value"] = invoice_number
        elif "Value" in field:
            field["Value"] = invoice_number
        else:
            field["value"] = invoice_number
    return json.dumps(document, separators=(",", ":"))


PUBLIC_DOCUMENT = "https://sila-api.chervicaon.com"


def document_url(invoice_id) -> str:
    return f"{PUBLIC_DOCUMENT}/api/v1/buyer/sila/invoices/{invoice_id}/file"


def url_from_request(body: str) -> str:
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return ""
    if not isinstance(parsed, dict):
        return ""
    return text(parsed.get("Url") or parsed.get("url"))


def attachment_body(key: str, url: str, file_name: str) -> str:
    return json.dumps(
        {
            "BusinessObjectTypeName": "BUS2081",
            "LinkedSAPObjectKey": key,
            "Url": url,
            "FileName": file_name,
        },
        separators=(",", ":"),
    )


def attachment_view(cur, invoice_id: uuid.UUID) -> dict:
    """The document path is known as soon as the SAP invoice and fiscal year are stored. The attachment API is a later call."""
    invoice = fetchone(
        cur,
        "SELECT file_name, invoice_number FROM buyersystem.invoice WHERE id=%s AND is_active=1",
        (str(invoice_id),),
    )
    if invoice is None:
        return {"ok": False}
    posting = fetchone(
        cur,
        """
        SELECT TOP 1 status, erp_reference, erp_response_payload
        FROM buyersystem.inventory_erp_posting
        WHERE reference_id=%s AND reference_type='INVOICE' AND is_active=1
        ORDER BY CASE WHEN status='POSTED' THEN 0 ELSE 1 END, date_updated DESC
        """,
        (str(invoice_id),),
    )
    attachment = fetchone(
        cur,
        """
        SELECT TOP 1 status, error_message, erp_http_status, erp_request_payload
        FROM buyersystem.inventory_erp_posting
        WHERE reference_id=%s AND reference_type='INVOICE_ATTACHMENT' AND is_active=1
        ORDER BY date_updated DESC
        """,
        (str(invoice_id),),
    )
    status = text(posting[0]) if posting else ""
    reference = text(posting[1]) if posting else ""
    year = fiscal_year_of(text(posting[2]) if posting else "")
    key = linked_key(reference, year)
    posted = status in {"POSTED", "ERP_ACCEPTED"} and bool(reference)
    file_name = text(invoice[0]) or text(invoice[1])
    stored_url = url_from_request(text(attachment[3]) if attachment else "")
    url = stored_url or (document_url(invoice_id) if posted and key else "")
    http_status = attachment[2] if attachment else None
    if not posted or not key:
        label = "Not started"
        message = "The linked key is the SAP invoice number plus the fiscal year. Both are stored when FIVE S4-INVOICE POSTING succeeds."
        if posted and not year:
            message = "The SAP invoice number is stored, but the fiscal year was not in the posting response, so the linked key cannot be built."
    elif attachment is None or text(attachment[0]) in {"PENDING", ""}:
        label = "Pending"
        message = "Attachment path updated. The attachment API has not been called."
    elif text(attachment[0]) == "POSTED":
        label = "Success"
        message = f"Updated successfully. HTTP {http_status}." if http_status else "Updated successfully."
    elif text(attachment[0]) in {"FAILED", "SKIPPED", "FAILED_LOCAL"}:
        label = "Failed"
        message = text(attachment[1]) or "The attachment was not accepted."
    elif text(attachment[0]) == "UNKNOWN":
        label = "Unknown"
        message = text(attachment[1]) or "S/4 gave no clear answer. Reconcile the attachment before it is sent again."
    else:
        label = "Pending"
        message = "Attachment path updated. The attachment API has not been called."
    return {
        "ok": True,
        "erpReference": reference or None,
        "fiscalYear": year or None,
        "attachment": {
            "businessObject": "Supplier Invoice",
            "businessObjectType": "BUS2081",
            "linkedSapObjectKey": key or None,
            "fileName": file_name or None,
            "url": url or None,
            "httpStatus": http_status,
            "status": label,
            "message": message,
            "canReprocess": label in {"Failed", "Pending"},
        },
    }


def service_document(resource: str) -> str:
    path = resource.lstrip("/")
    marker = "API_CV_ATTACHMENT_SRV"
    index = path.find(marker)
    if index >= 0:
        return path[: index + len(marker)] + "/"
    return path


def post_action(base_url: str, resource: str, username: str, password: str, body: str, timeout: int) -> tuple[int | None, str, str]:
    """CSRF from the attachment service document, then one POST to CreateUrlAsAttachment. The action is not called with $top."""
    token_url = f"{base_url.rstrip('/')}/{service_document(resource).lstrip('/')}"
    post_url = f"{base_url.rstrip('/')}/{resource.lstrip('/')}"
    auth = base64.b64encode(f"{username}:{password}".encode()).decode()
    common = {"Authorization": f"Basic {auth}", "Accept": "application/json"}
    fetch = urllib.request.Request(token_url, method="GET", headers={**common, "x-csrf-token": "Fetch"})
    try:
        with urllib.request.urlopen(fetch, timeout=timeout) as response:
            token = text(response.headers.get("x-csrf-token"))
            getter = getattr(response.headers, "get_all", None)
            cookies = getter("Set-Cookie") if getter else [response.headers.get("Set-Cookie")]
            cookies = [item for item in (cookies or []) if item]
            if response.status >= 400 or not token or token.lower() == "required":
                return response.status, response.read().decode("utf-8", "replace"), "csrf"
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), "csrf"
    except (TimeoutError, urllib.error.URLError) as error:
        return None, text(error), "timeout"
    cookie = "; ".join(
        part.split(";", 1)[0].strip()
        for part in cookies
        if "=" in part.split(";", 1)[0]
    )
    headers = {**common, "Content-Type": "application/json", "x-csrf-token": token}
    if cookie:
        headers["Cookie"] = cookie
    post = urllib.request.Request(post_url, data=body.encode("utf-8"), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(post, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace"), "post"
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), "post"
    except (TimeoutError, urllib.error.URLError) as error:
        return None, text(error), "timeout"


def attachment_endpoint(cur, buyer_id) -> tuple[str, str, str, str, int]:
    row = fetchone(
        cur,
        """
        SELECT TOP 1 base_url, resource_path, username, timeout_seconds
        FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND status='ACTIVE'
          AND (resource_path LIKE %s OR name IN ('API_CV_ATTACHMENT_SRV', 'FIVE S4 - INVOICE ATTACHMENT', 'POST_API_CV_ATTACHMENT_SRV'))
        """,
        (str(buyer_id), "%API_CV_ATTACHMENT_SRV%"),
    )
    if row and text(row[0]) and text(row[1]) and text(row[2]):
        return text(row[0]), text(row[1]), text(row[2]), sap_password(text(row[2]), text(row[0])), int(row[3] or 30)
    path = Path(__file__).resolve().parents[2] / ".data" / "custom-integrations.json"
    if not path.exists():
        raise SubmitError(400, "Attachment was not sent.", "No active API_CV_ATTACHMENT_SRV API is configured. The invoice was not posted again.")
    try:
        saved = json.loads(path.read_text())
    except json.JSONDecodeError:
        raise SubmitError(400, "Attachment was not sent.", "No active API_CV_ATTACHMENT_SRV API is configured. The invoice was not posted again.")
    for side in ("buyer", "supplier"):
        for item in saved.get(side) or []:
            public = item.get("public") or {}
            resource = text(public.get("resourcePath"))
            if "API_CV_ATTACHMENT_SRV" not in resource and text(public.get("name")) not in {
                "API_CV_ATTACHMENT_SRV",
                "FIVE S4 - INVOICE ATTACHMENT",
                "POST_API_CV_ATTACHMENT_SRV",
            }:
                continue
            if text(public.get("status")).upper() not in {"ACTIVE", "TESTED"}:
                continue
            username = text(public.get("username"))
            base = text(public.get("baseUrl"))
            if not username or not base or not resource:
                continue
            return base, resource, username, sap_password(username, base), int(public.get("timeoutSeconds") or 30)
    raise SubmitError(400, "Attachment was not sent.", "No active API_CV_ATTACHMENT_SRV API is configured. The invoice was not posted again.")


def send_attachment(cur, invoice_id: uuid.UUID) -> dict:
    """Calls only CreateUrlAsAttachment. The supplier invoice posting is not sent again."""
    invoice = fetchone(
        cur,
        "SELECT buyer_id, file_name, invoice_number FROM buyersystem.invoice WHERE id=%s AND is_active=1",
        (str(invoice_id),),
    )
    if invoice is None:
        raise SubmitError(404, "Invoice not found.", "Choose an invoice from the list.")
    posting = fetchone(
        cur,
        """
        SELECT TOP 1 status, erp_reference, erp_response_payload, company_code, location_id
        FROM buyersystem.inventory_erp_posting
        WHERE reference_id=%s AND reference_type='INVOICE' AND is_active=1
        ORDER BY CASE WHEN status='POSTED' THEN 0 ELSE 1 END, date_updated DESC
        """,
        (str(invoice_id),),
    )
    status = text(posting[0]) if posting else ""
    reference = text(posting[1]) if posting else ""
    year = fiscal_year_of(text(posting[2]) if posting else "")
    key = linked_key(reference, year)
    if status not in {"POSTED", "ERP_ACCEPTED"} or not reference or not key:
        raise SubmitError(
            400,
            "Attachment was not sent.",
            "The SAP invoice number and fiscal year must both be stored. The invoice was not posted again.",
        )
    existing = fetchone(
        cur,
        """
        SELECT TOP 1 id, status, attempts
        FROM buyersystem.inventory_erp_posting
        WHERE reference_id=%s AND reference_type='INVOICE_ATTACHMENT' AND is_active=1
        ORDER BY date_updated DESC
        """,
        (str(invoice_id),),
    )
    if existing and text(existing[1]) == "POSTED":
        return {"ok": True, "called": False}
    if existing and text(existing[1]) == "UNKNOWN":
        raise SubmitError(
            409,
            "Reconcile the attachment.",
            "S/4 did not confirm whether the link was created. The invoice was not posted again.",
        )
    file_name = text(invoice[1]) or text(invoice[2]) or "InvoiceReferenceLink"
    url = document_url(invoice_id)
    body = attachment_body(key, url, file_name)
    actor = "00000000-0000-0000-0000-000000000000"
    if existing is None:
        attachment_id = uuid.uuid4()
        cur.execute(
            """
            INSERT INTO buyersystem.inventory_erp_posting (
                id, buyer_id, reference_type, reference_id, reference_number, location_id, movement_type,
                status, attempts, error_message, date_created, date_updated, created_by, updated_by, is_active,
                company_code, erp_request_payload, integration_system
            ) VALUES (
                %s, %s, 'INVOICE_ATTACHMENT', %s, %s, %s, 'SUPPLIER_INVOICE_ATTACHMENT',
                'PENDING', 0, %s, GETUTCDATE(), GETUTCDATE(), %s, %s, 1,
                %s, %s, 'POST_API_CV_ATTACHMENT_SRV'
            )
            """,
            (
                str(attachment_id),
                str(invoice[0]),
                str(invoice_id),
                text(invoice[2]) or file_name,
                posting[4],
                "Attachment path updated. The attachment API has not been called.",
                actor,
                actor,
                posting[3],
                body,
            ),
        )
        attempts = 0
    else:
        attachment_id = existing[0]
        attempts = int(existing[2] or 0)
        cur.execute(
            """
            UPDATE buyersystem.inventory_erp_posting
            SET status='PENDING', error_message=%s, erp_request_payload=%s, erp_http_status=NULL,
                erp_response_payload=NULL, date_updated=GETUTCDATE()
            WHERE id=%s
            """,
            ("Attachment path updated. The attachment API has not been called.", body, str(attachment_id)),
        )
    base_url, resource, username, password, timeout = attachment_endpoint(cur, invoice[0])
    http_status, response, phase = post_action(base_url, resource, username, password, body, timeout)
    detail = sap_detail(response) if response else ""
    if phase == "timeout" or http_status is None:
        cur.execute(
            """
            UPDATE buyersystem.inventory_erp_posting
            SET status='UNKNOWN', attempts=attempts+1, error_message=%s, date_updated=GETUTCDATE()
            WHERE id=%s
            """,
            ((detail or "S/4 gave no clear answer.")[:2000], str(attachment_id)),
        )
        return {"ok": True, "called": True, "httpStatus": None}
    success = 200 <= int(http_status) < 300 and phase == "post"
    if success:
        cur.execute(
            """
            UPDATE buyersystem.inventory_erp_posting
            SET status='POSTED', attempts=attempts+1, erp_reference=%s, erp_http_status=%s,
                erp_response_payload=%s, error_message=NULL, posted_on=GETUTCDATE(), date_updated=GETUTCDATE()
            WHERE id=%s
            """,
            (key, int(http_status), response[:4000], str(attachment_id)),
        )
    else:
        message = detail or f"HTTP {http_status}"
        if phase == "csrf":
            message = f"The attachment token request failed. HTTP {http_status}. {detail}".strip()
        cur.execute(
            """
            UPDATE buyersystem.inventory_erp_posting
            SET status='FAILED', attempts=attempts+1, erp_http_status=%s, erp_response_payload=%s,
                error_message=%s, date_updated=GETUTCDATE()
            WHERE id=%s
            """,
            (int(http_status), (response or "")[:4000], message[:2000], str(attachment_id)),
        )
    return {"ok": True, "called": True, "httpStatus": int(http_status), "success": success}


def invoice_family(cur, posting_id: uuid.UUID):
    posting = fetchone(
        cur,
        """
        SELECT reference_type, reference_id, buyer_id
        FROM buyersystem.inventory_erp_posting
        WHERE id=%s AND is_active=1
        """,
        (str(posting_id),),
    )
    if posting is None or text(posting[0]) not in {"INVOICE", "INVOICE_ATTACHMENT"}:
        return None
    return posting


def describe_invoice(cur, buyer_id, invoice_id) -> dict:
    invoice = fetchone(
        cur,
        """
        SELECT invoice_number, po_number, file_name, posting_data
        FROM buyersystem.invoice
        WHERE id=%s AND buyer_id=%s AND is_active=1
        """,
        (str(invoice_id), str(buyer_id)),
    )
    postings = fetchall(
        cur,
        """
        SELECT reference_type, status, erp_reference, erp_http_status, error_message,
               erp_request_payload, erp_response_payload, date_updated
        FROM buyersystem.inventory_erp_posting
        WHERE buyer_id=%s AND reference_id=%s AND is_active=1
          AND reference_type IN ('INVOICE', 'INVOICE_ATTACHMENT')
        ORDER BY date_updated DESC
        """,
        (str(buyer_id), str(invoice_id)),
    )
    invoice_posting = next((row for row in postings if text(row[0]) == "INVOICE" and text(row[1]) == "POSTED"), None)
    if invoice_posting is None:
        invoice_posting = next((row for row in postings if text(row[0]) == "INVOICE"), None)
    attachment = next((row for row in postings if text(row[0]) == "INVOICE_ATTACHMENT"), None)
    po = fetchone(
        cur,
        """
        SELECT resource_path FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND name=%s
        """,
        (str(buyer_id), "FIVE S4 - GET PO"),
    )
    response = text(invoice_posting[6]) if invoice_posting else ""
    erp_reference = text(invoice_posting[2]) if invoice_posting else ""
    year = fiscal_year_of(response)
    file_name = text(invoice[2]) if invoice else ""
    attachment_status = text(attachment[1]) if attachment else ""
    attachment_error = text(attachment[4]) if attachment else ""
    attachment_http = attachment[3] if attachment else None
    message = result_message(
        text(invoice_posting[1]) if invoice_posting else "",
        erp_reference,
        attachment_status,
        attachment_error,
        attachment_http,
        file_name,
        year,
    )
    po_number = text(invoice[1]) if invoice else ""
    posting_data = text(invoice[3]) if invoice else ""
    resource = text(po[0]) if po else ""
    request_body = text(invoice_posting[5]) if invoice_posting else ""
    invoice_http = invoice_posting[3] if invoice_posting else None
    attachment_request = text(attachment[5]) if attachment else ""
    attachment_response = text(attachment[6]) if attachment else ""
    key = linked_key(erp_reference, year)
    invoice_status = "NOT_STARTED"
    if request_body:
        if invoice_http is not None and 200 <= int(invoice_http) < 300:
            invoice_status = "SUCCESS"
        elif invoice_http is not None and int(invoice_http) >= 400:
            invoice_status = "FAILED"
        else:
            invoice_status = "PROCESSING"
    if not attachment_status:
        attachment_step = "NOT_STARTED"
    elif attachment_status == "POSTED":
        attachment_step = "SUCCESS"
    elif attachment_status in {"FAILED", "SKIPPED", "FAILED_LOCAL"}:
        attachment_step = "FAILED"
    elif attachment_status == "UNKNOWN":
        attachment_step = "UNKNOWN"
    else:
        attachment_step = "PROCESSING"
    po_lines = ["FIVE S4 - GET PO"]
    if resource:
        po_lines.append(resource)
    if po_number:
        po_lines.append(f"Purchase order {po_number}")
    not_sent = (
        "Not sent. The attachment API was not called.\n"
        "BusinessObjectTypeName: BUS2081\n"
        f"LinkedSAPObjectKey: {key or '—'}\n"
        f"FileName: {file_name or '—'}"
    )
    http_text = "" if invoice_http is None else f"HTTP {invoice_http}"
    invoice_text = f"SAP invoice {erp_reference}" if erp_reference else ""
    response_detail = ". ".join(part for part in (http_text, invoice_text) if part)
    if response_detail:
        response_detail += "."
    else:
        response_detail = "No invoice response was stored."
    steps = [
        {
            "name": "PO API Retrieval",
            "status": "SUCCESS" if posting_data else "NOT_STARTED",
            "detail": f"FIVE S4 - GET PO · purchase order {po_number}" if po_number else "FIVE S4 - GET PO",
            "request": "\n".join(po_lines),
            "response": posting_data or "PO retrieval was not stored for this invoice.",
        },
        {
            "name": "Invoice submission",
            "status": invoice_status,
            "detail": "FIVE S4-INVOICE POSTING" if request_body else "The invoice was not sent.",
            "request": request_body or "The invoice was not sent.",
            "response": None,
        },
        {
            "name": "Response",
            "status": invoice_status,
            "detail": response_detail,
            "request": None,
            "response": response or "No invoice response was stored.",
        },
        {
            "name": "Invoice attachment request",
            "status": attachment_step,
            "detail": "API_CV_ATTACHMENT_SRV" if attachment_request else "The attachment API was not called.",
            "request": attachment_request or not_sent,
            "response": None,
        },
        {
            "name": "Response",
            "status": attachment_step,
            "detail": attachment_sentence(attachment_status, attachment_error, attachment_http, file_name, erp_reference, year)
            if attachment_status else "No attachment response was stored.",
            "request": None,
            "response": attachment_response or (attachment_error or "Not sent."),
        },
    ]
    return {"erpInvoiceId": erp_reference or None, "message": message or None, "steps": steps}


def invoice_flow(cur, posting_id: uuid.UUID) -> dict:
    posting = invoice_family(cur, posting_id)
    if posting is None:
        raise SubmitError(404, "Transaction not found.", "Select an invoice transaction from this tracker.")
    view = describe_invoice(cur, posting[2], posting[1])
    return {"ok": True, **view}


def invoice_results(cur, posting_ids: list) -> dict:
    results = []
    seen = {}
    for raw in posting_ids[:200]:
        try:
            posting_id = uuid.UUID(str(raw))
        except ValueError:
            continue
        posting = invoice_family(cur, posting_id)
        if posting is None:
            continue
        key = str(posting[1])
        if key not in seen:
            seen[key] = describe_invoice(cur, posting[2], posting[1])
        view = seen[key]
        if not view.get("message"):
            continue
        results.append({"id": str(posting_id), "erpInvoiceId": view.get("erpInvoiceId"), "message": view.get("message")})
    return {"ok": True, "results": results}


def next_invoice_number(cur, buyer_id, original: str) -> str:
    root = (original or "INVOICE").strip() or "INVOICE"
    if len(root) > 80:
        root = root[:80]
    candidate = root + "-COPY"
    for suffix in range(2, 50):
        taken = fetchone(
            cur,
            "SELECT id FROM buyersystem.invoice WHERE buyer_id=%s AND is_active=1 AND invoice_number=%s",
            (str(buyer_id), candidate),
        )
        if taken is None:
            return candidate
        candidate = f"{root}-COPY-{suffix}"
    return root + "-COPY-" + uuid.uuid4().hex[:6]


def copy_invoice(cur, invoice_id: uuid.UUID) -> dict:
    source = fetchone(
        cur,
        """
        SELECT buyer_id, invoice_number, supplier_id, supplier_name, invoice_date, currency, gross_amount,
               purchase_order_id, po_number, file_path, file_name, ocr_text, ocr_confidence, uploaded_by,
               sila_supplier_id, invoice_type, net_amount, tax_amount, supplier_tax_number, posting_data, created_by
        FROM buyersystem.invoice
        WHERE id=%s AND is_active=1
        """,
        (str(invoice_id),),
    )
    if source is None:
        raise SubmitError(404, "Invoice not found.", "Choose an invoice from the list.")
    number = next_invoice_number(cur, source[0], text(source[1]))
    ready = bool(number and source[4] is not None and source[6] is not None and (source[14] or text(source[3])))
    status = "REVIEWED" if ready else "UPLOADED"
    new_id = uuid.uuid4()
    actor = source[20] or source[13]
    posting_data = retarget_posting_data(text(source[19]), number) or None
    cur.execute(
        """
        INSERT INTO buyersystem.invoice (
            id, buyer_id, invoice_number, supplier_id, supplier_name, invoice_date, currency, gross_amount,
            purchase_order_id, po_number, file_path, file_name, status, ocr_text, ocr_confidence, uploaded_by,
            date_created, date_updated, created_by, updated_by, is_active, content_hash, erp_posting_id,
            invoice_type, net_amount, sila_supplier_id, supplier_tax_number, tax_amount, posting_data
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            GETUTCDATE(), GETUTCDATE(), %s, %s, 1, NULL, NULL,
            %s, %s, %s, %s, %s, %s
        )
        """,
        (
            str(new_id), str(source[0]), number, source[2], source[3], source[4], source[5], source[6],
            source[7], source[8], source[9], source[10], status, source[11], source[12], source[13],
            str(actor), str(actor),
            source[15], source[16], source[14], source[18], source[17], posting_data,
        ),
    )
    items = fetchall(
        cur,
        """
        SELECT line_number, description, quantity, unit_price, amount, purchase_order_item_id,
               uom, supplier_material_code, tax_rate, match_status
        FROM buyersystem.invoice_item
        WHERE invoice_id=%s AND is_active=1
        """,
        (str(invoice_id),),
    )
    for item in items:
        cur.execute(
            """
            INSERT INTO buyersystem.invoice_item (
                id, invoice_id, line_number, description, quantity, unit_price, amount, purchase_order_item_id,
                date_created, date_updated, created_by, updated_by, is_active,
                match_status, supplier_material_code, tax_rate, uom
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                GETUTCDATE(), GETUTCDATE(), %s, %s, 1,
                %s, %s, %s, %s
            )
            """,
            (
                str(uuid.uuid4()), str(new_id), item[0], item[1], item[2], item[3], item[4], item[5],
                str(actor), str(actor),
                item[9], item[7], item[8], item[6],
            ),
        )
    return {"ok": True, "id": str(new_id), "invoiceNumber": number, "status": status}


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    action = payload.get("action")
    settings = Path(payload.get("settings") or "")
    connection = connect(settings)
    try:
        cursor = connection.cursor()
        if action == "payload":
            print(json.dumps(posting_payload(cursor, uuid.UUID(str(payload.get("postingId"))))))
            return
        if action == "flow":
            print(json.dumps(invoice_flow(cursor, uuid.UUID(str(payload.get("postingId"))))))
            return
        if action == "invoice-results":
            print(json.dumps(invoice_results(cursor, payload.get("ids") or [])))
            return
        if action == "copy":
            copied = copy_invoice(cursor, uuid.UUID(str(payload.get("invoiceId"))))
            connection.commit()
            print(json.dumps(copied))
            return
        if action == "attempt":
            print(json.dumps(attempt(cursor, uuid.UUID(str(payload.get("postingId"))))))
            return
        if action == "deliver":
            sent = deliver(cursor, uuid.UUID(str(payload.get("postingId"))), text(payload.get("attemptBefore")))
            connection.commit()
            print(json.dumps(sent))
            return
        if action == "delete":
            removed = delete_integration(cursor, uuid.UUID(str(payload.get("configurationId"))))
            connection.commit()
            print(json.dumps(removed))
            return
        invoice_id = uuid.UUID(str(payload.get("invoiceId")))
        if action == "attachment-view":
            print(json.dumps(attachment_view(cursor, invoice_id)))
            return
        if action == "attach":
            sent = send_attachment(cursor, invoice_id)
            connection.commit()
            print(json.dumps(sent))
            return
        if action == "posting":
            stored = read_posting(cursor, invoice_id)
            connection.commit()
            print(json.dumps(stored))
            return
        if action == "prepare":
            result = prepare(cursor, invoice_id)
            connection.commit()
            print(json.dumps(result))
            return
        if action == "finish":
            finish(cursor, invoice_id, uuid.UUID(str(payload.get("postingId"))), text(payload.get("transportError")))
            connection.commit()
            print(json.dumps({"ok": True}))
            return
        print(json.dumps({"ok": False, "status": 500, "message": "Invoice was not submitted.", "description": "Invoice was not submitted."}))
    except SubmitError as error:
        connection.rollback()
        print(json.dumps({"ok": False, "status": error.status, "message": error.message, "description": error.description}))
    except Exception as error:
        connection.rollback()
        fallback = "The attachment was not sent. The invoice was not posted again." if action == "attach" else "Invoice was not submitted."
        print(json.dumps({"ok": False, "status": 500, "message": fallback, "description": text(error) or fallback}))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
