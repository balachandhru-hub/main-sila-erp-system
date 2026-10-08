"""An in-memory stand-in for the .NET services, shaped like their real responses (camelCase DTOs read from the C# code).

Implements `BuyerGateway` for the tests. It holds a few made-up suppliers and items."""

from __future__ import annotations

import uuid
from typing import Any

from app import rfp
from app.rfp import GatewayError

BUYER_ID = "11111111-1111-1111-1111-111111111111"
ORG_ID = "22222222-2222-2222-2222-222222222222"

ITEM_MASTER = [
    {"id": "i1", "description": "Chicken Breast Fresh", "materialCode": "MC-101", "materialGroup": "POULTRY"},
    {"id": "i2", "description": "Whole Chicken Frozen", "materialCode": "MC-102", "materialGroup": "POULTRY"},
    {"id": "i3", "description": "Chicken Wings", "materialCode": "MC-103", "materialGroup": "POULTRY"},
    {"id": "i4", "description": "Frozen Mutton Leg", "materialCode": "MC-201", "materialGroup": "MEAT"},
]
SUPPLIERS = [
    {"supplierId": "s1", "organizationId": "o1", "supplierName": "Al Barsha Meats", "isVerified": True, "snid": "SN1", "email": "a@x.com"},
    {"supplierId": "s2", "organizationId": "o2", "supplierName": "Gulf Seafood Trading", "isVerified": True, "snid": "SN2", "email": "b@x.com"},
    {"supplierId": "s3", "organizationId": "o3", "supplierName": "Desert Poultry", "isVerified": True, "snid": "SN3", "email": "c@x.com"},
    {"supplierId": "s4", "organizationId": "o4", "supplierName": "Empty Foods", "isVerified": True, "snid": "SN4", "email": "d@x.com"},
]
USERS = {"o1": [{"userId": "u1a", "name": "A One"}, {"userId": "u1b", "name": "A Two"}], "o2": [{"userId": "u2", "name": "B"}], "o3": [{"userId": "u3", "name": "C"}], "o4": []}


