"""The RFQ the chatbot sends must have exactly the properties of the .NET CreateRFQDto (and its parts). Read from the C# source when it is present."""

import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from fakes import InMemoryBuyerGateway
from app import rfp
from app.rfp import DraftItem, ExternalSupplier, PickedSupplier, RfqDraft
from app.rfp import RfqFlow

DTO_DIR = Path(__file__).resolve().parents[2] / "src" / "Modules" / "Buyer" / "Buyer.Domain" / "Dtos"
pytestmark = pytest.mark.skipif(not DTO_DIR.exists(), reason="the .NET source is not next to this service")

# Value types and nullable types may be left out of a JSON body; non-nullable reference types (string, List<>) may not.
VALUE_TYPES = ("decimal", "DateTime", "Guid", "long", "int", "bool")


def csharp_props(file: str, cls: str) -> dict[str, bool]:
    """property name (lower case) -> must the caller send it?"""
    text = (DTO_DIR / file).read_text(encoding="utf-8-sig")
    body = text[text.index(f"class {cls}"):]
    body = body[: body.index("\n    }")]
    props = {}
    for m in re.finditer(r"public\s+([\w<>?,\s]+?)\s+(\w+)\s*\{\s*get;\s*set;\s*\}(\s*=\s*[^;]+;)?", body):
        typ, name, default = m.group(1).strip(), m.group(2), m.group(3)
        props[name.lower()] = not (typ.endswith("?") or typ.split("<")[0] in VALUE_TYPES or default)
    return props


def sample_dto() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    d = RfqDraft(purpose="Meat for the kitchens", items=[DraftItem(name="chicken", quantity=5, uom="KG", resolved=True)], department="Kitchen", cost_center="KIT-1", region="UAE",
                 currency="AED", delivery_location="Central Kitchen", start_date=now, end_date=now, delivery_target_date=now, budget=0.0, questions=["Halal certificate?"],
                 picked=[PickedSupplier(supplier_id="00000000-0000-0000-0000-000000000001", organization_id="o", name="n", user_ids=["00000000-0000-0000-0000-000000000002"])],
                 externals=[ExternalSupplier(name="Acme", email="a@x.com")])
    return RfqFlow(InMemoryBuyerGateway(), datetime.now(timezone.utc)).dto(d)


@pytest.mark.parametrize("file, cls, pick", [
    ("CreateRFQDto.cs", "CreateRFQDto", lambda d: d),
    ("RFQItemDto.cs", "RFQItemDto", lambda d: d["items"][0]),
    ("RFQQuestionDto.cs", "RFQQuestionDto", lambda d: d["questions"][0]),
    ("RFQSupplierInviteDto.cs", "RFQSupplierInviteDto", lambda d: d["supplierInvites"][0]),
    ("ExternalSupplierDto.cs", "ExternalSupplierDto", lambda d: d["externalSuppliers"][0]),
])
def test_the_body_matches_the_net_class(file, cls, pick):
    expected, sent = csharp_props(file, cls), {k.lower() for k in pick(sample_dto())}
    assert expected, f"could not read {cls}"
    assert sent - set(expected) == set(), f"{cls}: sent properties the .NET class does not have"
    assert {k for k, required in expected.items() if required} - sent == set(), f"{cls}: required properties are missing from the body"


def test_nothing_required_is_ever_empty():
    """The .NET model binder rejects empty strings on required text fields, so unknown values go as N/A, never as ''."""
    dto = sample_dto()
    for key in ("title", "description", "department", "region", "currency", "deliveryLocation"):
        assert dto[key].strip()
    for item in dto["items"]:
        assert all(str(item[k]).strip() for k in ("description", "uom", "materialCode", "materialGroup", "costCenter"))
    assert all(str(v).strip() for v in dto["externalSuppliers"][0].values())
