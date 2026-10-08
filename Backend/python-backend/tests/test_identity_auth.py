"""Login through the Identity service: the access_token cookie is checked by calling /api/v1/identity/token-claim. No secret is held here."""

import dataclasses
import hashlib

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import rfp
from app.rfp import ChatRequest  # noqa: F401
from app.rfp import get_session
from app.rfp import Claims, IdentityRejected, IdentityUnavailable, fetch_claims

from conftest import headers
from fakes import FakeBuyer
from test_chat_rfq import YOUR_SENTENCE, Chat, script_to_review

# The response of GET /api/v1/identity/token-claim for a buyer user, as returned by your Identity service (permissions shortened to those that matter).
REAL_RESPONSE = {
    "userId": "ee4e420b-54c7-4722-9132-c7ff744519e7", "personId": "e8b83467-ff75-49c2-a962-dec851da3bad", "organizationId": "8568ec2a-8034-472d-9808-3994322d09c8",
    "roleId": "5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73", "buyerId": "3efc86c3-e49d-4900-a17c-6b3d61f80ab0", "supplierId": None, "organizationType": 1,
    "permissions": ["CREATE_RFQ", "GET_RFQ_MASTER_DATA", "GET_RFQ_BY_ID", "GET_BID_COMPARE", "SAVE_RFQ_AWARD", "UNAWARD_RFQ", "UPDATE-BUYER_RFQ-STATUS",
                    "CREATE_CONTRACT", "GET_PURCHASE_ORDER", "GET_ITEM_BUYER_MASTER", "GET_ALL_CLAIMS"],
}
TOKEN = "header.payload.signature"