class InMemoryBuyerGateway:
    def __init__(self, single_department: bool = False, no_locations: bool = False, one_location: bool = False, two_cost_centers: bool = False) -> None:
        self.two_cost_centers = two_cost_centers
        self.calls: list[tuple[str, tuple]] = []
        self.rfqs: list[dict[str, Any]] = []
        self.created_dtos: list[dict[str, Any]] = []
        self.awards: list[dict[str, Any]] = []
        self.contracts: list[dict[str, Any]] = []
        self.statuses: list[tuple[str, str]] = []
        self.unawarded: list[str] = []
        self.quotes: dict[str, list[dict[str, Any]]] = {}
        self.fail: dict[str, GatewayError] = {}  # method name -> error to raise
        self.create_saves_before_failing = False
        self.single_department, self.no_locations, self.one_location = single_department, no_locations, one_location
        self.pos = [{"poNumber": "PO-1", "supplierName": "Al Barsha Meats", "status": "Open", "totalAmount": 1500.5, "currency": "AED", "orderDate": "2026-10-01T00:00:00", "itemCount": 3}]

    def _c(self, name: str, *args: Any) -> None:
        self.calls.append((name, args))
        if name in self.fail:
            raise self.fail[name]

    def count(self, name: str) -> int:
        return sum(1 for n, _ in self.calls if n == name)

    # ---- reference data
    def profile(self) -> dict[str, Any]:
        self._c("profile")
        locs = [] if self.no_locations else [
            {"id": "l1", "locationName": "Central Kitchen", "addressLine1": "Al Quoz", "city": "Dubai", "country": "UAE", "isDefault": True},
            {"id": "l2", "locationName": "Hotel Marina", "addressLine1": "Marina Walk", "city": "Dubai", "country": "UAE", "isDefault": False}]
        if self.one_location:
            locs = locs[:1]
        return {"id": BUYER_ID, "organizationId": ORG_ID, "snid": "BN1",
                "businessProfile": {"organizationName": "Grand Hotels", "currency": "AED", "country": "United Arab Emirates"},
                "dispatchLocations": locs, "categories": [{"segment": 50, "segmentTitle": "Food Beverage and Tobacco Products", "family": 5011, "familyTitle": "Meat and poultry products"}]}

    def departments(self) -> list[dict[str, Any]]:
        self._c("departments")
        rows = [{"id": "d1", "department": "Kitchen"}, {"id": "d2", "department": "Housekeeping"}]
        return rows[:1] if self.single_department else rows

    def cost_centers(self, department_id: str | None = None) -> list[dict[str, Any]]:
        self._c("cost_centers", department_id)
        rows = [{"id": "c1", "departmentId": "d1", "costCenter": "KIT-001"}, {"id": "c3", "departmentId": "d1", "costCenter": "KIT-002"} if self.two_cost_centers else None,
                {"id": "c2", "departmentId": "d2", "costCenter": "HK-001"}]
        # Like the real API: only the requested department's cost centers; without a department id, none.
        return [r for r in rows if r and department_id and r["departmentId"] == department_id]

    def units(self) -> list[str]:
        self._c("units")
        return ["KG", "G", "PCS", "BOX", "L"]

    def currencies(self) -> list[str]:
        self._c("currencies")
        return ["AED", "USD"]

    def segments(self, search: str | None) -> list[dict[str, Any]]:
        self._c("segments", search)
        return [{"segment": 50, "title": "Food Beverage and Tobacco Products", "family": []}] if search and "food" in search.lower() else []

    def families(self, segment: int) -> list[dict[str, Any]]:
        self._c("families", segment)
        return [{"family": 5011, "title": "Meat and poultry products"}, {"family": 5012, "title": "Fish and seafood"}, {"family": 5013, "title": "Dairy products and eggs"}]

    def item_master(self, search: str, buyer_id: str | None, index: int = 0, limit: int = 10) -> list[dict[str, Any]]:
        self._c("item_master", search, buyer_id)
        s = search.lower()
        return [i for i in ITEM_MASTER if s in i["description"].lower()][index * limit:(index + 1) * limit]

    # ---- suppliers
    def find_suppliers(self, search: str | None, segment: int | None, family: int | None, verified: bool | None, buyer_id: str, limit: int) -> list[dict[str, Any]]:
        self._c("find_suppliers", search, segment, family, verified, buyer_id)
        rows = [s for s in SUPPLIERS if not search or search.lower() in s["supplierName"].lower()]
        return rows[:limit]

    def supplier_users(self, organization_id: str) -> list[dict[str, Any]]:
        self._c("supplier_users", organization_id)
        return USERS.get(organization_id, [])

    # ---- RFQ lifecycle
    def create_rfq(self, dto: dict[str, Any]) -> dict[str, Any]:
        self._c("create_rfq", dto["title"]) if not self.create_saves_before_failing else self.calls.append(("create_rfq", (dto["title"],)))
        self.created_dtos.append(dto)
        rid = str(uuid.uuid4())
        n = len(self.rfqs) + 1
        self.rfqs.append({"rfqId": rid, "id": str(uuid.uuid4()), "rfqNumber": f"RFQ-2026100610{n:04d}", "title": dto["title"], "endDate": dto["endDate"],
                          "status": "Open", "items": [dict(i, id=f"it{k}") for k, i in enumerate(dto["items"])], "dto": dto})
        if self.create_saves_before_failing and "create_rfq" in self.fail:
            raise self.fail["create_rfq"]
        return {"id": rid, "statusCode": 200, "message": "Success"}

    def list_rfqs(self, search: str | None, status: str | None, limit: int) -> list[dict[str, Any]]:
        self._c("list_rfqs", search, status)
        out = [r for r in self.rfqs if (not search or search.lower() in r["title"].lower() or search.lower() in r["rfqNumber"].lower()) and (not status or status in ("LIVE", r["status"]) )]
        return [{k: v for k, v in r.items() if k not in ("items", "dto")} for r in out][:limit]

    def _rfq(self, rfq_id: str) -> dict[str, Any]:
        for r in self.rfqs:
            if r["rfqId"] == rfq_id:
                return r
        raise GatewayError(404, "RFQ not found.")

    def rfq(self, rfq_id: str) -> dict[str, Any]:
        self._c("rfq", rfq_id)
        r = self._rfq(rfq_id)
        d = r["dto"]
        return {"title": r["title"], "status": r["status"], "currency": d["currency"], "budget": d["budget"], "startDate": d["startDate"], "endDate": d["endDate"],
                "deliveryTargetDate": d["deliveryTargetDate"], "deliveryLocation": d["deliveryLocation"], "addLotOption": d["addLotOption"],
                "items": [{"id": i["id"], "description": i["description"], "quantity": i["quantity"], "uom": i["uom"], "isAwarded": r["status"] == "AWARDED"} for i in r["items"]],
                "supplierIds": [{"supplierName": "Al Barsha Meats"}], "externalSupplierIds": [], "supplierQuotation": self.quotes.get(rfq_id, [])}

    def set_quotes(self, rfq_id: str, prices: dict[str, dict[str, float]], lot: bool = False, first: dict[str, float] | None = None) -> None:
        """prices: supplier name -> {item description -> quoted amount}. Suppliers are s1.. in the order given."""
        r = self._rfq(rfq_id)
        r["lot"] = lot
        sup = []
        for n, (name, items) in enumerate(prices.items(), 1):
            q_items = [{"buyerRFQItemId": i["id"], "quotedAmount": items[i["description"]], "quotedPrice": items[i["description"]] / i["quantity"]} for i in r["items"] if i["description"] in items]
            total = sum(items.values())
            fv = {"version": "1", "totalPrice": (first or {}).get(name, total), "status": "SUBMITTED", "items": []}
            sup.append({"supplierId": f"s{n}", "supplierName": name, "firstVersion": fv, "latestVersion": {"version": "2" if first and name in first else "1", "totalPrice": total, "status": "SUBMITTED", "items": q_items}})
        self.quotes[rfq_id] = sup

    def bid_compare(self, rfq_id: str) -> dict[str, Any]:
        self._c("bid_compare", rfq_id)
        r = self._rfq(rfq_id)
        return {"rfqId": rfq_id, "rfqNumber": r["rfqNumber"], "addLotOption": r.get("lot", False), "suppliers": self.quotes.get(rfq_id, []),
                "rfqItems": [{"id": i["id"], "description": i["description"], "quantity": i["quantity"], "uom": i["uom"], "lineNumber": k + 1} for k, i in enumerate(r["items"])]}

    def set_rfq_status(self, rfq_id: str, status: str) -> None:
        self._c("set_rfq_status", rfq_id, status)
        self._rfq(rfq_id)["status"] = status
        self.statuses.append((rfq_id, status))

    def award(self, dto: dict[str, Any]) -> dict[str, Any]:
        self._c("award", dto["rfqId"])
        r = self._rfq(dto["rfqId"])
        if r["status"] == "AWARDED":
            raise GatewayError(400, "RFQ is already awarded.")
        r["status"] = "AWARDED"
        self.awards.append(dto)
        return {"id": "award-1", "statusCode": 200}

    def unaward(self, rfq_id: str) -> None:
        self._c("unaward", rfq_id)
        self._rfq(rfq_id)["status"] = "Freezing"
        self.unawarded.append(rfq_id)

    def create_contract(self, dto: dict[str, Any]) -> dict[str, Any]:
        self._c("create_contract", dto["rfqId"])
        self.contracts.append(dto)
        return {"id": "contract-1", "statusCode": 200}

    def purchase_orders(self, limit: int) -> list[dict[str, Any]]:
        self._c("purchase_orders")
        return self.pos


FakeBuyer = InMemoryBuyerGateway  # the name the tests use
