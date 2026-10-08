import dataclasses
import json
import uuid

import httpx
from sqlalchemy.engine import make_url
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import rfp
from app.rfp import GatewayError, HttpBuyerGateway
from app.rfp import get_session

from conftest import headers
from fakes import FakeBuyer

BUYER_ROLE, ORG = "c95f5a1b-4aec-4647-9328-895a58193ec4", str(uuid.uuid4())


def test_token_sources():
    assert rfp.extract_token({"access_token": "c"}, "Bearer b") == "b"  # a token pasted into Swagger is not overridden by an old cookie
    assert rfp.extract_token({"access_token": "c"}, None) == "c" and rfp.extract_token({"access_token": "c"}, "Bearer ") == "c"
    assert rfp.extract_token({}, "Bearer b") == "b" and rfp.extract_token({}, "Basic x") is None and rfp.extract_token({}, None) is None


def test_roles_are_least_privilege():
    assert rfp.roles_for("buyer", BUYER_ROLE, {}) == {"buyer"}  # being a buyer administrator grants nothing extra by default
    assert rfp.roles_for("buyer", BUYER_ROLE, {BUYER_ROLE: ["procurement_director"]}) == {"buyer", "procurement_director"}
    assert rfp.roles_for("supplier", None, {}) == {"supplier"}


@pytest.fixture()
def fake():
    return FakeBuyer()


@pytest.fixture()
def chat_client(session_factory, fake):
    app = FastAPI()
    app.include_router(rfp.router)
    rfp.install_error_handlers(app)

    def _session():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[rfp.buyer_gateway] = lambda: fake
    return TestClient(app)


def bearer(**over):
    return {"Authorization": f"Bearer {token(**over)}"}


def test_dev_headers_are_off_unless_explicitly_enabled(monkeypatch):
    monkeypatch.delenv("PROCUREIQ_DEV_HEADERS", raising=False)
    assert rfp.load_settings().dev_headers is False  # no flag: production-safe by default
    monkeypatch.setenv("PROCUREIQ_DEV_HEADERS", "true")
    assert rfp.load_settings().dev_headers is True
    monkeypatch.setenv("PROCUREIQ_ROLE_MAP", json.dumps({BUYER_ROLE.upper(): ["legal"]}))
    assert rfp.load_settings().role_map == {BUYER_ROLE: ["legal"]}
    monkeypatch.setenv("PROCUREIQ_ROLE_MAP", "{not json")
    assert rfp.load_settings().role_map == {}


# ---------------------------------------------------------------- the chat endpoints

def say(client, text, sid=None, who=None):
    return client.post("/api/v1/chat/message", json={"message": text, "session_id": sid}, headers=who or headers("alice", "buyer", tenant=ORG))


def test_chat_endpoint_runs_a_conversation_and_lists_it(chat_client, fake):
    r = say(chat_client, "create an rfq for rice, sugar")
    assert r.status_code == 200
    body = r.json()
    assert body["awaiting"] == "quantities" and body["flow"] == "create_rfq" and "rice" in body["reply"]
    sid = body["session_id"]
    assert say(chat_client, "all 10 kg", sid).json()["session_id"] == sid

    listed = chat_client.get("/api/v1/chat/sessions", headers=headers("alice", "buyer", tenant=ORG)).json()
    assert [s["id"] for s in listed] == [sid] and listed[0]["flow"] == "create_rfq" and listed[0]["messages"] == []
    full = chat_client.get(f"/api/v1/chat/sessions/{sid}", headers=headers("alice", "buyer", tenant=ORG)).json()
    assert [m["role"] for m in full["messages"]] == ["user", "assistant", "user", "assistant"]
    assert chat_client.delete(f"/api/v1/chat/sessions/{sid}", headers=headers("alice", "buyer", tenant=ORG)).status_code == 204
    assert chat_client.get(f"/api/v1/chat/sessions/{sid}", headers=headers("alice", "buyer", tenant=ORG)).status_code == 404


