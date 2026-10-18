#!/usr/bin/env python3
"""Send a supplier invoice when the connected API has no submit route.

The invoice is handed to the posting the server already runs. The request written
onto FIVE S4-INVOICE POSTING is the S/4 supplier-invoice document for this invoice.
"""

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


def amount(value) -> str:
    rendered = text(value)
    if not rendered:
        raise SubmitError(400, "Invoice cannot be submitted.", "An invoice line is missing its amount.")
    return rendered


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


def document(cur, invoice_id: uuid.UUID) -> dict:
    invoice = fetchone(
        cur,
        """
        SELECT id, buyer_id, invoice_number, invoice_date, currency, gross_amount, po_number,
               purchase_order_id, sila_supplier_id, supplier_name, status, erp_posting_id, created_by
        FROM buyersystem.invoice
        WHERE id=%s AND is_active=1
        """,
        (str(invoice_id),),
    )
    if invoice is None:
        raise SubmitError(404, "Invoice not found.", "Open the invoice again.")
    number = text(invoice[2])
    if not number or not invoice[6] or invoice[7] is None:
        raise SubmitError(400, "Invoice cannot be submitted.", "The invoice needs an invoice number and a purchase order.")
    order = fetchone(
        cur,
        "SELECT company_code, currency FROM buyersystem.purchase_order WHERE id=%s",
        (str(invoice[7]),),
    )
    company = text(order[0]) if order else ""
    currency = text(invoice[4]) or (text(order[1]) if order else "")
    if not company or not currency or invoice[5] is None or invoice[3] is None:
        raise SubmitError(400, "Invoice cannot be submitted.", "The invoice needs a company code, currency, date and gross amount from the purchase order.")
    lines = fetchall(
        cur,
        """
        SELECT ii.line_number, ii.quantity, ii.amount, poi.line_number, poi.unit_of_measure
        FROM buyersystem.invoice_item ii
        LEFT JOIN buyersystem.purchase_order_item poi ON poi.id = ii.purchase_order_item_id
        WHERE ii.invoice_id=%s AND ii.is_active=1
        ORDER BY ii.line_number
        """,
        (str(invoice_id),),
    )
    if not lines:
        raise SubmitError(400, "Invoice cannot be submitted.", "The invoice has no lines to post.")
    results = []
    for index, line in enumerate(lines, start=1):
        if line[3] is None or line[1] is None or line[2] is None or not text(line[4]):
            raise SubmitError(
                400,
                "Invoice cannot be submitted.",
                "Each invoice line needs a purchase order item, quantity, amount and unit of measure.",
            )
        results.append({
            "SupplierInvoiceItem": f"{index:05d}",
            "PurchaseOrder": text(invoice[6]),
            "PurchaseOrderItem": f"{int(line[3]):05d}",
            "DocumentCurrency": currency,
            "SupplierInvoiceItemAmount": amount(line[2]),
            "QuantityInPurchaseOrderUnit": text(line[1]),
            "PurchaseOrderQuantityUnit": text(line[4]),
        })
    posted = text(invoice[3])[:10] + "T00:00"
    body = {
        "CompanyCode": company,
        "DocumentDate": posted,
        "PostingDate": posted,
        "DueCalculationBaseDate": posted,
        "TaxDeterminationDate": posted,
        "InvoicingParty": supplier_code(cur, invoice[1], invoice[8], invoice[9]),
        "DocumentCurrency": currency,
        "InvoiceGrossAmount": amount(invoice[5]),
        "AccountingDocumentType": "RE",
        "SupplierInvoiceIDByInvcgParty": number,
        "to_SuplrInvcItemPurOrdRef": {"results": results},
        "to_SupplierInvoiceItemGLAcct": {"results": []},
    }
    return {
        "buyer_id": invoice[1],
        "number": number,
        "company": company,
        "created_by": invoice[12],
        "erp_posting_id": invoice[11],
        "body": body,
    }


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


def prepare(cur, invoice_id: uuid.UUID) -> str:
    built = document(cur, invoice_id)
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
    return str(posting_id)


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
        if action == "prepare":
            posting_id = prepare(cursor, invoice_id)
            connection.commit()
            print(json.dumps({"ok": True, "postingId": posting_id}))
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
