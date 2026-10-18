#!/usr/bin/env python3
"""Send a supplier invoice when the connected API has no submit route.

The invoice is handed to the posting the server already runs. The request written
onto FIVE S4-INVOICE POSTING is the S/4 supplier-invoice document for this invoice.
"""

import datetime
import json
import re
import sys
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


def current_posting_date() -> str:
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT00:00:00")


def stamp_posting_date(prepared: dict) -> bool:
    current = current_posting_date()
    for item in prepared.get("header") or []:
        if item.get("apiField") == "PostingDate":
            changed = item.get("value") != current or item.get("source") != "CURRENT_DATE"
            item["value"] = current
            item["label"] = "Posting date"
            item["source"] = "CURRENT_DATE"
            item["sourceField"] = "UtcToday"
            item["required"] = True
            return changed
    prepared.setdefault("header", []).append(
        field("PostingDate", "Posting date", current, "CURRENT_DATE", "UtcToday", True)
    )
    return True


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
        ("InvoicingParty", "Invoicing party, from the purchase order"),
        ("DocumentCurrency", "Currency, from the SILA invoice"),
        ("InvoiceGrossAmount", "Gross amount, from the SILA invoice"),
        ("AccountingDocumentType", "Accounting document type, from the invoice posting configuration"),
        ("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference, from the SILA invoice"),
    )
    for name, message in required_header:
        if not text(header.get(name)):
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
            field("PostingDate", "Posting date", current_posting_date(), "CURRENT_DATE", "UtcToday", True),
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
    if stamp_posting_date(prepared):
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
    if isinstance(prepared, dict) and stamp_posting_date(prepared):
        save_posting(cur, invoice_id, prepared)
    return {"ok": True, "postingData": prepared}


def ensure_api(cur, buyer_id, body: dict) -> None:
    source = fetchone(
        cur,
        """
        SELECT id FROM buyersystem.api_integration_configuration
        WHERE buyer_id=%s AND is_active=1 AND name='FIVE S4 - POST GRN' AND status='ACTIVE'
        """,
        (str(buyer_id),),
    )
    if source is None:
        raise SubmitError(400, "Invoice cannot be submitted.", "No active FIVE S4 - POST GRN connection is available to sign in to S/4.")
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
        SELECT reference_number, erp_request_payload
        FROM buyersystem.inventory_erp_posting
        WHERE id=%s AND is_active=1
        """,
        (str(posting_id),),
    )
    if row is None:
        raise SubmitError(404, "Transaction not found.", "Select a transaction from this tracker.")
    body = row[1]
    if isinstance(body, bytes):
        body = body.decode("utf-8", "replace")
    stored = text(body)
    if len(stored) > 4000:
        stored = stored[:4000]
    return {"ok": True, "reference": text(row[0]), "technicalDetail": stored}


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
        if action == "delete":
            removed = delete_integration(cursor, uuid.UUID(str(payload.get("configurationId"))))
            connection.commit()
            print(json.dumps(removed))
            return
        invoice_id = uuid.UUID(str(payload.get("invoiceId")))
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
        print(json.dumps({"ok": False, "status": 500, "message": "Invoice was not submitted.", "description": text(error) or "Invoice was not submitted."}))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