def test_conversations_are_private_to_their_owner(chat_client):
    sid = say(chat_client, "help").json()["session_id"]
    other_user = headers("bob", "buyer", tenant=ORG)
    other_org = headers("alice", "buyer", tenant="another-company")
    for who in (other_user, other_org):
        assert chat_client.get(f"/api/v1/chat/sessions/{sid}", headers=who).status_code == 404
        assert say(chat_client, "hello", sid, who).status_code == 404
        assert chat_client.delete(f"/api/v1/chat/sessions/{sid}", headers=who).status_code == 404
        assert chat_client.get("/api/v1/chat/sessions", headers=who).json() == []


def test_only_buyers_get_the_buyer_assistant(chat_client):
    assert say(chat_client, "help", who=headers("lena", "legal", tenant=ORG)).status_code == 403
    assert say(chat_client, "help", who=headers("x", "supplier", tenant=ORG, actor_type="supplier")).status_code == 403
    assert chat_client.post("/api/v1/chat/message", json={"message": "help"}).status_code == 403  # no identity at all
    assert chat_client.post("/api/v1/chat/message", json={"message": ""}, headers=headers("alice", "buyer", tenant=ORG)).status_code == 422


def test_a_conversation_has_a_length_limit(chat_client):
    sid = say(chat_client, "help").json()["session_id"]
    last = None
    for _ in range(105):
        last = say(chat_client, "help", sid)
        if last.status_code != 200:
            break
    assert last.status_code == 400 and "very long" in last.json()["message"]


# ---------------------------------------------------------------- the HTTP client, against a mock of the .NET services

def mock_gateway(handler, token_value="TOKEN"):
    s = dataclasses.replace(rfp.procureiq_settings, buyer_url="http://buyer", masterdata_url="http://md", supplier_url="http://sup", identity_url="http://id")
    return HttpBuyerGateway(token_value, s, httpx.MockTransport(handler))


def test_calls_go_to_the_right_service_with_the_users_cookie():
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append((req.method, str(req.url), req.headers.get("cookie"), json.loads(req.content) if req.content else None))
        return httpx.Response(200, json=[{"key": "kg"}] if "units" in req.url.path else {"items": [{"currencyName": "aed"}]} if "currencies" in req.url.path else [])

    gw = mock_gateway(handler)
    assert gw.units() == ["KG"] and gw.currencies() == ["AED"]  # a bare list and a paged object are both understood
    gw.profile(), gw.departments(), gw.cost_centers(), gw.segments("food"), gw.families(50), gw.item_master("chicken wings", "b1")
    gw.find_suppliers("meat", 50, 5011, True, "b1", 20), gw.supplier_users("o1"), gw.list_rfqs("x", "LIVE", 5), gw.rfq("r1"), gw.bid_compare("r1")
    gw.set_rfq_status("r1", "Freezing"), gw.award({"rfqId": "r1"}), gw.unaward("r1"), gw.create_contract({"contractName": "c"}), gw.purchase_orders(10), gw.create_rfq({"title": "t"})
    assert all(c[2] == "access_token=TOKEN" for c in seen)
    by = {(m, u.split("?")[0]): (u, b) for m, u, _, b in seen}
    assert ("GET", "http://md/api/v1/masterdata/units") in by and ("GET", "http://md/api/v1/masterdata/unspsc/family") in by
    assert "segment=50" in by[("GET", "http://md/api/v1/masterdata/unspsc/family")][0]
    assert "searchTerm=chicken+wings" in by[("GET", "http://buyer/api/v1/buyer/item-master")][0] and "buyerId=b1" in by[("GET", "http://buyer/api/v1/buyer/item-master")][0]
    assert by[("POST", "http://sup/api/v1/supplier/rfq-supplier")][1] == {"index": 0, "limit": 20, "searchTerm": "meat", "segment": 50, "family": 5011, "buyerId": "b1", "type": "VERIFIED"}
    assert "organizationId=o1" in by[("GET", "http://id/api/v1/identity/organization-user-rfq")][0]
    assert by[("PUT", "http://buyer/api/v1/buyer/rfq-status")][1] == {"rfqId": "r1", "status": "Freezing"}
    assert by[("PUT", "http://buyer/api/v1/buyer/rfq-award/unaward")][1] == {"rfqId": "r1"}
    assert by[("POST", "http://buyer/api/v1/buyer/rfq-master-data")][1] == {"index": 0, "limit": 5, "search": "x", "status": "LIVE"}
    assert by[("POST", "http://buyer/api/v1/buyer/createrfq")][1] == {"title": "t"}