def transport(resp: httpx.Response | None = None, calls: list | None = None, raises: Exception | None = None):
    def handler(req: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(req)
        if raises:
            raise raises
        return resp or httpx.Response(200, json=REAL_RESPONSE)
    return httpx.MockTransport(handler)


# ---------------------------------------------------------------- the Identity client

def test_your_real_token_claim_response_is_understood():
    calls: list[httpx.Request] = []
    c = fetch_claims(TOKEN, transport=transport(calls=calls))
    assert (c.user_id, c.organization_id, c.buyer_id, c.org_type) == ("ee4e420b-54c7-4722-9132-c7ff744519e7", "8568ec2a-8034-472d-9808-3994322d09c8", "3efc86c3-e49d-4900-a17c-6b3d61f80ab0", "buyer")
    assert c.supplier_id is None and "CREATE_RFQ" in c.permissions and c.role_id == "5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73"
    req = calls[0]
    assert req.method == "GET" and req.url.path == "/api/v1/identity/token-claim" and req.headers["cookie"] == f"access_token={TOKEN}"


def test_a_validated_login_is_remembered_briefly_and_never_by_its_token():
    calls: list = []
    now = [100.0]
    t = transport(calls=calls)
    s = dataclasses.replace(rfp.procureiq_settings, auth_cache_seconds=60)
    fetch_claims(TOKEN, s, t, clock=lambda: now[0])
    fetch_claims(TOKEN, s, t, clock=lambda: now[0] + 30)
    assert len(calls) == 1  # the second message did not ask Identity again
    fetch_claims(TOKEN, s, t, clock=lambda: now[0] + 61)
    assert len(calls) == 2  # but a minute later it does, so a revoked login does not last
    assert list(rfp._cache) == [hashlib.sha256(TOKEN.encode()).hexdigest()] and TOKEN not in str(list(rfp._cache))
    fetch_claims("another.token.value", s, t, clock=lambda: now[0] + 62)
    assert len(calls) == 3  # a different token is a different login


def test_caching_can_be_switched_off():
    calls: list = []
    s = dataclasses.replace(rfp.procureiq_settings, auth_cache_seconds=0)
    for _ in range(3):
        fetch_claims(TOKEN, s, transport(calls=calls))
    assert len(calls) == 3


def test_failures_are_not_cached():
    calls: list = []
    with pytest.raises(IdentityRejected):
        fetch_claims(TOKEN, transport=transport(httpx.Response(401, json={}), calls))
    fetch_claims(TOKEN, transport=transport(calls=calls))  # the user logged in again with the same cookie value, say: Identity is asked again
    assert len(calls) == 2


@pytest.mark.parametrize("resp, exc, status, text", [
    (httpx.Response(401, json={}), IdentityRejected, 401, "Invalid or expired login"),
    (httpx.Response(403, json={}), IdentityRejected, 403, "GET_ALL_CLAIMS"),
    (httpx.Response(500, text="boom"), IdentityUnavailable, None, "answered 500"),
    (httpx.Response(200, text="<html>not json</html>"), IdentityUnavailable, None, "could not read"),
    (httpx.Response(200, json=["a list"]), IdentityUnavailable, None, "unexpected"),
    (httpx.Response(200, json={"userId": "u"}), IdentityRejected, 401, "no user or organisation"),
])
def test_identity_answers_that_are_not_a_login(resp, exc, status, text):
    with pytest.raises(exc) as e:
        fetch_claims(TOKEN, transport=transport(resp))
    assert text in str(e.value) and (status is None or e.value.status == status)


def test_identity_down_is_not_reported_as_a_bad_login():
    with pytest.raises(IdentityUnavailable, match="could not be reached"):
        fetch_claims(TOKEN, transport=transport(raises=httpx.ConnectError("refused")))
    with pytest.raises(IdentityUnavailable):
        fetch_claims(TOKEN, transport=transport(raises=httpx.ReadTimeout("slow")))


def test_org_type_forms_and_missing_permissions_list():
    assert rfp.parse_claims({**REAL_RESPONSE, "organizationType": "Supplier"}).org_type == "supplier"
    assert rfp.parse_claims({**REAL_RESPONSE, "organizationType": 3}).org_type == "platform"
    assert rfp.parse_claims({k: v for k, v in REAL_RESPONSE.items() if k != "permissions"}).permissions == frozenset()


# ---------------------------------------------------------------- the API: the cookie decides who you are

@pytest.fixture()
def logged_in(monkeypatch):
    """Identity says: this token belongs to the buyer in REAL_RESPONSE. Production has no test headers."""
    monkeypatch.setattr(rfp, "procureiq_settings", dataclasses.replace(rfp.procureiq_settings, dev_headers=False))
    seen = []

    def fake_fetch(token, settings=None, transport=None, clock=None):
        seen.append(token)
        if token == "revoked":
            raise IdentityRejected(401, "Invalid or expired login. Sign in again.")
        if token == "norights":
            raise IdentityRejected(403, "Your role is not allowed to read its own login details (permission GET_ALL_CLAIMS), so I cannot tell what you may do.")
        if token == "down":
            raise IdentityUnavailable("The login service could not be reached.")
        if token == "supplier":
            return dataclasses.replace(rfp.parse_claims(REAL_RESPONSE), org_type="supplier")
        return rfp.parse_claims(REAL_RESPONSE)

    monkeypatch.setattr(rfp, "fetch_claims", fake_fetch)
    return seen


@pytest.fixture()
def client_with_fake(session_factory):
    fake = FakeBuyer()
    app = FastAPI()
    app.include_router(rfp.router)
    rfp.install_error_handlers(app)

    def _session():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[rfp.buyer_gateway] = lambda: fake
    return TestClient(app), fake


def cookie(token="good"):
    return {"Cookie": f"access_token={token}"}


def test_the_cookie_is_enough_to_use_the_chat(client_with_fake, logged_in):
    client, _ = client_with_fake
    r = client.post("/api/v1/chat/message", json={"message": "help"}, headers=cookie())
    assert r.status_code == 200 and "With your permissions you can: create RFQs" in r.json()["reply"]
    assert logged_in == ["good"]


def test_me_reports_identity_and_what_you_may_do(client_with_fake, logged_in):
    client, _ = client_with_fake
    me = client.get("/api/v1/chat/me", headers=cookie()).json()
    assert (me["user_id"], me["organization_id"], me["buyer_id"]) == (REAL_RESPONSE["userId"], REAL_RESPONSE["organizationId"], REAL_RESPONSE["buyerId"])
    assert me["permissions_known"] is True and me["roles"] == ["buyer"]
    can = {a["permission"]: a["allowed"] for a in me["can"]}
    assert can["CREATE_RFQ"] is True and can["SAVE_RFQ_AWARD"] is True
    assert "CREATE_RFQ" in me["permissions"]


def test_test_headers_cannot_override_the_login(client_with_fake, logged_in):
    client, _ = client_with_fake
    me = client.get("/api/v1/chat/me", headers={**cookie(), **headers("mallory", "procurement_director", tenant="someone-else")}).json()
    assert me["user_id"] == REAL_RESPONSE["userId"] and me["organization_id"] == REAL_RESPONSE["organizationId"]


def test_without_a_login_the_test_headers_do_nothing(client_with_fake, logged_in):
    client, _ = client_with_fake
    r = client.get("/api/v1/chat/me", headers=headers("alice", "buyer"))
    assert r.status_code == 401 and r.json()["error"] == "UNAUTHORIZED" and "sign in" in r.json()["message"]
    assert client.get("/api/v1/chat/sessions").status_code == 401


@pytest.mark.parametrize("token, status, error, text", [
    ("revoked", 401, "UNAUTHORIZED", "Invalid or expired login"),
    ("norights", 403, "FORBIDDEN", "GET_ALL_CLAIMS"),
    ("down", 503, "AUTH_UNAVAILABLE", "could not be reached. Try again"),
])
def test_login_problems_are_reported_as_what_they_are(client_with_fake, logged_in, token, status, error, text):
    client, _ = client_with_fake
    r = client.post("/api/v1/chat/message", json={"message": "help"}, headers=cookie(token))
    assert r.status_code == status and r.json()["error"] == error and text in r.json()["message"]


def test_a_supplier_login_gets_no_buyer_assistant(client_with_fake, logged_in):
    client, _ = client_with_fake
    for method, path in (("get", "/api/v1/chat/me"), ("get", "/api/v1/chat/sessions"), ("get", "/api/v1/chat/material-groups")):
        assert getattr(client, method)(path, headers=cookie("supplier")).status_code == 403
    assert client.post("/api/v1/chat/message", json={"message": "help"}, headers=cookie("supplier")).status_code == 403


# ---------------------------------------------------------------- permissions decide what the assistant will even start

ALL = frozenset(REAL_RESPONSE["permissions"])


def test_without_create_rfq_the_assistant_refuses_before_asking_anything(session):
    c = Chat(session, permissions=ALL - {"CREATE_RFQ"})
    r = c.say(YOUR_SENTENCE)
    assert "do not have permission to create RFQs" in r.reply and "CREATE_RFQ" in r.reply and "I have not started anything" in r.reply
    assert r.flow is None and r.awaiting is None and c.gw.calls == []  # not a single call to any service


def test_with_create_rfq_it_proceeds(session):
    r = Chat(session, permissions=ALL).say(YOUR_SENTENCE)
    assert r.flow == "create_rfq" and r.awaiting == "quantities"


def test_each_action_needs_its_own_permission(session):
    c = Chat(session, permissions=frozenset({"CREATE_RFQ", "GET_RFQ_MASTER_DATA"}))
    assert "I found no RFQs" in c.say("show my rfqs").reply  # the permission it does have works
    for text, key in (("compare bids for RFQ-20261006100001", "GET_BID_COMPARE"), ("award RFQ-20261006100001 to the cheapest", "SAVE_RFQ_AWARD"),
                      ("unaward RFQ-20261006100001", "UNAWARD_RFQ"), ("freeze RFQ-20261006100001", "UPDATE-BUYER_RFQ-STATUS"),
                      ("create a contract for RFQ-20261006100001", "CREATE_CONTRACT"), ("show my purchase orders", "GET_PURCHASE_ORDER"),
                      ("details of RFQ-20261006100001", "GET_RFQ_BY_ID"), ("find item chicken", "GET_ITEM_BUYER_MASTER")):
        r = c.say(text)
        assert key in r.reply and "do not have permission" in r.reply and r.flow is None, text
    assert c.gw.count("award") == c.gw.count("create_contract") == c.gw.count("unaward") == 0


def test_a_draft_in_progress_survives_a_refused_side_question(session):
    c = Chat(session, permissions=ALL - {"GET_RFQ_MASTER_DATA"})
    c.say(YOUR_SENTENCE)
    r = c.say("show my rfqs")
    assert "GET_RFQ_MASTER_DATA" in r.reply
    r = c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    assert r.flow == "create_rfq" and r.awaiting == "item_match"


def test_help_lists_what_you_can_and_cannot_do(session):
    r = Chat(session, permissions=ALL - {"UNAWARD_RFQ", "CREATE_CONTRACT"}).say("help")
    assert "With your permissions you can:" in r.reply and "create RFQs" in r.reply
    assert "You cannot: un-award an RFQ, create contracts" in r.reply
    assert "With your permissions" not in Chat(session, permissions=None).say("help").reply  # unknown permissions: no claim is made


def test_the_buyer_id_from_the_login_is_used_for_supplier_search(session):
    c = Chat(session, permissions=ALL, buyer_id="buyer-from-login")
    script_to_review(c)
    call = next(args for name, args in c.gw.calls if name == "find_suppliers")
    assert call[-1] == "buyer-from-login"
    assert all(args[1] == "buyer-from-login" for name, args in c.gw.calls if name == "item_master")


# ---------------------------------------------------------------- Swagger: an Authorize button, and no test-header boxes in production

def test_the_docs_offer_an_authorize_button_for_the_bearer_token():
    from app.main import app

    spec = app.openapi()
    schemes = spec["components"]["securitySchemes"]
    assert any(v.get("type") == "http" and v.get("scheme") == "bearer" for v in schemes.values())
    op = spec["paths"]["/api/v1/chat/message"]["post"]
    assert op.get("security"), "the chat endpoint should be shown as needing the bearer token"


def test_the_test_header_boxes_are_hidden_in_the_docs_when_they_are_off():
    from app.main import app

    params = {p["name"].lower() for p in app.openapi()["paths"]["/api/v1/chat/sessions"]["get"].get("parameters", [])}
    assert not params & {"x-actor-id", "x-tenant-id", "x-actor-roles", "x-actor-type"}  # test headers are off by default, so Swagger does not offer them


def test_a_pasted_bearer_token_beats_a_stale_cookie(client_with_fake, logged_in):
    client, _ = client_with_fake
    r = client.get("/api/v1/chat/me", headers={"Authorization": "Bearer good", "Cookie": "access_token=revoked"})
    assert r.status_code == 200 and logged_in == ["good"]
