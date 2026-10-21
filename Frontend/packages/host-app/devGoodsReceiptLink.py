#!/usr/bin/env python3
"""Save a goods-receipt match on the invoice when the connected API has no link route.

The rules match LinkSilaInvoiceGoodsReceiptsCommandHandler. A receipt stays locked only
when its invoice was posted, is posting, is in approval, or is awaiting payment.
"""

import json
import sys
import uuid
from pathlib import Path

import pymssql

SUBMITTED = {
    "POSTING",
    "POSTED",
    "PENDING_APPROVAL",
    "POSTING_UNKNOWN",
    "LOCAL_FINALIZATION_FAILED",
    "AWAITING_PAYMENT",
    "PARTIALLY_PAID",
    "PAID",
    "OVERDUE",
}
HOLDS_ERP = {"POSTED", "ERP_ACCEPTED"}
RELEASE_WHEN_EMPTY = {"READY_FOR_INVOICE_SUBMISSION", "GRN_POSTED", "GRN_IN_PROGRESS"}
CAN_ADVANCE = {
    "UPLOADED",
    "EXTRACTED",
    "OCR_FAILED",
    "REVIEWED",
    "GRN_POSTED",
    "GRN_IN_PROGRESS",
    "GRN_FAILED",
    "GET_PO_FAILED",
    "VALIDATION_FAILED",
    "APPROVAL_REJECTED",
    "READY_TO_POST",
}
CONFIRMED_POSTING = {"POSTED", "ERP_ACCEPTED", "FAILED_LOCAL"}


class LinkError(Exception):
    def __init__(self, status: int, message: str, description: str):
        super().__init__(description)
        self.status = status
        self.message = message
        self.description = description


def holds(status, erp_status) -> bool:
    if erp_status in HOLDS_ERP:
        return True
    return status in SUBMITTED


def guid(value) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def parse_ids(values) -> list[uuid.UUID]:
    if not isinstance(values, list):
        raise LinkError(400, "Goods receipt not found.", "Choose a goods receipt of this purchase order.")
    found = []
    seen = set()
    for value in values:
        try:
            parsed = guid(value)
        except (ValueError, TypeError, AttributeError):
            raise LinkError(400, "Goods receipt not found.", "Choose a goods receipt of this purchase order.")
        if parsed == uuid.UUID(int=0) or parsed in seen:
            continue
        seen.add(parsed)
        found.append(parsed)
    return found


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


def placeholders(count: int) -> str:
    return ",".join(["%s"] * count)