def test_no_token_means_no_request_at_all():
    called = []
    gw = mock_gateway(lambda req: called.append(req) or httpx.Response(200, json=[]), token_value=None)
    with pytest.raises(GatewayError) as e:
        gw.profile()
    assert e.value.status == 401 and "not signed in" in e.value.message and called == []


@pytest.mark.parametrize("resp, status, text", [
    (httpx.Response(401, json={}), 401, "session has expired"),
    (httpx.Response(403, json={}), 403, "do not have permission"),
    (httpx.Response(404, json={"message": "RFQ not found."}), 404, "RFQ not found."),
    (httpx.Response(400, json={"status_code": 400, "message": "Bad Request", "description": "Invalid supplier user."}), 400, "Invalid supplier user."),
    (httpx.Response(400, json={"title": "One or more validation errors occurred."}), 400, "validation errors"),
    (httpx.Response(500, text="boom"), 500, "boom"),
    (httpx.Response(502, content=b""), 502, "refused the request (502)"),
])
def test_service_errors_become_safe_messages(resp, status, text):
    gw = mock_gateway(lambda req: resp)
    with pytest.raises(GatewayError) as e:
        gw.create_rfq({})
    assert e.value.status == status and text in e.value.message


def test_timeouts_and_unreachable_services():
    def timeout(req):
        raise httpx.ReadTimeout("slow")

    def down(req):
        raise httpx.ConnectError("refused")

    with pytest.raises(GatewayError) as e:
        mock_gateway(timeout).create_rfq({})
    assert e.value.status == 504 and "Nothing was changed if this was a write; check before retrying" in e.value.message
    with pytest.raises(GatewayError) as e:
        mock_gateway(down).profile()
    assert e.value.status == 503 and "could not be reached" in e.value.message


def test_swagger_placeholder_session_id_gets_a_helpful_answer_and_the_docs_suggest_null(chat_client):
    placeholder = "3fa85f64-5717-4562-b3fc-2c963f66afa6"  # the value Swagger pre-fills for a uuid field
    r = say(chat_client, "help", placeholder)
    assert r.status_code == 404 and "leave session_id out (or null)" in r.json()["message"]
    assert say(chat_client, "help", None).status_code == 200  # null/absent starts a new conversation
    from app.main import app
    schema = app.openapi()["components"]["schemas"]["ChatRequest"]["properties"]["session_id"]
    assert None in schema["examples"] and "Do not invent one" in schema["description"]


def test_cost_centers_are_requested_the_way_the_buyer_app_does():
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json=[{"id": "ee30ea8d-db21-4354-ad29-185df765e90a", "departmentId": "57b91ace-877f-40ac-88bf-cee1fc2a50c3", "costCenter": "COST1"}])

    rows = mock_gateway(handler).cost_centers("57b91ace-877f-40ac-88bf-cee1fc2a50c3")
    assert rows[0]["costCenter"] == "COST1"
    q = dict(seen[0].url.params)
    assert seen[0].url.path == "/api/v1/buyer/all-costcenter"
    assert q == {"departmentId": "57b91ace-877f-40ac-88bf-cee1fc2a50c3", "index": "0", "limit": "40"}  # exactly the call your app makes


def test_material_groups_are_listed_from_the_item_master(chat_client):
    who = headers("alice", "buyer", tenant=ORG)
    r = chat_client.get("/api/v1/chat/material-groups", headers=who)
    assert r.status_code == 200
    groups = {g["material_group"]: g for g in r.json()}
    assert groups["POULTRY"]["items"] == 3 and groups["MEAT"]["example"] == "Frozen Mutton Leg"
    assert [g["material_group"] for g in chat_client.get("/api/v1/chat/material-groups?search=meat", headers=who).json()] == ["MEAT"]
    assert chat_client.get("/api/v1/chat/material-groups").status_code == 403  # no identity at all


def test_nothing_is_hard_coded_a_missing_address_is_reported_by_name(monkeypatch, tmp_path):
    for v in ("PROCUREIQ_BUYER_URL", "PROCUREIQ_MASTERDATA_URL", "PROCUREIQ_SUPPLIER_URL", "PROCUREIQ_IDENTITY_URL", "PROCUREIQ_VERIFICATION_TEMPLATE_ID"):
        monkeypatch.delenv(v, raising=False)
    s = rfp.load_settings(tmp_path)  # no appsettings.json here
    assert (s.buyer_url, s.masterdata_url, s.supplier_url, s.identity_url, s.default_verification_template_id) == ("", "", "", "", "")
    gw = HttpBuyerGateway("TOKEN", s, httpx.MockTransport(lambda req: httpx.Response(200, json=[])))
    with pytest.raises(GatewayError, match="PROCUREIQ_BUYER_URL"):
        gw.profile()
    with pytest.raises(GatewayError, match="PROCUREIQ_MASTERDATA_URL"):
        gw.units()
    with pytest.raises(rfp.IdentityUnavailable, match="PROCUREIQ_IDENTITY_URL"):
        rfp.fetch_claims("t", s, httpx.MockTransport(lambda req: httpx.Response(200, json={})))
    monkeypatch.setenv("PROCUREIQ_BUYER_URL", "http://b/")
    assert rfp.load_settings(tmp_path).buyer_url == "http://b"


def test_settings_come_from_appsettings_json_and_environment_wins(tmp_path, monkeypatch):
    for v in ("PROCUREIQ_BUYER_URL", "PROCUREIQ_DATABASE_URL", "PROCUREIQ_ENVIRONMENT", "ASPNETCORE_ENVIRONMENT", "PROCUREIQ_VERIFICATION_TEMPLATE_ID"):
        monkeypatch.delenv(v, raising=False)
    (tmp_path / "appsettings.json").write_text(json.dumps({
        "InterCallService": {"BuyerUrl": "http://b:1/", "IdentityUrl": "http://i:2"}, "Rfq": {"VerificationTemplateId": "T1"},
        "ConnectionStrings": {"DefaultConnection": ""}}), encoding="utf-8")
    (tmp_path / "appsettings.Local.json").write_text(json.dumps({
        "ConnectionStrings": {"DefaultConnection": "Server=db.example,1433;Database=ProcureIqDB;User Id=u;Password=p@ss:w/rd;Encrypt=false;MultipleActiveResultSets=True;"}}), encoding="utf-8")
    s = rfp.load_settings(tmp_path)
    assert (s.buyer_url, s.identity_url, s.default_verification_template_id) == ("http://b:1", "http://i:2", "T1")
    url = make_url(s.database_url)
    assert (url.drivername, url.host, url.port, url.database, url.username, url.password) == ("mssql+pyodbc", "db.example", 1433, "ProcureIqDB", "u", "p@ss:w/rd")
    assert url.query["Encrypt"] == "no" and url.query["driver"] == "ODBC Driver 18 for SQL Server"
    assert "p@ss" not in repr(s)  # the password is never printed
    monkeypatch.setenv("PROCUREIQ_BUYER_URL", "http://env:9")
    assert rfp.load_settings(tmp_path).buyer_url == "http://env:9"
    monkeypatch.setenv("PROCUREIQ_ENVIRONMENT", "UAT")
    (tmp_path / "appsettings.UAT.json").write_text(json.dumps({"InterCallService": {"IdentityUrl": "http://uat-id"}}), encoding="utf-8")
    assert rfp.load_settings(tmp_path).identity_url == "http://uat-id"