def link(cur, invoice_id: uuid.UUID, receipt_ids: list[uuid.UUID]) -> None:
    invoice = fetchone(
        cur,
        """
        SELECT id, buyer_id, status, purchase_order_id
        FROM buyersystem.invoice
        WHERE id=%s AND is_active=1
        """,
        (str(invoice_id),),
    )
    if invoice is None:
        raise LinkError(404, "Invoice not found.", "Open the invoice again.")
    _, buyer_id, status, header_po = invoice
    buyer_id = guid(buyer_id)
    header_po = guid(header_po) if header_po else None
    if status in SUBMITTED:
        raise LinkError(400, "Goods receipts cannot be changed.", "This invoice has already been submitted.")

    po_rows = fetchall(
        cur,
        """
        SELECT DISTINCT poi.purchase_order_id
        FROM buyersystem.invoice_item ii
        JOIN buyersystem.purchase_order_item poi ON poi.id = ii.purchase_order_item_id
        WHERE ii.invoice_id=%s AND ii.is_active=1 AND ii.purchase_order_item_id IS NOT NULL
        """,
        (str(invoice_id),),
    )
    purchase_orders = {guid(row[0]) for row in po_rows}
    if header_po is not None:
        purchase_orders.add(header_po)
    if not purchase_orders:
        raise LinkError(400, "Match a purchase order first.", "Goods receipts are chosen from the purchase orders on the invoice.")

    selected = []
    if receipt_ids:
        rows = fetchall(
            cur,
            f"""
            SELECT id, buyer_id, purchase_order_id, invoice_id, grn_number, status, erp_posting_id
            FROM buyersystem.goods_receipt
            WHERE is_active=1 AND id IN ({placeholders(len(receipt_ids))})
            """,
            tuple(str(item) for item in receipt_ids),
        )
        by_id = {guid(row[0]): row for row in rows}
        if len(by_id) != len(receipt_ids):
            raise LinkError(404, "Goods receipt not found.", "Choose a goods receipt of this purchase order.")
        selected = [by_id[item] for item in receipt_ids]
        for row in selected:
            if guid(row[1]) != buyer_id:
                raise LinkError(404, "Goods receipt not found.", "Choose a goods receipt of this purchase order.")
            if guid(row[2]) not in purchase_orders:
                raise LinkError(400, "Goods receipt is for another purchase order.", "Choose a goods receipt of a purchase order on this invoice.")

    other_ids = []
    for row in selected:
        other = guid(row[3]) if row[3] else None
        if other is not None and other != invoice_id and other not in other_ids:
            other_ids.append(other)
    others = []
    if other_ids:
        rows = fetchall(
            cur,
            f"""
            SELECT i.id, i.status, p.status
            FROM buyersystem.invoice i
            LEFT JOIN buyersystem.inventory_erp_posting p ON p.id = i.erp_posting_id
            WHERE i.is_active=1 AND i.id IN ({placeholders(len(other_ids))})
            """,
            tuple(str(item) for item in other_ids),
        )
        others = [(guid(row[0]), row[1], row[2]) for row in rows]
        other_by_id = {row[0]: row for row in others}
        for receipt in selected:
            other_id = guid(receipt[3]) if receipt[3] else None
            if other_id is None or other_id == invoice_id:
                continue
            other = other_by_id.get(other_id)
            if other and holds(other[1], other[2]):
                raise LinkError(
                    409,
                    "Goods receipt is already on a posted invoice.",
                    f"Goods receipt {receipt[4]} is already on an invoice that was posted.",
                )

    if receipt_ids:
        cur.execute(
            f"""
            UPDATE buyersystem.goods_receipt
            SET invoice_id=NULL, date_updated=SYSUTCDATETIME()
            WHERE invoice_id=%s AND buyer_id=%s AND is_active=1 AND id NOT IN ({placeholders(len(receipt_ids))})
            """,
            (str(invoice_id), str(buyer_id), *(str(item) for item in receipt_ids)),
        )
    else:
        cur.execute(
            """
            UPDATE buyersystem.goods_receipt
            SET invoice_id=NULL, date_updated=SYSUTCDATETIME()
            WHERE invoice_id=%s AND buyer_id=%s AND is_active=1
            """,
            (str(invoice_id), str(buyer_id)),
        )
    if receipt_ids:
        cur.execute(
            f"""
            UPDATE buyersystem.goods_receipt
            SET invoice_id=%s, date_updated=SYSUTCDATETIME()
            WHERE is_active=1 AND id IN ({placeholders(len(receipt_ids))})
            """,
            (str(invoice_id), *(str(item) for item in receipt_ids)),
        )

    for other_id, other_status, _erp in others:
        remaining = fetchone(
            cur,
            "SELECT COUNT(*) FROM buyersystem.goods_receipt WHERE invoice_id=%s AND is_active=1",
            (str(other_id),),
        )[0]
        if remaining == 0 and other_status in RELEASE_WHEN_EMPTY:
            cur.execute(
                """
                UPDATE buyersystem.invoice
                SET status=%s, date_updated=SYSUTCDATETIME()
                WHERE id=%s AND is_active=1
                """,
                ("REVIEWED", str(other_id)),
            )

    confirmed = False
    if selected and all(row[5] == "POSTED" for row in selected):
        posting_ids = [guid(row[6]) for row in selected if row[6]]
        confirmed = True
        if posting_ids:
            postings = fetchall(
                cur,
                f"""
                SELECT id, status FROM buyersystem.inventory_erp_posting
                WHERE id IN ({placeholders(len(posting_ids))})
                """,
                tuple(str(item) for item in posting_ids),
            )
            posting_status = {guid(row[0]): row[1] for row in postings}
            confirmed = all(
                row[6] is None or posting_status.get(guid(row[6])) in CONFIRMED_POSTING
                for row in selected
            )
    next_status = status
    if selected and confirmed and status in CAN_ADVANCE:
        next_status = "READY_FOR_INVOICE_SUBMISSION"
    elif not selected and status in RELEASE_WHEN_EMPTY:
        next_status = "REVIEWED"
    if next_status != status:
        cur.execute(
            """
            UPDATE buyersystem.invoice
            SET status=%s, date_updated=SYSUTCDATETIME()
            WHERE id=%s AND is_active=1
            """,
            (next_status, str(invoice_id)),
        )


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    settings = Path(sys.argv[1])
    payload = json.loads(sys.stdin.read() or "{}")
    try:
        invoice_id = guid(payload.get("invoiceId"))
        receipt_ids = parse_ids(payload.get("goodsReceiptIds") or [])
    except LinkError as error:
        json.dump({"ok": False, "status": error.status, "message": error.message, "description": error.description}, sys.stdout)
        return 0
    except (ValueError, TypeError, AttributeError):
        json.dump({
            "ok": False,
            "status": 400,
            "message": "Invoice not found.",
            "description": "Open the invoice again.",
        }, sys.stdout)
        return 0

    conn = connect(settings)
    conn.autocommit(False)
    try:
        cur = conn.cursor()
        link(cur, invoice_id, receipt_ids)
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    except LinkError as error:
        conn.rollback()
        json.dump({"ok": False, "status": error.status, "message": error.message, "description": error.description}, sys.stdout)
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    json.dump({"ok": True, "dryRun": dry_run}, sys.stdout)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        json.dump({
            "ok": False,
            "status": 500,
            "message": "Could not match the goods receipts.",
            "description": "Could not match the goods receipts.",
        }, sys.stdout)
        sys.stderr.write(type(error).__name__ + "\n")
        raise SystemExit(0)