def test_bad_appsettings_and_connection_strings_are_reported(tmp_path, monkeypatch):
    (tmp_path / "appsettings.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(RuntimeError, match="appsettings.json is not valid JSON"):
        rfp.load_settings(tmp_path)
    with pytest.raises(RuntimeError, match="needs Server and Database"):
        rfp.sqlalchemy_url("User Id=u;Password=p")
    assert rfp.sqlalchemy_url("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert rfp.load_settings(tmp_path / "nowhere").database_url == ""  # no default database
    monkeypatch.setattr(rfp, "procureiq_settings", dataclasses.replace(rfp.procureiq_settings, database_url=""))
    with pytest.raises(RuntimeError, match="chat database is not configured"):
        rfp.make_engine()


def test_every_page_of_the_category_lists_is_read():
    pages = []

    def handler(req):
        q = dict(req.url.params)
        pages.append((req.url.path.rsplit("/", 1)[-1], q.get("pageIndex"), q.get("pageSize"), q.get("segment"), q.get("searchTerm")))
        size, idx = int(q["pageSize"]), int(q["pageIndex"])
        total = 120 if req.url.path.endswith("segment") else 130
        rows = [{"segment": n, "title": f"Segment {n}"} for n in range((idx - 1) * size + 1, min(idx * size, total) + 1)]
        return httpx.Response(200, json={"items": rows, "totalCount": total})

    s = dataclasses.replace(rfp.procureiq_settings, masterdata_url="http://md")
    gw = HttpBuyerGateway("TOKEN", s, httpx.MockTransport(handler))
    assert len(gw.segments(None)) == 120 and [p[1] for p in pages] == ["1", "2"]
    pages.clear()
    assert len(gw.families(50)) == 130 and all(p[3] == "50" for p in pages) and [p[1] for p in pages] == ["1", "2"]


def test_a_server_that_ignores_paging_does_not_make_the_reader_loop():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(200, json=[{"segment": n, "title": f"S{n}"} for n in range(1, 101)])  # always the same 100 rows

    s = dataclasses.replace(rfp.procureiq_settings, masterdata_url="http://md")
    gw = HttpBuyerGateway("TOKEN", s, httpx.MockTransport(handler))
    assert len(gw.segments(None)) == 100 and len(calls) == 2


def test_dotnet_style_environment_variables_and_the_unset_password_message(tmp_path, monkeypatch):
    for v in ("PROCUREIQ_BUYER_URL", "PROCUREIQ_DATABASE_URL", "PROCUREIQ_ENVIRONMENT", "ASPNETCORE_ENVIRONMENT"):
        monkeypatch.delenv(v, raising=False)
    (tmp_path / "appsettings.json").write_text(json.dumps({
        "ConnectionStrings": {"DefaultConnection": "Server=h,1433;Database=ProcureIqDB;User Id=u;Password=;Encrypt=false;"},
        "InterCallService": {"BuyerUrl": "http://file"}}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="database password is not set"):
        rfp.load_settings(tmp_path)
    monkeypatch.setenv("ConnectionStrings__DefaultConnection", "Server=h,1433;Database=ProcureIqDB;User Id=u;Password=s3cret;Encrypt=false;")
    monkeypatch.setenv("InterCallService__BuyerUrl", "http://from-env")
    monkeypatch.setenv("ASPNETCORE_ENVIRONMENT", "UAT")
    (tmp_path / "appsettings.UAT.json").write_text(json.dumps({"InterCallService": {"IdentityUrl": "http://uat"}}), encoding="utf-8")
    s = rfp.load_settings(tmp_path)
    assert (s.buyer_url, s.identity_url) == ("http://from-env", "http://uat") and make_url(s.database_url).password == "s3cret"


def test_the_committed_appsettings_files_are_complete_and_hold_no_password():
    for name in ("appsettings.json", "appsettings.UAT.json"):
        text = (rfp.APPSETTINGS_DIR / name).read_text(encoding="utf-8")
        cfg = json.loads(text)
        assert set(cfg) >= {"ConnectionStrings", "InterCallService", "Rfq", "Assistant"} and set(cfg["InterCallService"]) == {"BuyerUrl", "MasterDataUrl", "SupplierUrl", "IdentityUrl"}
        assert "Password=;" in cfg["ConnectionStrings"]["DefaultConnection"]  # the password is never committed


def test_an_unavailable_chat_database_does_not_stop_the_ocr_service(monkeypatch):
    """Both services share one process: a missing or unreachable chat database must give the chat a 503, never stop OCR (the Buyer API depends on it)."""
    from app.main import app

    monkeypatch.setattr(rfp, "procureiq_settings", dataclasses.replace(rfp.procureiq_settings, dev_headers=True, database_url=""))
    monkeypatch.setattr(rfp, "_session_factory", None)
    monkeypatch.setattr(rfp, "_tables_ready", False)
    with TestClient(app) as client:  # runs the start-up: it must not raise
        assert client.get("/health").status_code == 200
        r = client.post("/api/v1/chat/message", json={"message": "help"}, headers=headers("alice", "buyer", tenant=ORG))
        assert r.status_code == 503 and r.json()["error"] == "AUTH_UNAVAILABLE" and "chat database is not available" in r.json()["message"]
        assert "Server=" not in r.text and "Password" not in r.text  # nothing about the connection leaks
