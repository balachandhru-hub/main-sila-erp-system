"""The buyer assistant (RFQ chatbot) in one module: it does the buyer's manual work (create an RFQ, list and compare bids, award, un-award, contracts,
purchase orders) by conversation, inside the real Buyer system. Mounted by `main.py` under /api/v1/chat/...

Sections, top to bottom: errors, caller identity, settings, login-token handling, database tables, Identity client, conversation models, language
understanding, the gateway to the .NET services, the RFQ flow, buyer operations, the conversation engine, and the REST API.

Sign in at Identity; the `access_token` cookie (or `Authorization: Bearer`) is checked by Identity's token-claim endpoint. No signing key is held here.
Every action is made with the caller's own token, so the chatbot can do only what the user could do by hand.
"""
from __future__ import annotations

from collections import OrderedDict
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
import difflib
import hashlib
import json
import logging
import os
import re
import threading
from time import monotonic
from typing import Any, Callable, Mapping, Protocol
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, DateTime, Engine, event, ForeignKey, Integer, JSON, select, String, Text, UniqueConstraint, URL
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session, sessionmaker


# ============================================================================
# Errors that become a short JSON answer ({error, message}) with an HTTP status.
# ============================================================================

class ProcurementError(Exception):
    status = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFound(ProcurementError):
    status, code = 404, "NOT_FOUND"


class Forbidden(ProcurementError):
    status, code = 403, "FORBIDDEN"


class Unauthorized(ProcurementError):
    status, code = 401, "UNAUTHORIZED"


class ServiceUnavailable(ProcurementError):
    status, code = 503, "AUTH_UNAVAILABLE"


# ============================================================================
# Who is calling: the user behind the login token (or, for local tests only, the X-Actor-* headers).
# ============================================================================

class ActorType(str, Enum):
    USER = "user"
    SUPPLIER = "supplier"


@dataclass(frozen=True)
class Actor:
    id: str
    type: ActorType
    roles: frozenset[str]
    tenant_id: str
    permissions: frozenset[str] | None = None  # the Identity permission keys of this login; None = unknown (the .NET services still enforce theirs)
    buyer_id: str | None = None


# ============================================================================
# Settings: appsettings.json (like the .NET services), then environment variables. No secrets live in code.
# ============================================================================

@dataclass(frozen=True)
class ProcureIqSettings:
    # SQLAlchemy URL of the chat database. Built from ConnectionStrings:DefaultConnection of appsettings.json (a .NET-style connection string is accepted),
    # or PROCUREIQ_DATABASE_URL. There is no default: without one the service refuses to start the chat database.
    database_url: str = field(default="", repr=False)  # repr=False: it may contain the password

    # --- Authentication. Normally NO secret is needed here: the login token (the `access_token` cookie) is sent to the Identity service's
    # `token-claim` endpoint, which validates it and returns the user, organisation and permissions.
    auth_cache_seconds: float = 60.0  # how long a validated token is trusted without asking Identity again (0 = ask every time)
    # The X-Actor-* test headers let anyone claim any identity. Off unless explicitly enabled, for local development and tests only.
    dev_headers: bool = False
    # JSON {role-guid: ["role", ...]} to grant roles to your Identity roles. Default grants plain "buyer" only (least privilege).
    role_map: dict[str, list[str]] = field(default_factory=dict)

    # --- The .NET services the chatbot talks to on the buyer's behalf (their own token is forwarded).
    buyer_url: str = ""
    masterdata_url: str = ""
    supplier_url: str = ""
    identity_url: str = ""
    http_timeout_seconds: float = 30.0
    # Verification-template ids the Buyer API wants on a new RFQ (see CreateRFQDto).
    default_verification_template_id: str = ""
    invite_template_id: str = ""  # TemplateId of CreateRFQDto; empty = use the default verification template


APPSETTINGS_DIR = Path(__file__).resolve().parent.parent  # python-backend/, next to app/


def _merge(base: dict[str, Any], over: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in over.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def read_appsettings(directory: Path | None = None) -> dict[str, Any]:
    """appsettings.json, then appsettings.<Environment>.json (Environment from ASPNETCORE_ENVIRONMENT or PROCUREIQ_ENVIRONMENT, for example UAT), like the .NET
    services' Program.cs, then appsettings.Local.json (never committed: the place for your own database password). A missing file is fine; a file that is not valid JSON is an error that names the file."""
    folder = directory or APPSETTINGS_DIR
    env = (os.getenv("ASPNETCORE_ENVIRONMENT") or os.getenv("PROCUREIQ_ENVIRONMENT") or "").strip()
    merged: dict[str, Any] = {}
    for name in ("appsettings.json", f"appsettings.{env}.json" if env else "", "appsettings.Local.json"):
        path = folder / name if name else None
        if path is None or not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except ValueError as e:
            raise RuntimeError(f"{path} is not valid JSON: {e}") from None
        if isinstance(data, dict):
            merged = _merge(merged, data)
    return merged


def _setting(cfg: dict[str, Any], path: str, env_name: str, default: str = "") -> str:
    """An environment variable wins over appsettings.json ("Section:Key"), which wins over the default. As in .NET, "Section:Key" is also read from the
    variable Section__Key (for example ConnectionStrings__DefaultConnection)."""
    for name in (env_name, path.replace(":", "__")):
        env = os.getenv(name)
        if env is not None and env.strip():
            return env.strip()
    node: Any = cfg
    for part in path.split(":"):
        node = node.get(part) if isinstance(node, dict) else None
    return str(node).strip() if node is not None and not isinstance(node, (dict, list)) else default


def sqlalchemy_url(conn: str, driver: str = "ODBC Driver 18 for SQL Server") -> str:
    """A SQLAlchemy URL passes through. A .NET SQL Server connection string (Server=host,port;Database=..;User Id=..;Password=..;Encrypt=false) is converted."""
    conn = conn.strip()
    if "://" in conn:
        return conn
    parts: dict[str, str] = {}
    for piece in conn.split(";"):
        if "=" in piece:
            k, v = piece.split("=", 1)
            parts[k.strip().lower()] = v.strip()
    server = parts.get("server") or parts.get("data source") or ""
    database = parts.get("database") or parts.get("initial catalog") or ""
    if not server or not database:
        raise RuntimeError("The connection string needs Server and Database (for example Server=host,1433;Database=ProcureIqDB;User Id=..;Password=..).")
    host, _, port = server.removeprefix("tcp:").partition(",")

    def flag(key: str, default: bool) -> str:
        v = parts.get(key)
        return "yes" if (default if v is None else v.lower() in ("true", "yes", "1")) else "no"

    query = {"driver": driver, "Encrypt": flag("encrypt", False), "TrustServerCertificate": flag("trustservercertificate", True)}
    user, password = parts.get("user id") or parts.get("uid"), parts.get("password") or parts.get("pwd")
    if user is None:
        query["Trusted_Connection"] = "yes"
    elif not password:
        raise RuntimeError("The database password is not set. Put it in appsettings.Local.json (not committed) or in the ConnectionStrings__DefaultConnection environment variable.")
    return URL.create("mssql+pyodbc", username=user, password=password, host=host, port=int(port) if port else None, database=database,
                      query=query).render_as_string(hide_password=False)


def load_settings(directory: Path | None = None) -> ProcureIqSettings:
    cfg = read_appsettings(directory)
    conn = _setting(cfg, "ConnectionStrings:DefaultConnection", "PROCUREIQ_DATABASE_URL")
    driver = _setting(cfg, "ConnectionStrings:OdbcDriver", "PROCUREIQ_ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
    assistant = cfg.get("Assistant") if isinstance(cfg.get("Assistant"), dict) else {}
    return ProcureIqSettings(
        database_url=sqlalchemy_url(conn, driver) if conn else "",
        dev_headers=_setting(cfg, "Assistant:DevHeaders", "PROCUREIQ_DEV_HEADERS", "false").lower() in ("1", "true", "yes"),
        auth_cache_seconds=_to_float(_setting(cfg, "Assistant:AuthCacheSeconds", "PROCUREIQ_AUTH_CACHE_SECONDS"), 60.0),
        role_map=_role_map(assistant.get("RoleMap"), os.getenv("PROCUREIQ_ROLE_MAP", "")),
        buyer_url=_setting(cfg, "InterCallService:BuyerUrl", "PROCUREIQ_BUYER_URL").rstrip("/"),
        masterdata_url=_setting(cfg, "InterCallService:MasterDataUrl", "PROCUREIQ_MASTERDATA_URL").rstrip("/"),
        supplier_url=_setting(cfg, "InterCallService:SupplierUrl", "PROCUREIQ_SUPPLIER_URL").rstrip("/"),
        identity_url=_setting(cfg, "InterCallService:IdentityUrl", "PROCUREIQ_IDENTITY_URL").rstrip("/"),
        http_timeout_seconds=_to_float(_setting(cfg, "Assistant:HttpTimeoutSeconds", "PROCUREIQ_HTTP_TIMEOUT"), 30.0),
        default_verification_template_id=_setting(cfg, "Rfq:VerificationTemplateId", "PROCUREIQ_VERIFICATION_TEMPLATE_ID"),
        invite_template_id=_setting(cfg, "Rfq:InviteTemplateId", "PROCUREIQ_INVITE_TEMPLATE_ID"),
    )


def _to_float(text: str, default: float) -> float:
    try:
        return float(text) if text else default
    except ValueError:
        return default


def _role_map(from_file: Any, from_env: str) -> dict[str, list[str]]:
    """{role-guid: ["role", ...]} from appsettings (Assistant:RoleMap) or the PROCUREIQ_ROLE_MAP JSON variable (which wins)."""
    raw: Any = from_file
    if from_env.strip():
        try:
            raw = json.loads(from_env)
        except ValueError:
            raw = None
    try:
        return {str(k).lower(): [str(r) for r in v] for k, v in raw.items()} if isinstance(raw, dict) else {}
    except (TypeError, AttributeError):
        return {}


procureiq_settings = load_settings()


# ============================================================================
# Where the login token comes from, and which PROCUREIQ roles a login gets.
# ============================================================================

COOKIE_NAME = "access_token"


def extract_token(cookies: Mapping[str, str], authorization: str | None) -> str | None:
    """An explicit `Authorization: Bearer <token>` wins (so a token pasted into Swagger is not overridden by an old cookie); otherwise the `access_token` cookie."""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()
        if bearer:
            return bearer
    return (cookies.get(COOKIE_NAME) or "").strip() or None


def roles_for(org_type: str, role_id: str | None, role_map: Mapping[str, list[str]]) -> frozenset[str]:
    """Roles for a login. Everyone in a buyer organisation is a plain `buyer`; extra roles come only from the configured map."""
    base = {"buyer"} if org_type == "buyer" else {"supplier"} if org_type == "supplier" else {"platform"}
    return frozenset(base | set(role_map.get((role_id or "").lower(), [])))


# ============================================================================
# Engine, session factory and shared column mixins.
# ============================================================================

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


def make_engine(url: str | None = None) -> Engine:
    url = url or procureiq_settings.database_url
    if not url:
        raise RuntimeError("The chat database is not configured: set ConnectionStrings:DefaultConnection in appsettings.Local.json (or PROCUREIQ_DATABASE_URL).")
    kwargs: dict[str, object] = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):  # type: ignore[no-untyped-def]
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


_db_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_session_factory() -> sessionmaker[Session]:
    global _db_engine, _session_factory
    if _session_factory is None:
        _db_engine = make_engine()
        _session_factory = sessionmaker(_db_engine, expire_on_commit=False)
    return _session_factory


def init_db() -> None:
    """Creates the tables. Production uses migrations (Alembic); this is for development and tests."""

    get_session_factory()
    assert _db_engine is not None
    Base.metadata.create_all(_db_engine)


logger = logging.getLogger("python-backend.rfp")
_tables_ready = False


def ensure_tables() -> None:
    """Creates the chat tables once. When the database is not configured or not reachable this raises ServiceUnavailable (HTTP 503) for the chat only: the OCR
    endpoints in the same service keep working, and the next chat request tries again."""
    global _tables_ready
    if _tables_ready:
        return
    try:
        init_db()
        _tables_ready = True
    except Exception as e:  # noqa: BLE001 - whatever the driver raises, the caller gets a safe message
        logger.error("The chat database is not available: %s: %s", type(e).__name__, str(e).splitlines()[0][:300] if str(e) else "")
        raise ServiceUnavailable("The chat database is not available right now. Try again in a moment.") from None


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service, rolled back on error."""
    ensure_tables()
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


# ============================================================================
# The chatbot's tables: one row per conversation and one per message. Portable types only (Uuid, JSON), so the same models run on
# ============================================================================

def _fk(target: str) -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey(target, ondelete="CASCADE"), index=True)


class ChatSession(IdMixin, TimestampMixin, Base):
    """One conversation of one user. `state` holds the flow in progress (for example an RFQ draft waiting for answers)."""

    __tablename__ = "chat_session"
    organization_id: Mapped[str] = mapped_column(String(100), index=True)  # tenant
    user_id: Mapped[str] = mapped_column(String(200), index=True)
    title: Mapped[str | None] = mapped_column(String(200), default=None)
    state: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), default=None)
    messages: Mapped[list[ChatMessage]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.seq")


class ChatMessage(IdMixin, Base):
    __tablename__ = "chat_message"
    session_id: Mapped[uuid.UUID] = _fk("chat_session.id")
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), default=None)  # tables, quick replies, ids the reply refers to
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    session: Mapped[ChatSession] = relationship(back_populates="messages")
    __table_args__ = (UniqueConstraint("session_id", "seq"),)


# ============================================================================
# Who is calling, and what may they do? Asked of the Identity service, which owns the answer.
# ============================================================================

MAX_CACHE = 2000


class AuthError(Exception):
    """The login token is missing, invalid, expired or not usable for this API."""


class IdentityRejected(AuthError):
    """Identity answered but did not accept the token (`status` 401) or the role may not read its own claims (403)."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


class IdentityUnavailable(Exception):
    """Identity could not be asked (down, slow, or answered something unusable). The caller is not necessarily unauthenticated."""


@dataclass(frozen=True)
class Claims:
    user_id: str
    person_id: str | None
    organization_id: str
    role_id: str | None
    permissions: frozenset[str]
    buyer_id: str | None
    supplier_id: str | None
    org_type: str  # buyer | supplier | platform


_cache: "OrderedDict[str, tuple[float, Claims]]" = OrderedDict()
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def _org_type(raw: object) -> str:
    return {"1": "buyer", "buyer": "buyer", "2": "supplier", "supplier": "supplier", "3": "platform", "platform": "platform"}.get(str(raw or "").strip().lower(), "unknown")


def _claim_value(d: dict, *keys: str) -> object:
    for k in keys:
        if d.get(k) is not None:
            return d[k]
        if d.get(k[:1].upper() + k[1:]) is not None:
            return d[k[:1].upper() + k[1:]]
    return None


def parse_claims(data: object) -> Claims:
    if not isinstance(data, dict):
        raise IdentityUnavailable("Identity returned something unexpected.")
    user, org = _claim_value(data, "userId"), _claim_value(data, "organizationId")
    if not user or not org:
        raise IdentityRejected(401, "The login has no user or organisation.")
    perms = _claim_value(data, "permissions")
    return Claims(
        user_id=str(user), person_id=str(_claim_value(data, "personId")) if _claim_value(data, "personId") else None, organization_id=str(org),
        role_id=str(_claim_value(data, "roleId")) if _claim_value(data, "roleId") else None,
        permissions=frozenset(str(p) for p in perms) if isinstance(perms, list) else frozenset(),
        buyer_id=str(_claim_value(data, "buyerId")) if _claim_value(data, "buyerId") else None, supplier_id=str(_claim_value(data, "supplierId")) if _claim_value(data, "supplierId") else None,
        org_type=_org_type(_claim_value(data, "organizationType")))


def fetch_claims(token: str, settings: ProcureIqSettings | None = None, transport: httpx.BaseTransport | None = None,
                 clock=monotonic) -> Claims:  # noqa: ANN001
    s = settings or procureiq_settings
    key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = clock()
    if s.auth_cache_seconds > 0:
        with _lock:
            hit = _cache.get(key)
            if hit and hit[0] > now:
                _cache.move_to_end(key)
                return hit[1]
    if not s.identity_url:
        raise IdentityUnavailable("The login service address is not configured (set PROCUREIQ_IDENTITY_URL).")
    try:
        with httpx.Client(timeout=min(s.http_timeout_seconds, 10.0), transport=transport) as http:
            resp = http.get(f"{s.identity_url}/api/v1/identity/token-claim", headers={"Cookie": f"access_token={token}", "Accept": "application/json"})
    except httpx.HTTPError:
        raise IdentityUnavailable("The login service could not be reached.") from None
    if resp.status_code == 401:
        raise IdentityRejected(401, "Invalid or expired login. Sign in again.")
    if resp.status_code == 403:
        raise IdentityRejected(403, "Your role is not allowed to read its own login details (permission GET_ALL_CLAIMS), so I cannot tell what you may do.")
    if resp.status_code >= 400:
        raise IdentityUnavailable(f"The login service answered {resp.status_code}.")
    try:
        claims = parse_claims(resp.json())
    except ValueError:
        raise IdentityUnavailable("The login service answered something I could not read.") from None
    if s.auth_cache_seconds > 0:
        with _lock:
            _cache[key] = (now + s.auth_cache_seconds, claims)
            while len(_cache) > MAX_CACHE:
                _cache.popitem(last=False)
    return claims


# ============================================================================
# Schemas of the chatbot: what the API returns, and the state a conversation keeps between messages.
# ============================================================================

PLACEHOLDER = "N/A"  # the Buyer API refuses empty strings on required text fields, so unknown values are sent as this


class ItemChoice(BaseModel):
    item: str = Field(max_length=300, description="The item of the draft, by the name it has there")
    code: str | None = Field(default=None, max_length=100, description="Material code of the item-master entry to use; leave out for free text")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, examples=["create a rfq for fresh and frozen meat products, including chicken and shrimp"])
    session_id: uuid.UUID | None = Field(
        default=None, examples=[None],
        description="Leave this out (or null) to start a new conversation. To continue one, send the session_id from the previous reply. Do not invent one.")
    item_choices: list[ItemChoice] | None = Field(
        default=None, description="The answer of the item table (the reply's data.item_table): an item-master entry or free text for each item. `message` is then only what is shown in the conversation.")


class Table(BaseModel):
    title: str | None = None
    columns: list[str]
    rows: list[list[str]]


class ChatReply(BaseModel):
    session_id: uuid.UUID
    reply: str
    suggestions: list[str] = Field(default_factory=list, description="Quick replies the UI can show as buttons")
    tables: list[Table] = Field(default_factory=list)
    awaiting: str | None = Field(default=None, description="What the bot is waiting for, e.g. 'quantities' or 'confirm'")
    needs_confirmation: bool = False
    flow: str | None = None
    data: dict[str, Any] = Field(default_factory=dict, description="Ids the reply refers to, e.g. rfq_id")


class SessionOut(BaseModel):
    id: uuid.UUID
    title: str | None
    flow: str | None
    updated_at: str
    messages: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------- RFQ draft


class DraftItem(BaseModel):
    name: str
    quantity: float | None = None
    uom: str | None = None
    material_code: str | None = None
    material_group: str | None = None
    matched_description: str | None = None  # the item-master entry it was matched to
    resolved: bool = False  # item master looked up (matched or accepted as free text)
    candidates: list[dict[str, Any]] = Field(default_factory=list)


class PickedSupplier(BaseModel):
    supplier_id: str
    organization_id: str
    name: str
    verified: bool = True
    user_ids: list[str] = Field(default_factory=list)


class ExternalSupplier(BaseModel):
    name: str
    email: str
    phone: str = PLACEHOLDER
    address: str = PLACEHOLDER


class RfqDraft(BaseModel):
    purpose: str | None = None
    title: str | None = None
    items: list[DraftItem] = Field(default_factory=list)
    department: str | None = None
    department_id: str | None = None
    cost_center: str | None = None
    region: str | None = None
    currency: str | None = None
    delivery_location: str | None = None
    start_date: str | None = None  # ISO datetime
    end_date: str | None = None
    delivery_target_date: str | None = None
    budget: float | None = None
    add_lot_option: bool = False
    segment_id: int | None = None
    segment_title: str | None = None
    family_id: int | None = None
    family_title: str | None = None
    category_decided: bool = False
    picked: list[PickedSupplier] = Field(default_factory=list)
    externals: list[ExternalSupplier] = Field(default_factory=list)
    suppliers_decided: bool = False
    questions: list[str] = Field(default_factory=list)
    questions_decided: bool = False
    # What the first message already named, to be matched when the question comes up (the classification and the supplier list are looked up then).
    wanted_category: str | None = None
    wanted_family: str | None = None
    wanted_suppliers: list[str] = Field(default_factory=list)

    awaiting: str | None = None
    options: list[dict[str, Any]] = Field(default_factory=list)  # numbered options of the question being asked
    stage: str = "collecting"  # collecting | review | sending | done
    notes: list[str] = Field(default_factory=list)  # automatic decisions to tell the user about on the next reply
    pending_bare: list[Any] | None = None  # [quantity, uom] waiting for a yes/no ("apply to every item?")
    item_cursor: int | None = None  # which item an item-master choice is about
    sent_rfq_id: str | None = None


# ============================================================================
# Reading what a buyer types. Rule-based and deterministic: it extracts only what the text states and returns None for the rest, so the
# ============================================================================

TRIGGERS = r"including|includes|include|such as|consisting of|comprising|items? (?:are|is|include)|the following|namely|like"
UNIT_ALIASES: dict[str, str] = {
    "kg": "KG", "kgs": "KG", "kilo": "KG", "kilos": "KG", "kilogram": "KG", "kilograms": "KG",
    "g": "G", "gm": "G", "gms": "G", "gram": "G", "grams": "G", "lb": "LB", "lbs": "LB", "pound": "LB", "pounds": "LB",
    "t": "T", "ton": "T", "tons": "T", "tonne": "T", "tonnes": "T", "mt": "T",
    "l": "L", "lt": "L", "ltr": "L", "ltrs": "L", "litre": "L", "litres": "L", "liter": "L", "liters": "L", "ml": "ML",
    "pc": "PCS", "pcs": "PCS", "piece": "PCS", "pieces": "PCS", "nos": "PCS", "unit": "PCS", "units": "PCS", "ea": "EA",
    "box": "BOX", "boxes": "BOX", "dozen": "DZ", "doz": "DZ", "dz": "DZ", "pair": "PR", "pairs": "PR", "pallet": "PALLET", "pallets": "PALLET",
    "m": "M", "meter": "M", "meters": "M", "metre": "M", "metres": "M",
}
_UNIT_WORDS = "|".join(sorted(UNIT_ALIASES, key=len, reverse=True))
_QTY = rf"(\d{{1,3}}(?:,\d{{3}})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*({_UNIT_WORDS})\b"
_ARTICLES = re.compile(r"^(?:the|a|an|some|of)\s+", re.I)
_STOP = {"the", "a", "an", "of", "and", "for", "with", "fresh", "frozen"}

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def norm(text: str) -> str:
    return text.replace("×", "x").replace("–", "-").replace("’", "'").strip()


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", norm(text).lower()) if t not in _STOP]


# ---------------------------------------------------------------- intents

_RFQ_WORD = r"(?:rfq|rfqs|request(?:s)? for (?:quotation|quote)s?|quotation request|quote request|rfp)"


_NOT_A_NEW_RFQ = re.compile(r"\b(contract|purchase orders?|award\w*|compare|comparison|bids?|quotes?|quotations?|status|details?|freeze|report)\b")


def wants_new_rfq(text: str) -> bool:
    """A request to start an RFQ. 'create a contract for RFQ-2026…' is not one: it names an existing RFQ and asks for something else."""
    t = re.sub(r"\brfq-\d{6,}\b", " ", norm(text).lower())  # an RFQ number refers to an existing RFQ
    if re.match(r"\s*(show|list|view|display|get|find|search|what|which|how many|see|give me)\b", t):
        return False  # a question or lookup about existing RFQs ("show my open RFQs"), not a request to make one
    m = re.search(rf"\b(create|raise|make|start|prepare|draft|issue|launch|float|need|want|new|generate)\b([^.?!]{{0,40}})\b{_RFQ_WORD}\b", t)
    if m and not _NOT_A_NEW_RFQ.search(m.group(2)):
        return True
    if re.search(rf"\bopen\s+(?:a|an|new)\b[^.?!]{{0,30}}\b{_RFQ_WORD}\b", t):  # "open a new RFQ", but not "open RFQs"
        return True
    return bool(re.search(rf"\b{_RFQ_WORD}\b\s+(?:for|to buy|to source)\b", t))


def is_confirm(text: str) -> bool:
    return bool(re.fullmatch(r"\s*(?:yes|y|yep|yeah|ok|okay|confirm(?:ed)?|confirm and send(?: rfq)?|send it|send|go ahead|proceed|do it|approved?|correct|that'?s right)[\s.!]*", norm(text).lower()))


def is_cancel(text: str) -> bool:
    return bool(re.fullmatch(r"\s*(?:cancel|stop|abort|discard|never mind|nevermind|start over|reset|forget it|no thanks)[\s.!]*", norm(text).lower()))


def is_skip(text: str) -> bool:
    return bool(re.fullmatch(r"\s*(?:none|no|nope|nothing|skip|n/a|na|not needed|no thanks|no budget|no questions?|nil)[\s.!]*", norm(text).lower()))


# ---------------------------------------------------------------- items

def _clean_item(s: str) -> str:
    s = _ARTICLES.sub("", s.strip(" .,;:-"))
    return re.sub(r"\s+", " ", s).strip()


_CLAUSE = re.compile(
    r"^(?:clos\w*|deadline|due|deliver\w*|delivery|ship\w*|budget|needed|required|by|before|within|until|on|in\s+\d|currency|payment|"
    r"to be delivered|bidding|quotes?|please|thanks|thank you|asap|urgent\w*)\b", re.I)


def is_clause(part: str) -> bool:
    """A piece of the sentence that states timing, budget or delivery rather than naming something to buy."""
    p = part.strip()
    return bool(_CLAUSE.match(p) or re.fullmatch(r"\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}", p) or (parse_date(p, date(2000, 1, 1)) is not None and re.search(r"\b\d", p)
                                                                                         and not re.search(_QTY, p, flags=re.I)))


_MODIFIERS = frozenset({"fresh", "frozen", "chilled", "dried", "dry", "live", "raw", "cooked", "canned", "organic", "smoked", "salted", "processed", "whole", "ripe"})


def split_list(text: str) -> list[str]:
    """Split a spoken list on commas, 'and', '&' and ';' without breaking '5x5 cubes'. Timing, budget and delivery clauses are not items."""
    parts = re.split(r"\s*(?:,|;|&|\band\b|\bplus\b|\bas well as\b)\s*", norm(text), flags=re.I)
    cleaned = [_clean_item(p) for p in parts if _clean_item(p)]
    merged: list[str] = []
    for p in cleaned:
        if merged and merged[-1].lower() in _MODIFIERS:
            words = p.split()
            if words[0].lower() in _MODIFIERS and len(words) > 1 and len(cleaned) >= 3:
                # In a longer list, "fresh & frozen meat products" is two items sharing the noun: "fresh meat products" and "frozen meat products".
                # On its own ("fresh and frozen meat for hotel operations") it stays one phrase.
                tail = " ".join(w for w in words if w.lower() not in _MODIFIERS)
                merged[-1] = f"{merged[-1]} {tail}"
                merged.append(p)
            else:
                merged[-1] = f"{merged[-1]} & {p}"
        else:
            merged.append(p)
    return [p for p in merged if not is_clause(p)]


_PURPOSE_WORDS = re.compile(r"\b(products?|goods|supplies|items?|materials?|equipment|services?|operations?|purposes?|needs?|use|restaurants?|hotels?|kitchens?|stock|requirements?)\b", re.I)


def parse_request(text: str) -> tuple[str | None, list[str]]:
    """(purpose, items) from 'create a rfq for <purpose> including a, b and c'."""
    t = norm(text)
    m = re.search(rf"\b(?:{TRIGGERS})\b[\s:,-]*(.+)$", t, flags=re.I | re.S)
    if m:
        head = t[: m.start()]
        items = split_list(m.group(1))
        pm = re.search(rf"{_RFQ_WORD}\s*(?:for|to buy|to source|of)?\s*(.*)$", head, flags=re.I | re.S)
        purpose = _clean_item(re.sub(r"\s+", " ", (pm.group(1) if pm else head))) or None
        return purpose, items
    m = re.search(rf"{_RFQ_WORD}\s*(?:(?:for|to buy|to source|of)\s+|[:–-]\s*|\s+)(.+)$", t, flags=re.I | re.S)
    if m:
        chunk = m.group(1)
        listed, _, why = chunk.partition(" for ")  # "milk, cheese and eggs for the hotel kitchen": a list, then what it is for
        if why.strip():
            named = split_list(listed)
            if len(named) >= 2 and all(len(p.split()) <= 4 and tokens(p) for p in named):
                return _clean_item(why) or None, named
        parts = split_list(chunk)
        if len(parts) >= 2 and all(len(p.split()) <= 5 for p in parts) and not re.search(r"\b(operations?|purposes?|needs?|use|restaurants?|hotels?)\b", chunk, re.I):
            return None, parts
        if len(parts) == 1 and len(item_inline_qty(parts[0])[0].split()) <= 3 and not _PURPOSE_WORDS.search(parts[0]):
            return None, parts  # "create RFQ for chicken": one short thing to buy, not a description of the purpose
        return _clean_item(chunk) or None, []
    return None, []


def item_inline_qty(item: str) -> tuple[str, float | None, str | None]:
    """'chicken 50 kg' / '50 kg chicken' -> ('chicken', 50, 'KG'). A '5x5' size is not a quantity."""
    m = re.search(_QTY, item, flags=re.I)
    if not m:
        return item, None, None
    name = _clean_item((item[: m.start()] + " " + item[m.end():]).replace("  ", " "))
    return (name or item), float(m.group(1).replace(",", "")), UNIT_ALIASES[m.group(2).lower()]


_STATE_WORDS = frozenset({"fresh", "frozen"})


def match_item(ref: str, names: list[str]) -> int | None:
    """Which item a phrase like 'wings' or 'chicken 5x5' refers to: the best token overlap, ties broken by the shorter name."""
    rt = set(tokens(ref))
    if not rt:
        return None
    ref_state = _STATE_WORDS & set(re.findall(r"[a-z]+", ref.lower()))
    best, best_key = None, (0.0, 0)
    for i, n in enumerate(names):
        nt = set(tokens(n))
        hit = len(rt & nt)
        if not hit:
            continue
        # "fresh"/"frozen" don't count as tokens, but they tell "fresh meat" from "frozen meat" when both are items
        name_state = _STATE_WORDS & set(re.findall(r"[a-z]+", n.lower()))
        state = 0.1 if ref_state & name_state else -0.1 if ref_state and name_state else 0.0
        key = (hit / len(rt | nt) + (0.5 if rt <= nt or nt <= rt else 0) + state, -len(nt))
        if best is None or key > best_key:
            best, best_key = i, key
    return best


def bare_quantity(text: str) -> tuple[float, str] | None:
    """'50 kg' with no item named (and no 'each'/'all'): the caller must ask whether it applies to every item."""
    t = norm(text)
    m = re.fullmatch(rf"\s*(?:about|around|approx\.?|of)?\s*{_QTY}\s*(?:please)?\s*", t, flags=re.I)
    return (float(m.group(1).replace(",", "")), UNIT_ALIASES[m.group(2).lower()]) if m else None


def parse_quantities(text: str, names: list[str], missing: list[int]) -> dict[int, tuple[float, str]]:
    """Quantities for items from a reply such as 'chicken 50 kg, wings 30 kg, shrimp 20 kg' or 'all 20 kg' or '50 kg'."""
    t = norm(text)
    out: dict[int, tuple[float, str]] = {}
    for seg in [s for s in re.split(r"\s*(?:,|;|\n|\band\b|&)\s*", t, flags=re.I) if s.strip()]:
        m = re.search(_QTY, seg, flags=re.I)
        if not m:
            continue
        qty, uom = float(m.group(1).replace(",", "")), UNIT_ALIASES[m.group(2).lower()]
        rest = _clean_item((seg[: m.start()] + " " + seg[m.end():]))
        rest_low = rest.lower()
        if re.search(r"\b(all|each|every|apiece|per item)\b", rest_low):
            for i in missing:
                out.setdefault(i, (qty, uom))
            continue
        if not rest_low.strip(" of"):  # a bare '50 kg': it names no item, so it fits only when exactly one item is missing
            if len(missing) == 1:
                out[missing[0]] = (qty, uom)
            continue
        idx = match_item(rest, names)
        if idx is not None:
            out[idx] = (qty, uom)
    return out


# ---------------------------------------------------------------- dates, numbers, choices

def parse_date(text: str, today: date) -> date | None:
    t = norm(text).lower()
    if m := re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", t):
        return _safe(int(m[1]), int(m[2]), int(m[3]))
    if m := re.search(r"\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b", t):
        return _safe(int(m[3]), int(m[2]), int(m[1]))  # day first
    mon = "|".join(MONTHS)
    if m := re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({mon})[a-z]*\.?(?:,?\s+(\d{{4}}))?", t):
        return _upcoming(today, int(m[1]), MONTHS[m[2]], m[3])
    if m := re.search(rf"\b({mon})[a-z]*\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t):
        return _upcoming(today, int(m[2]), MONTHS[m[1]], m[3])
    if re.search(r"\btoday\b", t):
        return today
    if re.search(r"\btomorrow\b", t):
        return today + timedelta(days=1)
    if m := re.search(r"\b(?:in|within|after)\s+(\d{1,3})\s*(day|week|month)s?\b", t):
        n = int(m[1])
        return today + timedelta(days={"day": n, "week": 7 * n, "month": 30 * n}[m[2]])
    if re.search(r"\bnext week\b", t):
        return today + timedelta(days=7)
    if re.search(r"\bnext month\b", t):
        return today + timedelta(days=30)
    return None


def _safe(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _upcoming(today: date, day: int, month: int, year: str | None) -> date | None:
    if year:
        return _safe(int(year), month, day)
    d = _safe(today.year, month, day)
    if d is not None and d < today:
        d = _safe(today.year + 1, month, day)
    return d


def parse_amount(text: str) -> float | None:
    """'AED 50,000', '50k', '1.5m' -> a number; None when there is none."""
    t = norm(text).lower()
    m = re.search(r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|million|thousand)?\b", t)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    return v * {"k": 1e3, "thousand": 1e3, "m": 1e6, "million": 1e6}.get(m.group(2) or "", 1)


def parse_choices(text: str, count: int) -> list[int]:
    """0-based picks from '1', '1,3', '2 and 4', 'all', 'first', '2-4'. Out-of-range numbers are dropped."""
    t = norm(text).lower()
    if re.search(r"\b(all|everyone|every one|everything)\b", t):
        return list(range(count))
    picks: list[int] = []
    for a, b in re.findall(r"\b(\d+)\s*-\s*(\d+)\b", t):
        picks += list(range(int(a), int(b) + 1))
    t2 = re.sub(r"\b\d+\s*-\s*\d+\b", " ", t)
    picks += [int(n) for n in re.findall(r"\b\d+\b", t2)]
    for word, n in (("first", 1), ("second", 2), ("third", 3), ("fourth", 4), ("fifth", 5), ("last", count)):
        if re.search(rf"\b{word}\b", t):
            picks.append(n)
    return sorted({p - 1 for p in picks if 1 <= p <= count})


def pick_by_name(text: str, names: list[str]) -> int | None:
    """The option the text names. An exact name wins ("DEPT1" is not confused with "DEPT15"); otherwise the longest option name that appears in the text as
    whole words; otherwise the one option whose name contains the text. None when nothing, or more than one, fits."""
    t = norm(text).lower().strip()
    low = [n.lower() for n in names]
    exact = [i for i, n in enumerate(low) if n == t]
    if len(exact) == 1:
        return exact[0]
    hits = [i for i, n in enumerate(low) if n and re.search(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", t)]
    if hits:
        longest = max(len(low[i]) for i in hits)
        top = [i for i in hits if len(low[i]) == longest]
        return top[0] if len(top) == 1 else None
    partial = [i for i, n in enumerate(low) if len(t) >= 3 and t in n]
    return partial[0] if len(partial) == 1 else None


def find_emails(text: str) -> list[str]:
    return re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text)


def find_currency(text: str, allowed: list[str]) -> str | None:
    up = norm(text).upper()
    for c in allowed:
        if re.search(rf"\b{re.escape(c)}\b", up):
            return c
    return None


def parse_match_answer(text: str, names: list[str], option_counts: list[int]) -> tuple[dict[int, int], list[str]]:
    """Answers to several 'pick one' questions at once. names[i] is question i's subject and option_counts[i] how many options it has (the last one is 'free text').

    Understood: '1, 2' (one number per question, in order), 'chicken 1, shrimp 2' (by name), 'A1, B2' (by letter), '1 for all', 'free text for all'.
    Returns ({question position: chosen option number, 1-based}, problems). Questions that are not answered are simply absent.
    """
    t = norm(text).lower()
    n = len(names)
    out: dict[int, int] = {}
    problems: list[str] = []

    def put(i: int, k: int) -> None:
        if i in out:
            return
        if 1 <= k <= option_counts[i]:
            out[i] = k
        else:
            problems.append(f"{names[i]}: choose a number from 1 to {option_counts[i]}, not {k}")

    if re.search(r"\b(free ?text|none of these|none|skip)\b", t) and re.search(r"\b(all|every|each|everything|these)\b|^\s*(free ?text|none|skip)\W*$", t):
        return {i: option_counts[i] for i in range(n)}, []
    m = re.search(r"\b(?:all|every|each)\b\D{0,12}(\d+)", t) or re.search(r"(\d+)\s*(?:for|to)\s*(?:all|every|each)\b", t)
    if m or re.search(r"\bfirst\b.*\b(all|every|each)\b|\b(all|every|each)\b.*\bfirst\b", t):
        k = int(m.group(1)) if m else 1
        for i in range(n):
            put(i, k)
        return out, problems

    segments = [s for s in re.split(r"\s*(?:,|;|\n|\band\b|&)\s*", t) if s.strip()]
    positional: list[int] = []
    for seg in segments:
        letter = re.fullmatch(r"\s*([a-z])\s*[-.:)]?\s*(\d+)\s*", seg)
        if letter and ord(letter.group(1)) - 97 < n:
            put(ord(letter.group(1)) - 97, int(letter.group(2)))
            continue
        sized = re.sub(r"\b\d+\s*x\s*\d+\b", " ", seg)  # "5x5" in an item name is a size, not a choice
        nums = [int(x) for x in re.findall(r"\d+", sized)]
        if not nums:
            continue
        rest = re.sub(r"\d+", " ", sized)
        idx = match_item(rest, names) if tokens(rest) else None
        if idx is not None:
            put(idx, nums[0])
        else:
            positional += nums
    free = [i for i in range(n) if i not in out]
    for i, k in zip(free, positional):
        put(i, k)
    return out, problems


# ============================================================================
# The chatbot's hands: calls to the .NET services (Buyer 8004, Master Data 8002, Supplier 8003, Identity 8001) made as the buyer.
# ============================================================================

class GatewayError(Exception):
    """A call to a .NET service failed. `message` is safe to show the user."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class BuyerGateway(Protocol):
    def profile(self) -> dict[str, Any]: ...
    def departments(self) -> list[dict[str, Any]]: ...
    def cost_centers(self, department_id: str | None = None) -> list[dict[str, Any]]: ...
    def units(self) -> list[str]: ...
    def currencies(self) -> list[str]: ...
    def segments(self, search: str | None) -> list[dict[str, Any]]: ...
    def families(self, segment: int) -> list[dict[str, Any]]: ...
    def item_master(self, search: str, buyer_id: str | None, index: int = 0, limit: int = 10) -> list[dict[str, Any]]: ...
    def find_suppliers(self, search: str | None, segment: int | None, family: int | None, verified: bool | None, buyer_id: str, limit: int) -> list[dict[str, Any]]: ...
    def supplier_users(self, organization_id: str) -> list[dict[str, Any]]: ...
    def create_rfq(self, dto: dict[str, Any]) -> dict[str, Any]: ...
    def list_rfqs(self, search: str | None, status: str | None, limit: int) -> list[dict[str, Any]]: ...
    def rfq(self, rfq_id: str) -> dict[str, Any]: ...
    def bid_compare(self, rfq_id: str) -> dict[str, Any]: ...
    def set_rfq_status(self, rfq_id: str, status: str) -> None: ...
    def award(self, dto: dict[str, Any]) -> dict[str, Any]: ...
    def unaward(self, rfq_id: str) -> None: ...
    def create_contract(self, dto: dict[str, Any]) -> dict[str, Any]: ...
    def purchase_orders(self, limit: int) -> list[dict[str, Any]]: ...


def _unwrap(data: Any) -> list[dict[str, Any]]:
    """The services answer a bare list or a paged object ({items|data|result}). Anything else is treated as empty."""
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("items", "data", "result", "results"):
            if isinstance(data.get(k), list):
                return [x for x in data[k] if isinstance(x, dict)]
    return []


def _message(resp: httpx.Response) -> str:
    """The .NET error body is {status_code, message, description}; some endpoints answer ProblemDetails or plain text."""
    try:
        body = resp.json()
        if isinstance(body, dict):
            text = body.get("description") or body.get("message") or body.get("detail") or body.get("title")
            if text:
                return str(text)[:300]
    except ValueError:
        pass
    return (resp.text or "").strip()[:300]


class HttpBuyerGateway:
    shared_cache = True  # slow-changing lists may be kept between requests (see RefData)

    def __init__(self, token: str | None, settings: ProcureIqSettings | None = None, transport: httpx.BaseTransport | None = None) -> None:
        self._s = settings or procureiq_settings
        self._token = token
        self._http = httpx.Client(timeout=self._s.http_timeout_seconds, transport=transport)

    def close(self) -> None:
        self._http.close()

    # -------------------------------------------------------------- plumbing
    def _call(self, method: str, url: str, *, params: dict[str, Any] | None = None, json: Any = None) -> Any:
        if not self._token:
            raise GatewayError(401, "You are not signed in, so I cannot act in the buyer system. Sign in and try again.")
        started = monotonic()
        try:
            resp = self._http.request(method, url, params={k: v for k, v in (params or {}).items() if v is not None}, json=json,
                                      headers={"Cookie": f"access_token={self._token}", "Accept": "application/json"})
            logger.info("%s %s -> %s in %.0f ms", method, url.split("?")[0], resp.status_code, (monotonic() - started) * 1000)  # to see which call makes a turn slow
        except httpx.TimeoutException:
            logger.warning("%s %s timed out after %.0f ms", method, url.split("?")[0], (monotonic() - started) * 1000)
            raise GatewayError(504, "The buyer system did not answer in time. Nothing was changed if this was a write; check before retrying.") from None
        except httpx.HTTPError:
            raise GatewayError(503, "The buyer system could not be reached.") from None
        if resp.status_code == 401:
            raise GatewayError(401, "Your session has expired. Sign in again.")
        if resp.status_code == 403:
            raise GatewayError(403, "You do not have permission to do that in the buyer system.")
        if resp.status_code == 404:
            raise GatewayError(404, _message(resp) or "Not found.")
        if resp.status_code >= 400:
            raise GatewayError(resp.status_code, _message(resp) or f"The buyer system refused the request ({resp.status_code}).")
        if not resp.content:
            return None
        try:
            return resp.json()
        except ValueError:
            return None

    @staticmethod
    def _base(url: str, variable: str) -> str:
        if not url:
            raise GatewayError(503, f"The service address is not configured (set {variable}).")
        return url

    def _b(self, path: str) -> str:
        return f"{self._base(self._s.buyer_url, 'PROCUREIQ_BUYER_URL')}/api/v1/buyer/{path}"

    def _m(self, path: str) -> str:
        return f"{self._base(self._s.masterdata_url, 'PROCUREIQ_MASTERDATA_URL')}/api/v1/masterdata/{path}"

    # -------------------------------------------------------------- reference data
    def profile(self) -> dict[str, Any]:
        data = self._call("GET", self._b("profile"))
        return data if isinstance(data, dict) else {}

    def departments(self) -> list[dict[str, Any]]:
        return _unwrap(self._call("GET", self._b("all-department"), params={"index": 0, "limit": 200}))

    def cost_centers(self, department_id: str | None = None) -> list[dict[str, Any]]:
        # The Buyer API lists cost centers per department; the buyer app calls it as all-costcenter?departmentId=<id>&index=0&limit=40.
        return _unwrap(self._call("GET", self._b("all-costcenter"), params={"departmentId": department_id, "index": 0, "limit": 40}))

    def units(self) -> list[str]:
        rows = _unwrap(self._call("GET", self._m("units"), params={"index": 0, "limit": 200}))
        return [str(r["key"]).upper() for r in rows if r.get("key")]

    def currencies(self) -> list[str]:
        rows = _unwrap(self._call("GET", self._m("currencies"), params={"index": 0, "limit": 100}))
        return [str(r["currencyName"]).upper() for r in rows if r.get("currencyName")]

    def _every_page(self, url: str, params: dict[str, Any], size: int = 100, max_pages: int = 50) -> list[dict[str, Any]]:
        """All rows of a list the Master Data API serves page by page (pageIndex starts at 1). Stops at a short page, or when a page brings nothing new
        (a server that ignores paging would otherwise repeat the same rows)."""
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for page in range(1, max_pages + 1):
            chunk = _unwrap(self._call("GET", url, params={**params, "pageIndex": page, "pageSize": size}))
            fresh = [r for r in chunk if json.dumps(r, sort_keys=True, default=str) not in seen]
            seen.update(json.dumps(r, sort_keys=True, default=str) for r in fresh)
            rows += fresh
            if len(chunk) < size or not fresh:
                break
        return rows

    def segments(self, search: str | None) -> list[dict[str, Any]]:
        return self._every_page(self._m("unspsc/segment"), {"searchTerm": search})

    def families(self, segment: int) -> list[dict[str, Any]]:
        return self._every_page(self._m("unspsc/family"), {"segment": segment})

    def item_master(self, search: str, buyer_id: str | None, index: int = 0, limit: int = 10) -> list[dict[str, Any]]:
        return _unwrap(self._call("GET", self._b("item-master"), params={"index": index, "limit": limit, "searchTerm": search, "buyerId": buyer_id}))

    # -------------------------------------------------------------- suppliers
    def find_suppliers(self, search: str | None, segment: int | None, family: int | None, verified: bool | None, buyer_id: str, limit: int) -> list[dict[str, Any]]:
        body = {"index": 0, "limit": limit, "searchTerm": search, "segment": segment, "family": family, "buyerId": buyer_id,
                "type": None if verified is None else ("VERIFIED" if verified else "UNVERIFIED")}
        return _unwrap(self._call("POST", f"{self._base(self._s.supplier_url, 'PROCUREIQ_SUPPLIER_URL')}/api/v1/supplier/rfq-supplier", json=body))

    def supplier_users(self, organization_id: str) -> list[dict[str, Any]]:
        return _unwrap(self._call("GET", f"{self._base(self._s.identity_url, 'PROCUREIQ_IDENTITY_URL')}/api/v1/identity/organization-user-rfq", params={"organizationId": organization_id}))

    # -------------------------------------------------------------- RFQ lifecycle
    def create_rfq(self, dto: dict[str, Any]) -> dict[str, Any]:
        data = self._call("POST", self._b("createrfq"), json=dto)
        return data if isinstance(data, dict) else {}

    def list_rfqs(self, search: str | None, status: str | None, limit: int) -> list[dict[str, Any]]:
        return _unwrap(self._call("POST", self._b("rfq-master-data"), json={"index": 0, "limit": limit, "search": search, "status": status}))

    def rfq(self, rfq_id: str) -> dict[str, Any]:
        data = self._call("GET", self._b("rfq-by-id"), params={"rfqId": rfq_id})
        return data if isinstance(data, dict) else {}

    def bid_compare(self, rfq_id: str) -> dict[str, Any]:
        data = self._call("GET", self._b("bid-compare"), params={"rfqId": rfq_id})
        return data if isinstance(data, dict) else {}

    def set_rfq_status(self, rfq_id: str, status: str) -> None:
        self._call("PUT", self._b("rfq-status"), json={"rfqId": rfq_id, "status": status})

    def award(self, dto: dict[str, Any]) -> dict[str, Any]:
        data = self._call("POST", self._b("rfq-award"), json=dto)
        return data if isinstance(data, dict) else {}

    def unaward(self, rfq_id: str) -> None:
        self._call("PUT", self._b("rfq-award/unaward"), json={"rfqId": rfq_id})

    def create_contract(self, dto: dict[str, Any]) -> dict[str, Any]:
        data = self._call("POST", self._b("predefined-contract"), json=dto)
        return data if isinstance(data, dict) else {}

    def purchase_orders(self, limit: int) -> list[dict[str, Any]]:
        return _unwrap(self._call("GET", self._b("purchase-orders"), params={"index": 0, "limit": limit}))


# ============================================================================
# Creating an RFQ by conversation, as a buyer would fill the form by hand.
# ============================================================================

SUPPLIER_LIST_LIMIT = 100  # suppliers shown in the invitation question
MAX_OPTIONS = 8


@dataclass
class FlowReply:
    text: str
    suggestions: list[str] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)
    awaiting: str | None = None
    needs_confirmation: bool = False
    data: dict[str, Any] = field(default_factory=dict)
    done: bool = False


def _g(d: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """First present key (the services answer camelCase; PascalCase is accepted too)."""
    for k in keys:
        if d.get(k) is not None:
            return d[k]
        alt = k[:1].upper() + k[1:]
        if d.get(alt) is not None:
            return d[alt]
    return default


def _fmt_qty(q: float | None, uom: str | None) -> str:
    return "?" if q is None else f"{q:g} {uom or ''}".strip()


def _option_line(c: dict[str, Any]) -> str:
    """An item-master entry as the customer sees it: its name, then its code and material group."""
    details = "; ".join(x for x in (f"code {c['code']}" if c.get("code") else "no code", f"group {c['group']}" if c.get("group") else "") if x)
    return f"{c['description']} ({details})"


def collect_material_groups(gw: BuyerGateway, buyer_id: str | None) -> dict[str, tuple[int, str | None]]:
    """Every material group of the buyer's item master with its number of entries and one example item. The Buyer API has no list of groups, so they
    are read from the item-master entries, page by page (at most 10,000 entries)."""
    seen: dict[str, tuple[int, str | None]] = {}
    page, size = 0, 200
    while page < 50:
        rows = gw.item_master("", buyer_id, page, size)
        for r in rows:
            g = str(r.get("materialGroup") or "").strip()
            if g:
                count, example = seen.get(g, (0, r.get("description")))
                seen[g] = (count + 1, example)
        if len(rows) < size:
            break
        page += 1
    return seen


def collect_item_master(gw: BuyerGateway, buyer_id: str | None) -> list[dict[str, str]]:
    """Every entry of the buyer's item master as {code, group, description}, page by page (at most 10,000 entries), sorted by description."""
    out: list[dict[str, str]] = []
    page, size = 0, 200
    while page < 50:
        rows = gw.item_master("", buyer_id, page, size)
        out += [{"code": str(_g(r, "materialCode", default="")), "group": str(_g(r, "materialGroup", default="")), "description": str(_g(r, "description", default=""))}
                for r in rows if _g(r, "description")]
        if len(rows) < size:
            break
        page += 1
    return sorted(out, key=lambda e: e["description"].lower())


SHARED_TTL_SECONDS = 600
_SHARED: dict[tuple[str, str], tuple[float, Any]] = {}


class RefData:
    """Reference data of one buyer, fetched on first use and kept for one request."""

    def __init__(self, gw: BuyerGateway, buyer_id: str | None = None) -> None:
        self.gw = gw
        self._buyer_id = buyer_id  # known from the login (token-claim), so no profile call is needed just for the id
        self._cache: dict[str, Any] = {}

    def _once(self, key: str, fn: Callable[[], Any], shared: str | None = None) -> Any:
        """Fetched once per request. With `shared` (a scope: "static" for lists every buyer sees, else the buyer id) and a gateway that allows it, the list is also
        kept between requests for a few minutes: the classification and the item master change rarely and each turn of a conversation needs them again."""
        if key not in self._cache:
            if shared and getattr(self.gw, "shared_cache", False):
                hit = _SHARED.get((shared, key))
                if hit is None or monotonic() - hit[0] > SHARED_TTL_SECONDS:
                    hit = (monotonic(), fn())
                    _SHARED[(shared, key)] = hit
                self._cache[key] = hit[1]
            else:
                self._cache[key] = fn()
        return self._cache[key]

    def segments(self, search: str | None) -> list[dict[str, Any]]:
        return self._once(f"segments:{search}", lambda: self.gw.segments(search), shared="static")

    def families(self, segment: int) -> list[dict[str, Any]]:
        return self._once(f"families:{segment}", lambda: self.gw.families(segment), shared="static")

    @property
    def profile(self) -> dict[str, Any]:
        p = self._once("profile", self.gw.profile)
        return p.get("organization", p) if isinstance(p, dict) else {}

    @property
    def buyer_id(self) -> str | None:
        if self._buyer_id:
            return self._buyer_id
        v = _g(self.profile, "id")
        return str(v) if v else None

    @property
    def locations(self) -> list[dict[str, Any]]:
        return [x for x in (_g(self.profile, "dispatchLocations", default=[]) or []) if isinstance(x, dict)]

    @property
    def categories(self) -> list[dict[str, Any]]:
        return [x for x in (_g(self.profile, "categories", default=[]) or []) if isinstance(x, dict)]

    @property
    def material_groups(self) -> list[str]:
        """The material groups of the item master; empty when they cannot be read (then a typed group is accepted as it is)."""
        def load() -> list[str]:
            try:
                return sorted(collect_material_groups(self.gw, self.buyer_id))
            except GatewayError:
                return []
        return self._once("material_groups", load, shared=self._buyer_id)

    @property
    def units(self) -> list[str]:
        return self._once("units", self.gw.units, shared="static")

    @property
    def currencies(self) -> list[str]:
        return self._once("currencies", self.gw.currencies, shared="static")

    @property
    def departments(self) -> list[dict[str, Any]]:
        return self._once("departments", self.gw.departments)

    def cost_centers_of(self, department_id: str | None) -> list[dict[str, Any]]:
        """The cost centers of one department. Without a department id (a department typed by hand) there is nothing to look up."""
        if not department_id:
            return []
        return self._once(f"cost_centers:{department_id}", lambda: self.gw.cost_centers(department_id))


def location_text(loc: dict[str, Any]) -> str:
    parts = [_g(loc, "locationName"), _g(loc, "addressLine1"), _g(loc, "city"), _g(loc, "country")]
    return ", ".join(str(p) for p in parts if p)


# Words that point to a UNSPSC segment search term, used only to suggest candidates; the buyer picks.
CATEGORY_HINTS: dict[str, set[str]] = {
    "food": {"meat", "chicken", "poultry", "mutton", "beef", "lamb", "shrimp", "fish", "seafood", "rice", "sugar", "flour", "oil", "milk", "dairy",
             "cheese", "egg", "eggs", "vegetable", "vegetables", "fruit", "fruits", "bread", "spice", "spices", "coffee", "tea", "juice", "water", "frozen", "fresh"},
    "cleaning": {"detergent", "cleaner", "soap", "sanitizer", "mop", "bleach", "disinfectant"},
    "office": {"stationery", "paper", "pen", "pens", "printer", "toner", "folder"},
    "packaging": {"packaging", "box", "bag", "bags", "container", "containers", "wrap"},
    "textile": {"linen", "towel", "towels", "uniform", "uniforms", "bedding", "fabric"},
}


# Everyday words mapped to the words UNSPSC family titles use, so "shrimp" can find "Fish and seafood". Only used to rank suggestions.
SYNONYMS: dict[str, set[str]] = {
    "shrimp": {"seafood", "fish"}, "prawn": {"seafood", "fish"}, "prawns": {"seafood", "fish"}, "salmon": {"seafood", "fish"}, "tuna": {"seafood", "fish"},
    "fish": {"seafood"}, "crab": {"seafood"}, "chicken": {"poultry", "meat"}, "turkey": {"poultry", "meat"}, "duck": {"poultry", "meat"},
    "mutton": {"meat"}, "lamb": {"meat"}, "beef": {"meat"}, "veal": {"meat"}, "egg": {"eggs", "dairy"}, "eggs": {"eggs", "dairy"},
    "milk": {"dairy"}, "cheese": {"dairy"}, "butter": {"dairy"}, "yogurt": {"dairy"}, "rice": {"cereal", "grain"}, "flour": {"cereal", "grain"},
}


# Words that say nothing about the kind of goods; they must not make a category look like a match ("products" is in half the UNSPSC titles).
GENERIC_WORDS = {"product", "products", "item", "items", "regular", "operation", "operations", "hotel", "restaurant", "supply", "supplies", "fresh", "frozen",
                 "service", "services", "general", "other", "and", "for", "the"}


# What a buyer can state in the first message, as "<label> <value>": "department DEPT1, deliver to Sigtam, Sikkim, bidding closes in 3 days, delivery in
# 10 days, budget 2000, category Food, sub-category Meat, supplier IBM Technologies Pvt Ltd". The value runs to the next label.
_LABELS: list[tuple[str, str]] = [
    ("group", r"(?:material\s+)?group"),
    ("code", r"(?:material\s+)?code"),
    ("department", r"department|dept"),
    ("delivery_date", r"(?:(?:it\s+)?(?:has|have|needs?)\s+to\s+(?:be\s+)?deliver(?:ed)?|deliver(?:y|ed)?|needed|required)(?=\s+(?:in|by|on|within|before)\b)|delivery\s+date"),
    ("location", r"deliver(?:y|ed)?\s+(?:location|address)|deliver(?:y|ed)?\s+(?:to|at)|ship(?:ped)?\s+to"),
    ("end_date", r"(?:bidding\s+)?(?:closes?|closing|ends?|deadline)"),
    ("budget", r"budget"),
    ("subcategory", r"sub-?\s*categor(?:y|ies)"),
    ("category", r"categor(?:y|ies)"),
    ("supplier", r"suppliers?|vendors?"),
]
_LABEL_RE = [(name, re.compile(rf"(?<![\w-])(?:{pattern})(?![\w-])", re.I)) for name, pattern in _LABELS]


def read_labelled(message: str) -> tuple[str, list[tuple[str, str, int]]]:
    """(the part of the message that names the items, [(label, value, position of the label)]). No labels: the whole message and an empty list."""
    found: list[tuple[int, int, str]] = []
    for name, rx in _LABEL_RE:
        found += [(m.start(), m.end(), name) for m in rx.finditer(message)]
    found.sort(key=lambda x: (x[0], -(x[1] - x[0])))
    marks: list[tuple[int, int, str]] = []
    for a, b, name in found:
        if not marks or a >= marks[-1][1]:
            marks.append((a, b, name))
    if not marks:
        return message, []
    values: list[tuple[str, str, int]] = []
    first_other = next((a for a, _, n in marks if n not in ("group", "code")), len(message))
    item_text, cursor = "", 0
    for k, (a, b, name) in enumerate(marks):
        stop = marks[k + 1][0] if k + 1 < len(marks) else len(message)
        if name in ("group", "code") and a < first_other:  # "chicken 20 kg, material group POULTRY": the group is not part of the item
            item_text += message[cursor:a]
            cursor = stop
        value = re.sub(r"^[\s:=\-]+|[\s,;.]+$", "", message[b:stop])
        value = re.sub(r"\s+(?:and|with|then|also)$", "", value, flags=re.I).strip()
        if value:
            values.append((name, value, a))
    item_text += message[cursor:first_other] if cursor < first_other else ""
    return item_text, values


class RfqFlow:
    def __init__(self, gw: BuyerGateway, now: datetime, persist: Callable[[RfqDraft], None] | None = None) -> None:
        self.gw = gw
        self.ref = RefData(gw)
        self.now = now
        self.today = now.date()
        self._persist = persist or (lambda d: None)
        self.settings = procureiq_settings

    # ================================================================ entry points
    def start(self, message: str) -> tuple[RfqDraft, FlowReply]:
        d = RfqDraft()
        item_text, labelled = read_labelled(message)
        purpose, names = parse_request(item_text if labelled else message)
        d.purpose = purpose
        for n in names:
            name, qty, uom = item_inline_qty(n)
            d.items.append(DraftItem(name=name, quantity=qty, uom=uom))
        self._apply_labelled(d, labelled, message)
        self._opportunistic(d, message)
        d.start_date = self.now.isoformat()
        intro = "I'll set up the RFQ here and only send it once you confirm."
        if d.items:
            intro += f" I understood {len(d.items)} item(s): " + ", ".join(i.name for i in d.items) + "."
        d.notes.append(intro)
        return d, self.advance(d)

    def handle(self, d: RfqDraft, message: str) -> FlowReply:
        if d.stage == "sending":
            return FlowReply("This RFQ is already being sent. Please wait a moment and ask me to show your RFQs.", awaiting=None)
        if d.stage == "done":
            return FlowReply("That RFQ was already sent.")
        if d.awaiting != "item_match":  # (the item-master question reads these itself)
            rest, note, bad = self._take_assignments(d, message, strict=True)
            if note or bad:
                if note:
                    d.notes.append(note)
                if not rest.strip():
                    if d.awaiting == "confirm":
                        r = self._summary(d)
                        r.text = (bad + "\n\n" if bad else "") + r.text
                        return self._finish(d, r)
                    d.awaiting = None
                    return self._ask_again(d, bad) if bad else self.advance(d)
                message = rest
        if d.awaiting == "confirm":
            return self._review_reply(d, message)
        problem = self._consume(d, message)
        d.awaiting = None  # answered; advance() sets the next question. If a service fails meanwhile, the next message simply retries
        if problem:
            return self._ask_again(d, problem)
        return self.advance(d)

    # ================================================================ the question loop
    def advance(self, d: RfqDraft) -> FlowReply:
        for step in (self._s_items, self._s_quantities, self._s_item_master, self._s_location, self._s_department, self._s_currency,
                     self._s_region, self._s_end_date, self._s_delivery_date, self._s_budget, self._s_category, self._s_suppliers, self._s_questions):
            r = step(d)
            if r is not None:
                return self._finish(d, r)
        return self._finish(d, self._summary(d))

    def _finish(self, d: RfqDraft, r: FlowReply) -> FlowReply:
        if d.notes:
            r.text = "\n".join(d.notes) + "\n\n" + r.text
            d.notes = []
        d.awaiting = r.awaiting
        r.data.setdefault("stage", d.stage)
        self._persist(d)
        return r

    def _ask_again(self, d: RfqDraft, problem: str) -> FlowReply:
        r = self.advance(d)
        r.text = problem + "\n\n" + r.text
        return r

    def _ask(self, d: RfqDraft, awaiting: str, text: str, suggestions: list[str] | None = None, options: list[dict[str, Any]] | None = None) -> FlowReply:
        d.options = options or []
        return FlowReply(text, suggestions or [], awaiting=awaiting)

    # ================================================================ slots (each returns a question, or None when satisfied)
    def _s_items(self, d: RfqDraft) -> FlowReply | None:
        if d.items:
            return None
        return self._ask(d, "items", "Which items should this RFQ cover? List them, for example: chicken, shrimp, frozen mutton.")

    def _s_quantities(self, d: RfqDraft) -> FlowReply | None:
        if d.pending_bare:
            q, u = d.pending_bare
            n = len([i for i in d.items if i.quantity is None])
            return self._ask(d, "bare_qty", f"Do you want {q:g} {u} for each of the {n} items that have no quantity yet? (yes/no)", ["Yes", "No"])
        missing = [i for i, it in enumerate(d.items) if it.quantity is None or not it.uom]
        if not missing:
            return None
        lines = "\n".join(f"• {d.items[i].name}" for i in missing)
        return self._ask(
            d, "quantities",
            f"How much of each do you need? I still need a quantity and unit for:\n{lines}\n\nReply like “chicken 50 kg, shrimp 20 kg”, or “20 kg each” to use one amount for all.")

    def _s_item_master(self, d: RfqDraft) -> FlowReply | None:
        """Look every item up in the buyer's item master. Clear matches are applied, missing ones become free text, and ALL items that have
        several candidates are put to the buyer in one question, so five ambiguous items do not mean five separate questions."""
        ambiguous: list[DraftItem] = []
        for it in d.items:
            if it.resolved:
                continue
            if not it.candidates:  # not looked up yet (a partly answered batch keeps the candidates it already fetched)
                buyer_id = self.ref.buyer_id  # a failure here (or in the lookup below) stops the turn; the draft is kept and the next message retries
                try:
                    found = self.gw.item_master(it.name, buyer_id)
                except GatewayError as e:
                    if e.status not in (403, 404):
                        raise  # a timeout or outage must not silently turn items into free text
                    it.resolved = True  # this buyer may not read the item master: the RFQ can still use free text
                    d.notes.append(f"I cannot look up “{it.name}” in your item master ({e.message}), so it will go as free text.")
                    continue
                cands = [{"code": str(_g(c, "materialCode", default="")), "group": str(_g(c, "materialGroup", default="")),
                          "description": str(_g(c, "description", default=""))} for c in found if _g(c, "description")]
                if it.material_group or it.material_code:  # the message named the group or code: that picks the entry
                    named = [c for c in cands if (not it.material_code or c["code"].lower() == it.material_code.lower())
                             and (not it.material_group or c["group"].lower() == it.material_group.lower())]
                    if len(named) == 1:
                        self._apply_match(it, named[0])
                        d.notes.append(f"“{it.name}”: {it.matched_description} ({it.material_code}), group {it.material_group}.")
                        continue
                    if named:
                        cands = named
                    else:
                        it.resolved = True
                        d.notes.append(f"Nothing in your item master has the group or code you gave for “{it.name}”, so it will be requested as free text with that group or code.")
                        continue
                exact = [c for c in cands if set(tokens(c["description"])) == set(tokens(it.name))]
                if len(exact) == 1 or len(cands) == 1:
                    self._apply_match(it, (exact or cands)[0])
                    d.notes.append(f"“{it.name}” matches your item master entry “{it.matched_description}” ({it.material_code}).")
                    continue
                if not cands:
                    it.resolved = True
                    d.notes.append(f"“{it.name}” is not in your item master, so it will be requested as free text.")
                    continue
                it.candidates = cands[:5]
            ambiguous.append(it)
        if not ambiguous:
            return None

        table = self._item_table(d)
        if len(ambiguous) == 1:
            it = ambiguous[0]
            lines = "\n".join(f"• {_option_line(c)}" for c in it.candidates)
            text = (f"For “{it.name}” your item master has several matching entries. Which one do you mean?\n{lines}\n"
                    f"• None of these: request “{it.name}” as free text\n\n"
                    f"Tell me the item name, for example “{it.candidates[0]['description']}”, or say “free text”.")
            r = self._ask(d, "item_match", text, [c["description"] for c in it.candidates] + ["Free text"])
            r.data["item_table"] = table
            return r
        blocks = []
        for n, it in enumerate(ambiguous):
            lines = "\n".join(f"• {_option_line(c)}" for c in it.candidates)
            blocks.append(f"**{it.name}**\n{lines}\n• None of these: request “{it.name}” as free text")
        example = "; ".join(f"{it.name}: {it.candidates[0]['description']}" for it in ambiguous[:2])
        text = ("Your item master has several entries for these items. Which one do you mean for each?\n\n" + "\n\n".join(blocks) +
                f"\n\nTell me the item and the entry you want, for example “{example}”. "
                "Say “first option for all” to take the first entry of each, or “free text for all” to skip matching. "
                "A free-text item can also be given its code or material group: “chicken 5x5 cubes code CHK-100002; frozen mutton group Meat & Poultry”.")
        r = self._ask(d, "item_match", text, ["First option for all", "Free text for all"])
        r.data["item_table"] = table
        return r

    def _item_table(self, d: RfqDraft) -> dict[str, Any]:
        """The items of the draft as rows a screen can show: the group each will use, and for items still to be decided the entries it suggests.
        Any row can be given any entry of the item master (GET /chat/item-master). `notes` are what the bot says about items it settled by itself;
        a screen that shows the table can show these instead of the long question."""
        rows = []
        for it in d.items:
            open_item = not it.resolved and bool(it.candidates)
            rows.append({
                "name": it.name, "quantity": it.quantity, "uom": it.uom,
                "state": "choose" if open_item else "matched" if it.matched_description else "free_text",
                "code": it.material_code, "group": it.material_group, "description": it.matched_description,
                "candidates": list(it.candidates) if open_item else [],
            })
        return {"rows": rows, "notes": list(d.notes)}

    def apply_item_choices(self, d: RfqDraft, choices: list["ItemChoice"]) -> FlowReply:
        """The answer of the item table: for each item an entry of the item master (by its code) or free text. The entry's description, code and group
        replace what the buyer typed, and it is that description that goes on the RFQ."""
        by_code: dict[str, dict[str, str]] | None = None
        for ch in choices:
            it = next((i for i in d.items if i.name.lower() == ch.item.strip().lower()), None)
            if it is None:
                d.notes.append(f"There is no item “{ch.item}” in this RFQ.")
                continue
            if not ch.code:
                it.resolved, it.candidates = True, []
                it.material_code = it.material_group = it.matched_description = None
                continue
            if by_code is None:
                by_code = {e["code"]: e for e in collect_item_master(self.gw, self.ref.buyer_id)}
            entry = by_code.get(ch.code)
            if entry is None:
                d.notes.append(f"“{ch.code}” is not in your item master, so “{it.name}” was left as it was.")
                continue
            self._apply_match(it, entry)
        d.awaiting = None
        return self.advance(d)

    @staticmethod
    def _apply_match(it: DraftItem, c: dict[str, Any]) -> None:
        it.material_code, it.material_group, it.matched_description, it.resolved = c["code"] or None, c["group"] or None, c["description"], True
        it.candidates = []

    def _s_location(self, d: RfqDraft) -> FlowReply | None:
        if d.delivery_location:
            return None
        locs = self.ref.locations
        if len(locs) == 1:
            d.delivery_location = location_text(locs[0])
            d.notes.append(f"Delivery location: {d.delivery_location} (your only delivery address).")
            return None
        if not locs:
            return self._ask(d, "location", "Where should the goods be delivered? Type the delivery address (your profile has none saved).")
        opts = [{"text": location_text(x), "default": bool(_g(x, "isDefault"))} for x in locs[:MAX_OPTIONS]]
        lines = "\n".join(f"• {o['text']}{'  (default)' if o['default'] else ''}" for o in opts)
        return self._ask(d, "location", f"Which delivery location should the goods be sent to?\n{lines}\n\nTell me the address you want, or type a different one.", [o["text"] for o in opts], opts)

    def _s_department(self, d: RfqDraft) -> FlowReply | None:
        if not d.department:
            deps = self.ref.departments
            if len(deps) == 1:
                d.department, d.department_id = str(_g(deps[0], "department")), str(_g(deps[0], "id"))
                d.notes.append(f"Department: {d.department} (the only one set up).")
            elif not deps:
                return self._ask(d, "department", "Which department is this RFQ for? (No departments are set up for you, so type it.)")
            else:
                opts = [{"name": str(_g(x, "department")), "id": str(_g(x, "id"))} for x in deps[:MAX_OPTIONS]]
                lines = "\n".join(f"• {o['name']}" for o in opts)
                return self._ask(d, "department", f"Which department is this RFQ for?\n{lines}\n\nTell me the department name.", [o["name"] for o in opts], opts)
        if not d.cost_center:
            ccs = [c for c in self.ref.cost_centers_of(d.department_id) if not _g(c, "departmentId") or str(_g(c, "departmentId")) == d.department_id]
            if len(ccs) == 1:
                d.cost_center = str(_g(ccs[0], "costCenter"))
                d.notes.append(f"Cost center: {d.cost_center} (the only one for {d.department}).")
            elif not ccs:
                return self._ask(d, "cost_center", f"Which cost center should {d.department} be charged to? Type it.")
            else:
                opts = [{"name": str(_g(x, "costCenter"))} for x in ccs[:MAX_OPTIONS]]
                lines = "\n".join(f"• {o['name']}" for o in opts)
                return self._ask(d, "cost_center", f"Which cost center of {d.department} should be charged?\n{lines}\n\nTell me the cost center name.", [o["name"] for o in opts], opts)
        return None

    def _s_currency(self, d: RfqDraft) -> FlowReply | None:
        if d.currency:
            return None
        allowed = self.ref.currencies
        prof = str(_g(_g(self.ref.profile, "businessProfile", default={}) or {}, "currency", default="") or "").upper()
        if prof and (not allowed or prof in allowed):
            d.currency = prof
            d.notes.append(f"Currency: {prof} (from your company profile).")
            return None
        opts = [{"code": c} for c in allowed[:MAX_OPTIONS]]
        return self._ask(d, "currency", "Which currency should suppliers quote in?" + (f" Options: {', '.join(allowed)}." if allowed else ""), allowed[:MAX_OPTIONS], opts)

    def _s_region(self, d: RfqDraft) -> FlowReply | None:
        if d.region:
            return None
        prof = _g(self.ref.profile, "businessProfile", default={}) or {}
        region = _g(prof, "country") or _g(prof, "state")
        if region:
            d.region = str(region)
            d.notes.append(f"Region: {d.region} (from your company profile).")
            return None
        return self._ask(d, "region", "Which region or country is this RFQ for?")

    def _s_end_date(self, d: RfqDraft) -> FlowReply | None:
        if d.end_date:
            return None
        return self._ask(d, "end_date", "When should bidding close? For example “in 5 days” or “25 Oct”.", ["In 3 days", "In 7 days", "In 14 days"])

    def _s_delivery_date(self, d: RfqDraft) -> FlowReply | None:
        if d.delivery_target_date:
            return None
        return self._ask(d, "delivery_date", f"By when do you need the goods delivered? (Bidding closes {d.end_date[:10]}.) For example “in 3 weeks” or “15 Nov”.")

    def _s_budget(self, d: RfqDraft) -> FlowReply | None:
        if d.budget is not None:
            return None
        return self._ask(d, "budget", f"What is the budget in {d.currency}? Say “no budget” if there is none.", ["No budget"])

    # ---- category
    def _s_category(self, d: RfqDraft) -> FlowReply | None:
        if d.category_decided:
            return None
        if d.segment_id is None:
            cands = self._segment_candidates(d)
            if not cands:
                d.category_decided = True
                d.notes.append("I could not find a category for these items, so I will not filter suppliers by category.")
                return None
            likely = [c for c in cands if not c.get("other")]
            wanted, d.wanted_category = d.wanted_category, None
            at = pick_by_name(wanted, [str(c["title"]) for c in cands]) if wanted else None
            if wanted and at is None:
                at = self._close_title(wanted, [str(c["title"]) for c in cands])
            if at is not None:
                self._set_segment(d, cands[at])
                d.notes.append(f"Category: {cands[at]['title']}.")
            elif wanted:
                d.notes.append(f"I could not find the category “{wanted}”.")
            if d.segment_id is not None:
                pass
            elif len(cands) == 1 and self._plausible_segment(d, cands[0]):
                self._set_segment(d, cands[0])
                d.notes.append(f"Category: {cands[0]['title']} (the only match).")
            else:
                lines = "\n".join(f"• {c['title']}" for c in likely)
                rest = "\n".join(f"• {c['title']}" for c in cands if c.get("other"))
                shown = (lines + ("\n\nAll other categories:\n" if lines else "") + rest) if rest else lines
                return self._ask(d, "segment", f"Which category fits these items? It decides which suppliers I suggest.\n{shown}\n\nTell me the category name, or say “skip” to choose suppliers without a category.",
                                 [c["title"] for c in (likely or cands)[:8]] + ["Skip"], cands)
        if d.family_id is None and not d.category_decided:
            fams = self._family_candidates(d)
            if not fams:
                d.category_decided = True
                return None
            wanted, d.wanted_family = d.wanted_family, None
            at = pick_by_name(wanted, [f["title"] for f in fams]) if wanted else None
            if wanted and at is None:
                at = self._close_title(wanted, [f["title"] for f in fams])
            if at is not None:
                d.family_id, d.family_title, d.category_decided = fams[at]["family"], fams[at]["title"], True
                d.notes.append(f"Sub-category: {d.family_title}.")
                return None
            if wanted:
                d.notes.append(f"I could not find the sub-category “{wanted}” in {d.segment_title}.")
            best = self._rank_families(d, fams)
            if len(best) == 1:
                d.family_id, d.family_title = best[0]["family"], best[0]["title"]
                d.category_decided = True
                d.notes.append(f"Sub-category: {d.family_title}.")
                return None
            others = [f for f in fams if f not in best]
            show = best + others  # every sub-category, the likely ones first
            lines = "\n".join(f"• {c['title']}" for c in best)
            rest = "\n".join(f"• {c['title']}" for c in others)
            shown = (lines + ("\n\nAll other sub-categories:\n" if lines else "") + rest) if rest else lines
            return self._ask(d, "family", f"Which sub-category of {d.segment_title} fits best?\n{shown}\n\nTell me the sub-category name, or say “skip” to use the whole category.",
                             [c["title"] for c in (best or show)[:8]] + ["Skip"], show)
        d.category_decided = True
        return None

    @staticmethod
    def _close_title(wanted: str, titles: list[str]) -> int | None:
        """The one title that is clearly what was meant by a loosely typed name, or None."""
        lowered = [t.lower() for t in titles]
        close = difflib.get_close_matches(wanted.lower(), lowered, n=2, cutoff=0.75)
        return lowered.index(close[0]) if len(close) == 1 else None

    def _keywords(self, d: RfqDraft) -> set[str]:
        return {t for i in d.items for t in tokens(i.name)} | set(tokens(d.purpose or ""))

    def _segment_candidates(self, d: RfqDraft) -> list[dict[str, Any]]:
        cands: dict[int, dict[str, Any]] = {}
        for c in self.ref.categories:
            seg = _g(c, "segment")
            if seg:
                cands.setdefault(int(seg), {"segment": int(seg), "title": str(_g(c, "segmentTitle", default=f"Segment {seg}"))})
        kws = self._keywords(d)
        for term, words in CATEGORY_HINTS.items():
            if kws & words:
                try:
                    for s in self.ref.segments(term):
                        seg = _g(s, "segment")
                        if seg is not None:
                            cands.setdefault(int(seg), {"segment": int(seg), "title": str(_g(s, "title", default=f"Segment {seg}"))})["families"] = _g(s, "family", default=[])
                except GatewayError:
                    pass
        try:  # every category of the classification, after the likely ones
            for s in self.ref.segments(None):
                seg = _g(s, "segment")
                if seg is not None and int(seg) not in cands:
                    cands[int(seg)] = {"segment": int(seg), "title": str(_g(s, "title", default=f"Segment {seg}")), "other": True}
        except GatewayError:
            pass
        return sorted(cands.values(), key=lambda c: (bool(c.get("other")), str(c["title"]).lower() if c.get("other") else ""))

    def _plausible_segment(self, d: RfqDraft, c: dict[str, Any]) -> bool:
        """A segment found by searching for the items is trusted. One that is only on the buyer's profile must also share a word with the items, or the buyer picks."""
        if "families" in c:
            return True
        kws = self._keywords(d)
        kws |= {s for w in list(kws) for s in SYNONYMS.get(w, set())}
        return bool((kws - GENERIC_WORDS) & (set(tokens(c["title"])) - GENERIC_WORDS))

    def _set_segment(self, d: RfqDraft, c: dict[str, Any]) -> None:
        d.segment_id, d.segment_title = int(c["segment"]), str(c["title"])

    def _family_candidates(self, d: RfqDraft) -> list[dict[str, Any]]:
        try:
            rows = self.ref.families(d.segment_id or 0)
        except GatewayError:
            return []
        out = [{"family": int(_g(r, "family")), "title": str(_g(r, "title", default=""))} for r in rows if _g(r, "family") is not None]
        return out

    def _rank_families(self, d: RfqDraft, fams: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Every family that plausibly fits, best first. More than one means the items span sub-categories, so the buyer chooses."""
        kws = self._keywords(d)
        kws |= {s for w in list(kws) for s in SYNONYMS.get(w, set())}
        kws -= GENERIC_WORDS
        scored = sorted(((len(kws & (set(tokens(f["title"])) - GENERIC_WORDS)), f) for f in fams), key=lambda x: -x[0])
        return [f for s, f in scored if s > 0]

    # ---- suppliers
    def _s_suppliers(self, d: RfqDraft) -> FlowReply | None:
        if d.suppliers_decided:
            return None
        try:
            cands = self.gw.find_suppliers(None, d.segment_id, d.family_id, None, self.ref.buyer_id or "", SUPPLIER_LIST_LIMIT)
            scope = d.family_title or d.segment_title
            if not cands and d.family_id:
                cands = self.gw.find_suppliers(None, d.segment_id, None, None, self.ref.buyer_id or "", SUPPLIER_LIST_LIMIT)
                scope = d.segment_title
            if not cands and d.segment_id:
                cands = self.gw.find_suppliers(None, None, None, None, self.ref.buyer_id or "", SUPPLIER_LIST_LIMIT)
                scope = None
        except GatewayError as e:
            return self._ask(d, "suppliers", f"I could not load suppliers ({e.message}). You can still invite someone by e-mail: “external Acme Foods acme@example.com”, or say “skip”.")
        opts = [{"supplier_id": str(_g(c, "supplierId")), "organization_id": str(_g(c, "organizationId")), "name": str(_g(c, "supplierName", default="?")),
                 "verified": bool(_g(c, "isVerified", default=True))} for c in cands]
        opts.sort(key=lambda o: (not o["verified"], o["name"].lower()))  # verified suppliers first
        if d.wanted_suppliers:  # named in the first message: found among these, or by searching all suppliers
            wanted, d.wanted_suppliers = d.wanted_suppliers, []
            chosen: list[str] = []
            for name in wanted:
                at = pick_by_name(name, [o["name"] for o in opts]) if opts else None
                if at is None:
                    try:
                        more = self.gw.find_suppliers(name, None, None, None, self.ref.buyer_id or "", 5)
                    except GatewayError:
                        more = []
                    extra = [{"supplier_id": str(_g(c, "supplierId")), "organization_id": str(_g(c, "organizationId")), "name": str(_g(c, "supplierName", default="?")),
                              "verified": bool(_g(c, "isVerified", default=True))} for c in more]
                    hit = pick_by_name(name, [o["name"] for o in extra]) if extra else None
                    if hit is not None:
                        if not any(o["supplier_id"] == extra[hit]["supplier_id"] for o in opts):
                            opts.append(extra[hit])
                        at = next(i for i, o in enumerate(opts) if o["supplier_id"] == extra[hit]["supplier_id"])
                if at is None:
                    d.notes.append(f"I could not find the supplier “{name}”.")
                else:
                    chosen.append(opts[at]["name"])
            if chosen:
                d.options = opts
                problem = self._c_suppliers(d, "; ".join(chosen))
                if problem:
                    d.notes.append(problem)
                if d.suppliers_decided:
                    d.notes.append("Suppliers: " + ", ".join(p.name for p in d.picked) + ".")
                    return None
        if not opts:
            return self._ask(d, "suppliers", "I found no suppliers to suggest. Invite someone by e-mail: “external Acme Foods acme@example.com”, or say “skip” to send to no one yet.")
        lines = "\n".join(f"• {o['name']}" + (" (verified)" if o["verified"] else "") for o in opts)
        head = f"Which suppliers should receive this RFQ? These are the suppliers{f' for {scope}' if scope else ''}:"
        return self._ask(d, "suppliers", f"{head}\n{lines}\n\nTell me the supplier name or names (for example “{opts[0]['name']}”), or say “all” to invite every supplier listed. "
                         "To invite a supplier that is not listed, say “external <name> <e-mail>” (for example “external Acme Foods acme@example.com”). Say “skip” to invite no one yet.",
                         [o["name"] for o in opts[:8]] + ["All", "Skip"], opts)

    def _s_questions(self, d: RfqDraft) -> FlowReply | None:
        if d.questions_decided:
            return None
        return self._ask(d, "questions", "Do you want to ask suppliers any questions with their quote (for example certifications)? Type them, one per line, or say “none”.",
                         ["None", "Ask for halal and food-safety (HACCP) certificates"])

    # ================================================================ reading the user's answer
    def _consume(self, d: RfqDraft, message: str) -> str | None:
        """Apply the answer to the question that was asked. Returns a problem text when it could not be used."""
        a, m = d.awaiting, message.strip()
        fn = getattr(self, f"_c_{a}", None)
        return fn(d, m) if fn else None

    def _c_items(self, d: RfqDraft, m: str) -> str | None:
        names = split_list(m)
        if not names:
            return "I did not catch any items."
        for n in names:
            name, qty, uom = item_inline_qty(n)
            d.items.append(DraftItem(name=name, quantity=qty, uom=uom))
        return None

    def _c_quantities(self, d: RfqDraft, m: str) -> str | None:
        names = [i.name for i in d.items]
        missing = [i for i, it in enumerate(d.items) if it.quantity is None or not it.uom]
        got = parse_quantities(m, names, missing)
        if not got:
            bare = bare_quantity(m)
            if bare and len(missing) > 1:
                d.pending_bare = [bare[0], bare[1]]
                return None
            return "I could not match that to the items. Please give each as “name quantity unit”, for example “shrimp 20 kg”."
        return self._assign_quantities(d, got)

    def _assign_quantities(self, d: RfqDraft, got: dict[int, tuple[float, str]]) -> str | None:
        units = self.ref.units
        bad: list[str] = []
        for i, (q, u) in got.items():
            if q <= 0:
                bad.append(f"{d.items[i].name}: quantity must be more than zero")
            elif units and u not in units:
                bad.append(f"{d.items[i].name}: unit {u} is not in your unit list")
            else:
                d.items[i].quantity, d.items[i].uom = q, u
        return ("Some quantities were not used: " + "; ".join(bad) + ". " + (f"Available units include: {', '.join(units[:12])}." if units else "")) if bad else None

    def _c_bare_qty(self, d: RfqDraft, m: str) -> str | None:
        pending, d.pending_bare = d.pending_bare, None
        if pending and is_confirm(m) or (pending and re.fullmatch(r"\s*(yes|y|yeah|yep)\W*", m.lower())):
            missing = [i for i, it in enumerate(d.items) if it.quantity is None or not it.uom]
            return self._assign_quantities(d, {i: (pending[0], pending[1]) for i in missing})
        return "Okay, I will not apply it to every item."

    def _c_item_match(self, d: RfqDraft, m: str) -> str | None:
        """The answer to the batched item-master question. Answers that are given are applied; items not answered are asked again."""
        m = self._match_by_name(d, m)  # “chicken: Chicken Drumstick, Bone-In, Fresh; shrimp: free text” (before codes, so a dashed word of an item name is not read as a code)
        m, coded, bad = self._take_assignments(d, m, strict=False)
        coded = " ".join(x for x in (coded, bad) if x) or None
        ambiguous = [it for it in d.items if not it.resolved and it.candidates]
        if not ambiguous:
            return coded
        if coded and not re.search(r"\d|free\s*text|\bnone\b", m):
            return coded  # only codes were given; the other items are asked again
        picks, problems = parse_match_answer(m, [it.name for it in ambiguous], [len(it.candidates) + 1 for it in ambiguous])
        for pos, option in picks.items():
            it = ambiguous[pos]
            if option <= len(it.candidates):
                self._apply_match(it, it.candidates[option - 1])
            else:
                it.resolved, it.candidates = True, []  # the last option: free text
        if not picks and not problems:
            return "I could not tell which entries you mean. Tell me the item name for each, or say “first option for all” or “free text for all”."
        notes = ([coded] if coded else []) + (["; ".join(problems) + "."] if problems else [])
        return " ".join(notes) or None

    @staticmethod
    def _free_text_words(text: str) -> bool:
        return bool(re.fullmatch(r"\s*(?:free ?text|none(?: of these)?|skip|not in (?:the )?(?:item )?master)\W*", text.lower()))

    def _match_by_name(self, d: RfqDraft, m: str) -> str:
        """Apply answers given as names: “<item>: <entry>” for several items, or just the entry's name when only one item is open. Returns what is left of the message."""
        open_items = [it for it in d.items if not it.resolved and it.candidates]
        if not open_items:
            return m

        def choose(it: DraftItem, phrase: str) -> bool:
            phrase = phrase.strip(" ;,.\n")
            if not phrase:
                return False
            if self._free_text_words(phrase):
                it.resolved, it.candidates = True, []
                return True
            codes = [c for c in it.candidates if c["code"] and re.search(rf"(?<![A-Za-z0-9]){re.escape(c['code'])}(?![A-Za-z0-9])", phrase, re.I)]
            same = [c for c in it.candidates if c["description"].lower() == re.sub(r"\s*\([^)]*\)\s*$", "", phrase).strip().lower()]
            if len(codes) != 1 and len(same) > 1:
                d.notes.append(f"Your item master has {len(same)} entries called “{same[0]['description']}”. Add the code of the one you want, for example "
                               f"“{it.name}: {same[0]['description']} ({same[0]['code']})”.")
                return False
            idx = (it.candidates.index(codes[0]) if len(codes) == 1 else pick_by_name(phrase, [c["description"] for c in it.candidates]))
            if idx is None:
                return False
            self._apply_match(it, it.candidates[idx])
            return True

        marks = []
        for it in open_items:
            for mt in re.finditer(rf"(?<![A-Za-z0-9]){re.escape(it.name)}\s*(?:[:=]|\b(?:is|entry|group|code)\b)\s*", m, re.I):
                marks.append((mt.start(), mt.end(), it))
        if marks:
            marks.sort(key=lambda x: x[0])
            cut: list[tuple[int, int]] = []
            for k, (start, end, it) in enumerate(marks):
                stop = marks[k + 1][0] if k + 1 < len(marks) else len(m)
                if choose(it, m[end:stop]):
                    cut.append((start, stop))
            for start, stop in reversed(cut):
                m = m[:start] + " " + m[stop:]
            return m.strip(" ;,\n")
        if len(open_items) == 1 and choose(open_items[0], m):
            return ""
        return m

    def _canonical_group(self, value: str) -> tuple[str, str | None]:
        """(the group as the item master spells it, None) or (value, a problem text) when no such group exists."""
        known = self.ref.material_groups
        if not known:
            return value, None
        for g in known:
            if g.lower() == value.lower():
                return g, None
        close = difflib.get_close_matches(value, known, n=3, cutoff=0.5)
        hint = f" Did you mean: {', '.join(close)}?" if close else ""
        return value, f"There is no material group “{value}” in your item master.{hint} (GET /api/v1/chat/material-groups lists them.)"

    def _take_assignments(self, d: RfqDraft, m: str, strict: bool) -> tuple[str, str | None, str | None]:
        """Pick “<item> group <GROUP>” and “<item> code <CODE>” clauses out of a message and give those values to the items (for free-text items, or to
        override the item master's). With strict=False (while the item-master question is open) a bare upper-case dashed token also counts: “milk SEAFOOD-FROZEN”
        is a group, “chicken 5x5 cubes CHK-100002” a code (it has a digit). Returns (the rest of the message, what was noted, what was refused)."""
        kept: list[str] = []
        done: list[str] = []
        problems: list[str] = []
        names = sorted(d.items, key=lambda i: -len(i.name))
        for clause in re.split(r"[,;\n]+", m):
            low = clause.lower().replace("×", "x")
            it = next((i for i in names if i.name.lower().replace("×", "x") in low), None)
            kw = re.search(r"\b(code|group)\b\s*[:=]?\s*(.+?)\s*$", clause, flags=re.I) if it else None
            dashed = None if (kw or strict or it is None) else re.search(r"(?<![A-Za-z0-9-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)(?![A-Za-z0-9-])", clause)
            if kw:
                kind, value = kw.group(1).lower(), kw.group(2).strip(" .\"'")
            elif dashed:
                kind, value = ("code" if re.search(r"\d", dashed.group(1)) else "group"), dashed.group(1)
            else:
                kept.append(clause)
                continue
            if kind == "code":
                value = value.split()[0] if value else value
            else:
                value, bad = self._canonical_group(value)
                if bad:
                    problems.append(bad)
                    continue
            if not value:
                kept.append(clause)
                continue
            if kind == "code":
                it.material_code = value
            else:
                it.material_group = value
            if not it.matched_description and not it.candidates:
                it.resolved = True
            done.append(f"“{it.name}”: {kind} {value}")
        rest = ", ".join(k.strip() for k in kept if k.strip())
        return rest, (("Noted " + "; ".join(done) + ".") if done else None), (" ".join(problems) or None)

    def _c_location(self, d: RfqDraft, m: str) -> str | None:
        opts = d.options
        if opts:
            picks = parse_choices(m, len(opts))
            if picks:
                d.delivery_location = opts[picks[0]]["text"]
                return None
            if re.search(r"\bdefault\b", m.lower()):
                dflt = next((o for o in opts if o.get("default")), None)
                if dflt:
                    d.delivery_location = dflt["text"]
                    return None
            by_name = pick_by_name(m, [o["text"] for o in opts])
            if by_name is not None:
                d.delivery_location = opts[by_name]["text"]
                return None
        if len(m) < 4:
            return "Please type the delivery address, or one of the listed ones."
        d.delivery_location = m[:300]
        return None

    def _pick_named(self, d: RfqDraft, m: str, key: str) -> str | None:
        opts = d.options
        if opts:
            picks = parse_choices(m, len(opts))
            if picks:
                return str(opts[picks[0]][key])
            by_name = pick_by_name(m, [str(o[key]) for o in opts])
            if by_name is not None:
                return str(opts[by_name][key])
            return None
        return m[:200] if len(m) >= 2 else None

    def _c_department(self, d: RfqDraft, m: str) -> str | None:
        opts = d.options
        name = self._pick_named(d, m, "name")
        if not name:
            return "I could not match that to one of the departments. Please type the department name as listed."
        d.department = name
        d.department_id = next((str(o.get("id")) for o in opts if o.get("name") == name), None)
        return None

    def _c_cost_center(self, d: RfqDraft, m: str) -> str | None:
        name = self._pick_named(d, m, "name")
        if not name:
            return "I could not match that to one of the cost centers. Please type the cost center name as listed."
        d.cost_center = name
        return None

    def _c_currency(self, d: RfqDraft, m: str) -> str | None:
        allowed = self.ref.currencies
        code = find_currency(m, allowed) if allowed else (re.search(r"\b[A-Za-z]{3}\b", m) and re.search(r"\b[A-Za-z]{3}\b", m).group(0).upper())
        if not code:
            return "I did not recognise that currency." + (f" Options: {', '.join(allowed)}." if allowed else "")
        d.currency = code
        return None

    def _c_region(self, d: RfqDraft, m: str) -> str | None:
        if len(m) < 2:
            return "Please name the region or country."
        d.region = m[:100]
        return None

    def _c_end_date(self, d: RfqDraft, m: str) -> str | None:
        dt = parse_date(m, self.today)
        if dt is None:
            return "I could not read a date from that. Try “in 7 days” or “25 Oct”."
        if dt <= self.today:
            return f"Bidding must close after today ({self.today.isoformat()}). Pick a later date."
        d.end_date = datetime.combine(dt, time(23, 59, 59), tzinfo=timezone.utc).isoformat()
        return None

    def _c_delivery_date(self, d: RfqDraft, m: str) -> str | None:
        dt = parse_date(m, self.today)
        if dt is None:
            return "I could not read a date from that. Try “in 3 weeks” or “15 Nov”."
        closes = date.fromisoformat((d.end_date or self.now.isoformat())[:10])
        if dt < closes:
            return f"Delivery cannot be before bidding closes ({closes.isoformat()}). Pick a later date."
        d.delivery_target_date = datetime.combine(dt, time(0, 0), tzinfo=timezone.utc).isoformat()
        return None

    def _c_budget(self, d: RfqDraft, m: str) -> str | None:
        if is_skip(m):
            d.budget = 0.0
            d.notes.append("No budget set (sent as 0).")
            return None
        v = parse_amount(m)
        if v is None or v < 0:
            return "Please give the budget as a number, or say “no budget”."
        d.budget = v
        return None

    def _c_segment(self, d: RfqDraft, m: str) -> str | None:
        if is_skip(m) or m.lower().strip() == "skip":
            d.category_decided = True
            return None
        picks = parse_choices(m, len(d.options))
        if not picks and (named := pick_by_name(m, [str(o["title"]) for o in d.options])) is not None:
            picks = [named]  # the category was typed by its name
        if not picks:
            return "I could not match that to one of the categories. Please type the category name as listed, or say “skip”."
        self._set_segment(d, d.options[picks[0]])
        return None

    def _c_family(self, d: RfqDraft, m: str) -> str | None:
        if is_skip(m) or m.lower().strip() == "skip":
            d.category_decided = True
            return None
        picks = parse_choices(m, len(d.options))
        if not picks and (named := pick_by_name(m, [str(o["title"]) for o in d.options])) is not None:
            picks = [named]  # the sub-category was typed by its name
        if not picks:
            return "I could not match that to one of the sub-categories. Please type the sub-category name as listed, or say “skip”."
        f = d.options[picks[0]]
        d.family_id, d.family_title, d.category_decided = f["family"], f["title"], True
        return None

    def _c_suppliers(self, d: RfqDraft, m: str) -> str | None:
        opts = d.options
        problems: list[str] = []
        emails = find_emails(m)
        for em in emails:
            before = re.split(re.escape(em), m, maxsplit=1)[0]
            name = re.sub(r"\b(external|invite|add|supplier|send to|also)\b|[:,-]", " ", before, flags=re.I).strip().split("\n")[-1].strip()
            name = re.sub(r"\s+", " ", name) or em.split("@")[0]
            if not any(x.email.lower() == em.lower() for x in d.externals):
                d.externals.append(ExternalSupplier(name=name[:200], email=em))
        if is_skip(m) or m.lower().strip() == "skip":
            d.suppliers_decided = True
            d.notes.append("No suppliers selected: the RFQ will be created without invitations.")
            return None
        listed = re.sub(r"[^;\n]*\S+@\S+[^;\n]*", " ", m)  # the parts about e-mail invitations name nobody from the list
        spans = [(i, mt.span()) for i, o in enumerate(opts) if (mt := re.search(rf"(?<![a-z0-9]){re.escape(o['name'].lower())}(?![a-z0-9])", listed.lower()))]
        picks = [i for i, (a, b) in spans if not any((a2 <= a and b <= b2 and (a2, b2) != (a, b)) for _, (a2, b2) in spans)]  # every supplier named; “IBM Technologies Pvt ltd” is not also “IBM”
        if not picks:
            picks = [] if emails and not re.search(r"\ball\b", listed.lower()) else parse_choices(listed, len(opts))
        if not picks:
            by_name = pick_by_name(listed, [o["name"] for o in opts]) if opts else None
            picks = [by_name] if by_name is not None else []
        for i in picks:
            o = opts[i]
            if any(p.supplier_id == o["supplier_id"] for p in d.picked):
                continue
            try:
                users = self.gw.supplier_users(o["organization_id"])
            except GatewayError as e:
                problems.append(f"{o['name']}: could not load its users to notify ({e.message})")
                continue
            ids = [str(_g(u, "userId")) for u in users if _g(u, "userId")]
            if not ids:
                problems.append(f"{o['name']} has no users to notify, so it cannot be invited. You can invite it by e-mail instead")
                continue
            d.picked.append(PickedSupplier(supplier_id=o["supplier_id"], organization_id=o["organization_id"], name=o["name"], verified=o["verified"], user_ids=ids))
        if not d.picked and not d.externals:
            return ("; ".join(problems) + ". " if problems else "") + "Tell me the supplier names, “all”, an e-mail invitation (“external <name> <e-mail>”), or “skip”."
        d.suppliers_decided = True
        return "; ".join(problems) + "." if problems else None

    def _c_questions(self, d: RfqDraft, m: str) -> str | None:
        if is_skip(m):
            d.questions_decided = True
            return None
        parts = [re.sub(r"^\s*(?:\d+[.)]|[-*])\s*", "", p).strip() for p in re.split(r"[\n;]+", m)]
        qs = [p[:500] for p in parts if len(p) >= 3]
        if not qs:
            return "Please type the question, or say “none”."
        d.questions += qs
        d.questions_decided = True
        return None

    # ================================================================ review and edits
    def _summary(self, d: RfqDraft) -> FlowReply:
        d.stage = "review"
        items = Table(title="Items", columns=["#", "Item", "Quantity", "Item master", "Group"], rows=[
            [str(k + 1), i.name, _fmt_qty(i.quantity, i.uom), f"{i.matched_description} ({i.material_code})" if i.matched_description else (f"free text, code {i.material_code}" if i.material_code else "free text"),
             i.material_group or d.family_title or PLACEHOLDER] for k, i in enumerate(d.items)])
        head = Table(title="RFQ", columns=["Field", "Value"], rows=[
            ["Title", self.title(d)], ["Department / cost center", f"{d.department} / {d.cost_center}"], ["Currency", d.currency or ""],
            ["Region", d.region or ""], ["Delivery location", d.delivery_location or ""], ["Bidding opens", (d.start_date or "")[:10] + " (today)"],
            ["Bidding closes", (d.end_date or "")[:10]], ["Deliver by", (d.delivery_target_date or "")[:10]],
            ["Budget", f"{d.budget:g} {d.currency}" if d.budget else "none"], ["Award", "one supplier for the whole RFQ" if d.add_lot_option else "per item"],
            ["Category", " > ".join(x for x in (d.segment_title, d.family_title) if x) or "not set"]])
        sup_rows = [[p.name, f"{'verified' if p.verified else 'not verified'}, {len(p.user_ids)} user(s) notified"] for p in d.picked] + [[e.name, f"external, e-mailed to {e.email}"] for e in d.externals]
        sup = Table(title="Suppliers", columns=["Supplier", "How"], rows=sup_rows or [["(none)", "no one will be invited"]])
        tables = [head, items, sup]
        if d.questions:
            tables.append(Table(title="Questions to suppliers", columns=["#", "Question"], rows=[[str(k + 1), q] for k, q in enumerate(d.questions)]))
        warn = ["This RFQ is published the moment you confirm. The buyer system has no draft state, so it cannot be saved and edited later by chat.",
                f"It will be sent to {len(d.picked)} registered and {len(d.externals)} external supplier(s); external suppliers receive an e-mail."]
        if any(not i.matched_description and not i.material_code for i in d.items):
            warn.append("Items marked free text have no item-master code; they are sent with the code N/A.")
        if not (d.picked or d.externals):
            warn.append("No suppliers are invited.")
        text = "Here is the RFQ ready to send:\n\n" + "\n".join(f"⚠ {w}" for w in warn) + "\n\nSay **confirm** to send it, tell me what to change (for example “change currency to USD”, “remove shrimp”, “close on 25 Oct”), or **cancel**."
        return FlowReply(text, ["Confirm and send RFQ", "Change something", "Cancel"], tables, awaiting="confirm", needs_confirmation=True, data={"stage": "review"})

    def title(self, d: RfqDraft) -> str:
        if d.title:
            return d.title
        base = d.purpose or ("RFQ for " + ", ".join(i.name for i in d.items[:3]) + ("…" if len(d.items) > 3 else ""))
        return (base[:1].upper() + base[1:])[:200]

    def _review_reply(self, d: RfqDraft, m: str) -> FlowReply:
        if is_confirm(m):
            return self._send(d)
        note = self._edit(d, m)
        if note is None:
            r = self._summary(d)
            r.text = ("I did not understand that change. You can say things like “change currency to USD”, “remove shrimp”, “add beef 30 kg”, “close on 25 Oct”, "
                      "“deliver by 15 Nov”, “budget 50000”, “change suppliers”, or “confirm”.\n\n") + r.text
            return self._finish(d, r)
        d.notes.append(note)
        d.stage = "collecting"
        return self.advance(d)

    def _edit(self, d: RfqDraft, m: str) -> str | None:
        t = norm(m).lower()
        if mm := re.search(r"\b(?:remove|delete|drop)\s+(.+)$", t):
            idx = match_item(mm.group(1), [i.name for i in d.items])
            if idx is None:
                return None
            gone = d.items.pop(idx)
            return f"Removed {gone.name}." + (" The RFQ now has no items." if not d.items else "")
        add = re.search(r"\badd\s+(.+)$", t)
        if add and not re.search(r"\bsupplier|question", t):
            names = split_list(add.group(1))
            for n in names:
                name, qty, uom = item_inline_qty(n)
                d.items.append(DraftItem(name=name, quantity=qty, uom=uom))
            return f"Added {', '.join(names)}." if names else None
        if re.search(r"\b(?:clos\w*|deadline|bidding (?:ends?|closes?))\b", t) and (dt := parse_date(re.split(r"clos\w*|deadline|ends?", t, maxsplit=1)[-1], self.today)):
            if dt <= self.today:
                return None
            d.end_date = datetime.combine(dt, time(23, 59, 59), tzinfo=timezone.utc).isoformat()
            d.delivery_target_date = d.delivery_target_date if d.delivery_target_date and d.delivery_target_date[:10] >= dt.isoformat() else None
            return f"Bidding now closes on {dt.isoformat()}."
        if re.search(r"\bdeliver\w*|\bneeded by\b", t) and (dt := parse_date(re.split(r"deliver\w*|needed by", t, maxsplit=1)[-1], self.today)):
            if d.end_date and dt < date.fromisoformat(d.end_date[:10]):
                return None
            d.delivery_target_date = datetime.combine(dt, time(0, 0), tzinfo=timezone.utc).isoformat()
            return f"Delivery date is now {dt.isoformat()}."
        if re.search(r"\bbudget\b", t):
            if is_skip(t.replace("budget", "").strip()) or "no budget" in t:
                d.budget = 0.0
                return "Budget removed."
            if (v := parse_amount(t)) is not None:
                d.budget = v
                return f"Budget is now {v:g}."
        if re.search(r"\bcurrency\b", t) and (code := find_currency(m, self.ref.currencies or [w.upper() for w in re.findall(r"\b[a-zA-Z]{3}\b", m)])):
            d.currency = code
            return f"Currency is now {code}."
        if re.search(r"\b(single supplier|one supplier|whole rfq|lot)\b", t):
            d.add_lot_option = True
            return "Award will go to one supplier for the whole RFQ."
        if re.search(r"\b(per item|item by item|each item separately|split)\b", t):
            d.add_lot_option = False
            return "Award can go item by item."
        resets = [(r"\bsuppliers?\b", ("picked", "externals", "suppliers_decided"), "Let's choose the suppliers again."),
                  (r"\bquestions?\b", ("questions", "questions_decided"), "Let's redo the questions."),
                  (r"\b(location|address)\b", ("delivery_location",), "Let's choose the delivery location again."),
                  (r"\b(department|cost cent(?:er|re))\b", ("department", "department_id", "cost_center"), "Let's choose the department again."),
                  (r"\bcategory\b", ("segment_id", "segment_title", "family_id", "family_title", "category_decided"), "Let's choose the category again."),
                  (r"\b(deadline|closing date|bidding date)\b", ("end_date",), "When should bidding close?")]
        for pat, fields, note in resets:
            if re.search(pat, t):
                for f in fields:
                    setattr(d, f, [] if f in ("picked", "externals", "questions") else False if f.endswith("decided") else None)
                return note
        qty_changes = parse_quantities(m, [i.name for i in d.items], [])
        if qty_changes:
            self._assign_quantities(d, qty_changes)
            return "Updated the quantities."
        return None

    # ================================================================ sending
    def dto(self, d: RfqDraft) -> dict[str, Any]:
        s = self.settings
        ti = s.invite_template_id or s.default_verification_template_id
        if not ti or not s.default_verification_template_id:
            raise GatewayError(503, "The RFQ template is not configured (set PROCUREIQ_VERIFICATION_TEMPLATE_ID).")
        return {
            "title": self.title(d),
            "description": (d.purpose or self.title(d)) + ". Items: " + ", ".join(f"{i.name} ({_fmt_qty(i.quantity, i.uom)})" for i in d.items) + ".",
            "department": d.department or PLACEHOLDER, "region": d.region or PLACEHOLDER, "currency": d.currency or PLACEHOLDER,
            "deliveryLocation": d.delivery_location or PLACEHOLDER, "startDate": d.start_date, "endDate": d.end_date,
            "deliveryTargetDate": d.delivery_target_date, "budget": d.budget or 0, "addLotOption": d.add_lot_option,
            "segmentId": d.segment_id, "segmentTitle": d.segment_title, "familyId": d.family_id, "familyTitle": d.family_title,
            "templateId": ti, "rfqVerificationTemplateId": s.default_verification_template_id,
            "technicalSpecificationDocuments": None, "termsConditionDocuments": None,
            "questions": [{"id": str(uuid.uuid4()), "question": q, "questionType": "INPUT", "isRequired": True, "displayOrder": k, "options": None, "attachments": None}
                          for k, q in enumerate(d.questions)],
            "items": [{"description": i.matched_description or i.name, "quantity": i.quantity, "uom": i.uom, "materialCode": i.material_code or PLACEHOLDER,
                       "materialGroup": i.material_group or d.family_title or PLACEHOLDER, "costCenter": d.cost_center or PLACEHOLDER, "attachments": None}
                      for i in d.items],
            "supplierInvites": [{"supplierId": p.supplier_id, "userIds": p.user_ids} for p in d.picked],
            "externalSuppliers": [{"supplierName": e.name, "email": e.email, "phoneNumber": e.phone, "address": e.address} for e in d.externals],
        }

    def _send(self, d: RfqDraft) -> FlowReply:
        d.stage = "sending"
        self._persist(d)  # saved BEFORE the call, so a repeated "confirm" cannot send the RFQ twice
        title = self.title(d)
        try:
            res = self.gw.create_rfq(self.dto(d))
        except GatewayError as e:
            return self._after_failed_send(d, title, e)
        d.stage, d.sent_rfq_id = "done", str(res.get("id") or "") or None
        number = self._find_number(title, d.sent_rfq_id)
        text = f"Done: the RFQ “{title}” has been created and sent" + (f" as **{number}**" if number else "") + f". Bidding closes {(d.end_date or '')[:10]}."
        text += " Suppliers have been notified. Ask me to “compare bids” once quotes arrive."
        self._persist(d)
        return FlowReply(text, ["Show my RFQs", "Create another RFQ"], awaiting=None, done=True, data={"rfq_id": d.sent_rfq_id, "rfq_number": number})

    def _find_number(self, title: str, rfq_id: str | None) -> str | None:
        try:
            for r in self.gw.list_rfqs(title[:60], None, 10):
                if rfq_id and rfq_id in (str(_g(r, "rfqId", default="")), str(_g(r, "id", default=""))):
                    return str(_g(r, "rfqNumber"))
        except GatewayError:
            return None
        return None

    def _after_failed_send(self, d: RfqDraft, title: str, e: GatewayError) -> FlowReply:
        """The Buyer API saves the RFQ before it calls the supplier service, so a failure can leave it half done. Check before saying 'not created'."""
        existing: str | None = None
        try:
            for r in self.gw.list_rfqs(title[:60], None, 10):
                if str(_g(r, "title", default="")).strip() == title.strip():
                    existing = str(_g(r, "rfqNumber"))
                    break
        except GatewayError:
            existing = None
        if existing:
            d.stage = "done"
            self._persist(d)
            return FlowReply(f"The buyer system reported a problem ({e.message}), but an RFQ titled “{title}” now exists ({existing}). It may be only partly set up, "
                             "so please open it in the buyer app and check that suppliers were invited. I will not send it again.", done=True)
        d.stage = "review"
        self._persist(d)
        return FlowReply(f"The RFQ was not sent: {e.message}\nNothing was created. Say **confirm** to try again, change something, or **cancel**.",
                         ["Confirm and send RFQ", "Cancel"], awaiting="confirm", needs_confirmation=True)

    # ================================================================ first-message extras
    def _apply_labelled(self, d: RfqDraft, labelled: list[tuple[str, str, int]], message: str) -> None:
        """Give the draft what the first message stated with a label, so those questions are not asked. What cannot be used is left to be asked."""
        for label, value, pos in labelled:
            if label in ("group", "code") and d.items:
                before = message[:pos].lower()
                it = max((i for i in d.items if i.name.lower() in before), key=lambda i: before.rfind(i.name.lower()), default=d.items[-1])
                if label == "code":
                    it.material_code = value.split()[0]
                else:
                    known = sorted(self.ref.material_groups, key=len, reverse=True)
                    it.material_group = next((g for g in known if g.lower() in value.lower()), value.split(",")[0].strip()[:100])
            elif label == "department":
                deps = [{"name": str(_g(x, "department")), "id": str(_g(x, "id"))} for x in self.ref.departments]
                at = pick_by_name(value, [x["name"] for x in deps]) if deps else None
                if at is not None:
                    d.department, d.department_id = deps[at]["name"], deps[at]["id"]
                else:
                    d.notes.append(f"I could not find the department \u201c{value}\u201d.")
            elif label == "location":
                locs = [location_text(x) for x in self.ref.locations]
                at = pick_by_name(value, locs) if locs else None
                d.delivery_location = locs[at] if at is not None else value[:300]
            elif label == "end_date":
                dt = parse_date(value, self.today)
                if dt and dt > self.today:
                    d.end_date = datetime.combine(dt, time(23, 59, 59), tzinfo=timezone.utc).isoformat()
            elif label == "delivery_date":
                dt = parse_date(value, self.today)
                if dt and dt > self.today:
                    d.delivery_target_date = datetime.combine(dt, time(0, 0), tzinfo=timezone.utc).isoformat()
            elif label == "budget":
                if (v := parse_amount(value)) is not None and v >= 0:
                    d.budget = v
            elif label == "category":
                d.wanted_category = value
            elif label == "subcategory":
                d.wanted_family = value
            elif label == "supplier":
                names = [re.sub(r"\s*\((?:verified|not verified)\)\s*", " ", n, flags=re.I).strip() for n in re.split(r"\s*(?:;|,|\band\b|&)\s*", value)]
                d.wanted_suppliers = [n for n in names if len(n) >= 2]
        if d.end_date and d.delivery_target_date and d.delivery_target_date[:10] < d.end_date[:10]:
            d.delivery_target_date = None
            d.notes.append("Delivery cannot be before bidding closes, so I will ask for the delivery date.")

    def _opportunistic(self, d: RfqDraft, message: str) -> None:
        t = norm(message).lower()
        if not d.end_date and (m := re.search(r"\b(?:clos\w*|deadline|bidding (?:ends?|closes?)|due)\b(.{0,40})", t)):
            dt = parse_date(m.group(1), self.today)
            if dt and dt > self.today:
                d.end_date = datetime.combine(dt, time(23, 59, 59), tzinfo=timezone.utc).isoformat()
        if not d.delivery_target_date and (m := re.search(r"\b(?:deliver\w*|needed by|required by)\b(.{0,40})", t)):
            dt = parse_date(m.group(1), self.today)
            if dt and (not d.end_date or dt >= date.fromisoformat(d.end_date[:10])):
                d.delivery_target_date = datetime.combine(dt, time(0, 0), tzinfo=timezone.utc).isoformat()
        if d.budget is None and re.search(r"\bbudget\b", t) and (v := parse_amount(t.split("budget", 1)[1])) is not None:
            d.budget = v
        if re.search(r"\b(single supplier|one supplier|lot award)\b", t):
            d.add_lot_option = True


# ============================================================================
# The rest of what a buyer does by hand, as conversation: find RFQs, read quotes, freeze bidding, award, un-award, draft a contract, look up
# ============================================================================

STATUS_WORDS = {"live": "LIVE", "open": "Open", "frozen": "Freezing", "freezing": "Freezing", "freeze": "Freezing", "awarded": "AWARDED"}
RFQ_NO = re.compile(r"\bRFQ-\d{6,}\b", re.I)


def _d(v: Any) -> str:
    return str(v)[:10] if v else ""


def _qty(q: Any, uom: Any) -> str:
    try:
        return f"{float(q):g} {uom or ''}".strip()
    except (TypeError, ValueError):
        return f"{q or ''} {uom or ''}".strip()


def _money(v: Any) -> str:
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return "-"


def classify(text: str) -> str | None:
    t = norm(text).lower()
    if wants_new_rfq(text):
        return "create_rfq"
    if re.search(r"\b(help|what can you do|what do you do|capabilities|how does this work)\b", t):
        return "help"
    if re.search(r"\b(unaward|un-award|reverse (?:the )?award|undo (?:the )?award|cancel (?:the )?award|revoke (?:the )?award)\b", t):
        return "unaward"
    if re.search(r"\baward\b", t):
        return "award"
    if re.search(r"\b(freeze|stop bidding|close bidding|end bidding|close the rfq|close rfq)\b", t):
        return "freeze"
    if re.search(r"\bcontracts?\b", t):
        return "contract"
    if re.search(r"\bpurchase orders?\b|\bpos\b", t):
        return "purchase_orders"
    if re.search(r"\b(compare|comparison|cheapest|lowest|best price|who quoted|quotes?|quotations?|bids?)\b", t):
        return "compare"
    if re.search(r"\b(find|search|look ?up|list|show)\b.*\bsuppliers?\b|\bsuppliers? for\b", t):
        return "search_suppliers"
    if re.search(r"\b(find|search|look ?up)\b.*\b(items?|materials?|products?)\b", t):
        return "search_items"
    if RFQ_NO.search(text) or re.search(r"\b(details?|status|info|tell me about)\b.*\brfq\b", t):
        return "rfq_details"
    if re.search(r"\brfqs?\b", t) and re.search(r"\b(show|list|view|get|display|see|find|search|look ?up|my|all|what|which|how many|open|live|awarded|frozen)\b", t):
        return "list_rfqs"
    return None


# What each action needs, as Identity permission keys (from the [ApiAuthorization] attributes of the Buyer API). Checked up front so a buyer who may not
# do something is told at once, instead of after answering ten questions. The .NET services enforce the same keys regardless.
PERMISSION_FOR: dict[str, tuple[str, str]] = {
    "create_rfq": ("CREATE_RFQ", "create RFQs"),
    "list_rfqs": ("GET_RFQ_MASTER_DATA", "list RFQs"),
    "rfq_details": ("GET_RFQ_BY_ID", "view RFQ details"),
    "compare": ("GET_BID_COMPARE", "compare bids"),
    "freeze": ("UPDATE-BUYER_RFQ-STATUS", "freeze bidding"),
    "award": ("SAVE_RFQ_AWARD", "award an RFQ"),
    "unaward": ("UNAWARD_RFQ", "un-award an RFQ"),
    "contract": ("CREATE_CONTRACT", "create contracts"),
    "purchase_orders": ("GET_PURCHASE_ORDER", "view purchase orders"),
    "search_items": ("GET_ITEM_BUYER_MASTER", "search the item master"),
}


def missing_permission(intent: str | None, permissions: frozenset[str] | None) -> str | None:
    """A refusal message when the login lacks the permission this action needs; None when allowed or when permissions are unknown."""
    need = PERMISSION_FOR.get(intent or "")
    if need is None or permissions is None or need[0] in permissions:
        return None
    return f"You do not have permission to {need[1]} (your role lacks {need[0]}). Ask your administrator to grant it. I have not started anything."


def capabilities(permissions: frozenset[str] | None) -> dict[str, bool | None]:
    """action -> allowed? (None when the permissions are not known)."""
    return {intent: (None if permissions is None else key in permissions) for intent, (key, _) in PERMISSION_FOR.items()}


HELP = (
    "I can do what you do by hand in the buyer app, by chat:\n"
    "• **Create an RFQ**: “create an RFQ for fresh and frozen meat for our restaurants, including chicken, shrimp and frozen mutton”. "
    "I fill in what I can from your profile and master data, ask only what is missing, and send it after you confirm.\n"
    "• **Find RFQs**: “show my open RFQs”, “list awarded RFQs”.\n"
    "• **RFQ details**: “details of RFQ-20261006120000”.\n"
    "• **Compare quotes**: “compare bids for RFQ-…” (who is cheapest overall and per item).\n"
    "• **Freeze bidding**: “freeze RFQ-…”.\n"
    "• **Award**: “award RFQ-… to the lowest bidder per item” or “award RFQ-… to <supplier>” (needs your typed confirmation). “Un-award RFQ-…” reverses it.\n"
    "• **Contract**: “create a contract for RFQ-…”.\n"
    "• **Purchase orders**: “show my purchase orders”.\n"
    "• **Look things up**: “find item chicken”, “find suppliers for meat”.\n\n"
    "Not available by chat yet: attaching files, editing a published RFQ, and goods receipts or invoices. Anything that changes data asks you first, "
    "and I can only do what your own permissions allow.")


class Ops:
    def __init__(self, gw: BuyerGateway, ref: RefData, ctx: dict[str, Any], now: datetime) -> None:
        self.gw, self.ref, self.ctx, self.now = gw, ref, ctx, now

    # ================================================================ finding an RFQ
    def resolve_rfq(self, text: str, intent: str) -> tuple[dict[str, Any] | None, FlowReply | None]:
        """(rfq, None) when it is clear which RFQ is meant; (None, reply) when the buyer has to choose or nothing matched."""
        rows: list[dict[str, Any]] = []
        if m := RFQ_NO.search(text):
            rows = [r for r in self.gw.list_rfqs(m.group(0).upper(), None, 10) if str(_g(r, "rfqNumber", default="")).upper() == m.group(0).upper()]
            if not rows:
                return None, FlowReply(f"I could not find {m.group(0).upper()} among the RFQs you can see.")
            return self._brief(rows[0]), None
        shown = self.ctx.get("rfqs") or []
        if shown:
            picks = parse_choices(text, len(shown)) if re.search(r"#\s*\d|\b(first|second|third|fourth|fifth|last|\d+(?:st|nd|rd|th))\b", text.lower()) else []
            if len(picks) == 1:
                return shown[picks[0]], None
        term = self._search_term(text)
        if term:
            rows = self.gw.list_rfqs(term, None, 8)
            if len(rows) == 1:
                return self._brief(rows[0]), None
        elif self.ctx.get("last_rfq"):  # no RFQ named ("it", "that one", or nothing): the one we were just talking about or just created
            return self.ctx["last_rfq"], None
        matched = bool(rows)
        if not rows:
            rows = self.gw.list_rfqs(None, None, 6)
        if not rows:
            return None, FlowReply("You have no RFQs yet.")
        if len(rows) == 1 and not term:
            return self._brief(rows[0]), None  # the only RFQ there is
        self.ctx["rfqs"] = [self._brief(r) for r in rows]
        self.ctx["pending_pick"] = {"intent": intent, "text": text}
        lead = f"I found no RFQ matching “{term}”. " if term and not matched else ""
        return None, FlowReply(lead + "Which RFQ do you mean? Tell me its RFQ number (for example " + (self._brief(rows[0])["number"] or "RFQ-…") + ") or its title.",
                               [self._brief(r)["number"] for r in rows if self._brief(r)["number"]],
                               [self._rfq_table(rows, "Matching RFQs" if matched else "Your latest RFQs")], awaiting="pick_rfq")

    @staticmethod
    def _brief(r: dict[str, Any]) -> dict[str, Any]:
        return {"id": str(_g(r, "rfqId", "id", default="")), "number": str(_g(r, "rfqNumber", default="")), "title": str(_g(r, "title", default="")),
                "status": str(_g(r, "status", default="") or ""), "end": _d(_g(r, "endDate"))}

    @staticmethod
    def _search_term(text: str) -> str | None:
        if q := re.search(r"[\"“']([^\"”']{2,})[\"”']", text):
            return q.group(1).strip()
        m = re.search(r"\b(?:for|about|on|named|called|containing|titled)\s+(?:the\s+)?(.+?)(?:\s+rfq)?\s*$", re.sub(RFQ_NO, "", text), flags=re.I)
        term = re.sub(r"\b(rfqs?|bids?|quotes?|quotations?|please|now)\b", "", m.group(1) if m else "", flags=re.I).strip(" ?.!,")
        return term if len(term) >= 3 else None

    def _rfq_table(self, rows: list[dict[str, Any]], title: str) -> Table:
        return Table(title=title, columns=["#", "RFQ", "Title", "Closes", "Status"],
                     rows=[[str(i + 1), str(_g(r, "rfqNumber", default="")), str(_g(r, "title", default=""))[:70], _d(_g(r, "endDate")), str(_g(r, "status", default="") or "")]
                           for i, r in enumerate(rows)])

    # ================================================================ read-only
    def list_rfqs(self, text: str) -> FlowReply:
        status = next((v for k, v in STATUS_WORDS.items() if re.search(rf"\b{k}\b", text.lower())), None)
        term = self._search_term(text)
        rows = self.gw.list_rfqs(term, status, 15)
        self.ctx["rfqs"] = [self._brief(r) for r in rows]
        if not rows:
            return FlowReply("I found no RFQs" + (f" matching “{term}”" if term else "") + (f" with status {status}" if status else "") + ".", ["Create an RFQ"])
        return FlowReply(f"You have {len(rows)} RFQ(s)" + (f" ({status})" if status else "") + ". Say “details of 1” or “compare bids for 1” to go further.",
                         tables=[self._rfq_table(rows, "RFQs")])

    def details(self, rfq: dict[str, Any]) -> FlowReply:
        r = self.gw.rfq(rfq["id"])
        self.ctx["last_rfq"] = rfq
        items = Table(title="Items", columns=["#", "Item", "Quantity", "Awarded"], rows=[
            [str(k + 1), str(_g(i, "description", default="")), _qty(_g(i, "quantity"), _g(i, "uom")), "yes" if _g(i, "isAwarded") else ""]
            for k, i in enumerate(_g(r, "items", default=[]) or [])])
        sup = Table(title="Suppliers invited", columns=["Supplier"], rows=[[str(_g(s, "supplierName", "name", default="?"))] for s in (_g(r, "supplierIds", default=[]) or [])]
                    + [[f"{_g(e, 'supplierName', 'name', default='?')} (external)"] for e in (_g(r, "externalSupplierIds", default=[]) or [])])
        head = Table(columns=["Field", "Value"], rows=[
            ["RFQ", rfq["number"]], ["Title", str(_g(r, "title", default=rfq["title"]))], ["Status", str(_g(r, "status", default=rfq["status"]))],
            ["Bidding", f"{_d(_g(r, 'startDate'))} to {_d(_g(r, 'endDate'))}"], ["Deliver by", _d(_g(r, "deliveryTargetDate"))],
            ["Delivery location", str(_g(r, "deliveryLocation", default=""))], ["Currency / budget", f"{_g(r, 'currency', default='')} / {_g(r, 'budget', default='')}"],
            ["Award mode", "one supplier for the whole RFQ" if _g(r, "addLotOption") else "per item"]])
        quotes = len(_g(r, "supplierQuotation", default=[]) or [])
        return FlowReply(f"{rfq['number']}: {quotes} supplier quote(s) received so far.", tables=[head, items, sup])

    def purchase_orders(self) -> FlowReply:
        rows = self.gw.purchase_orders(15)
        if not rows:
            return FlowReply("There are no purchase orders to show.")
        return FlowReply(f"Your latest {len(rows)} purchase order(s):", tables=[Table(columns=["PO", "Supplier", "Status", "Amount", "Date", "Items"], rows=[
            [str(_g(r, "poNumber", default="")), str(_g(r, "supplierName", default="")), str(_g(r, "status", default="")),
             f"{_money(_g(r, 'totalAmount'))} {_g(r, 'currency', default='')}".strip(), _d(_g(r, "orderDate")), str(_g(r, "itemCount", default=""))] for r in rows])])

    def search_items(self, text: str) -> FlowReply:
        term = re.sub(r"\b(find|search|look ?up|for|items?|materials?|products?|in|my|the|item master)\b", " ", text, flags=re.I).strip(" ?.!,")
        if len(term) < 2:
            return FlowReply("What should I search for? For example “find item chicken”.")
        rows = self.gw.item_master(term, self.ref.buyer_id)
        if not rows:
            return FlowReply(f"Nothing in your item master matches “{term}”.")
        return FlowReply(f"{len(rows)} item(s) match “{term}”:", tables=[Table(columns=["Description", "Code", "Group"], rows=[
            [str(_g(r, "description", default="")), str(_g(r, "materialCode", default="")), str(_g(r, "materialGroup", default=""))] for r in rows])])

    def search_suppliers(self, text: str) -> FlowReply:
        term = re.sub(r"\b(find|search|look ?up|list|show|suppliers?|for|in|my|the|verified|all)\b", " ", text, flags=re.I).strip(" ?.!,")
        rows = self.gw.find_suppliers(term or None, None, None, True if re.search(r"\bverified\b", text.lower()) else None, self.ref.buyer_id or "", 15)
        if not rows:
            return FlowReply("No suppliers match.")
        return FlowReply(f"{len(rows)} supplier(s):", tables=[Table(columns=["Supplier", "Verified", "ID"], rows=[
            [str(_g(r, "supplierName", default="")), "yes" if _g(r, "isVerified") else "no", str(_g(r, "snid", "SNID", default=""))] for r in rows])])

    # ================================================================ comparing quotes
    def _bids(self, rfq: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
        data = self.gw.bid_compare(rfq["id"])
        suppliers = [s for s in (_g(data, "suppliers", default=[]) or []) if _g(s, "latestVersion")]
        items = list(_g(data, "rfqItems", default=[]) or [])
        return data, suppliers, items

    def compare(self, rfq: dict[str, Any]) -> FlowReply:
        data, suppliers, items = self._bids(rfq)
        self.ctx["last_rfq"] = rfq
        if not suppliers:
            return FlowReply(f"No supplier has submitted a quote for {rfq['number']} yet.")
        n_items = len(items)

        def quoted(s: dict[str, Any]) -> int:
            return len({str(_g(q, "buyerRFQItemId", "buyerRfqItemId")) for q in _g(_g(s, "latestVersion"), "items", default=[]) or []})

        def total(s: dict[str, Any]) -> float:
            return float(_g(_g(s, "latestVersion"), "totalPrice", default=0) or 0)

        ranked = sorted(suppliers, key=lambda s: (quoted(s) < n_items, total(s)))  # complete quotes first, cheapest first within each group
        rows = []
        for k, s in enumerate(ranked):
            lv, fv = _g(s, "latestVersion"), _g(s, "firstVersion") or {}
            t, f = total(s), float(_g(fv, "totalPrice", default=0) or 0)
            change = f"{(t - f) / f * 100:+.1f}% vs first" if f and str(_g(fv, "version")) != str(_g(lv, "version")) else ""
            rows.append([str(k + 1), str(_g(s, "supplierName", default="?")), _money(t), f"{quoted(s)}/{n_items}", f"v{_g(lv, 'version', default='')} {change}".strip(), str(_g(lv, "status", default=""))])
        tables = [Table(title="Quotes (complete quotes first, then cheapest)", columns=["#", "Supplier", "Total", "Items quoted", "Version", "Status"], rows=rows)]

        by_item: dict[str, list[tuple[float, str]]] = {}
        for s in suppliers:
            for q in _g(_g(s, "latestVersion"), "items", default=[]) or []:
                by_item.setdefault(str(_g(q, "buyerRFQItemId", "buyerRfqItemId", default="")), []).append((float(_g(q, "quotedAmount", default=0) or 0), str(_g(s, "supplierName", default="?"))))
        lines, unquoted = [], []
        for it in sorted(items, key=lambda x: int(_g(x, "lineNumber", default=0) or 0)):
            quotes = sorted(by_item.get(str(_g(it, "id")), []))
            if quotes:
                lines.append([str(_g(it, "description", default="")), _qty(_g(it, "quantity"), _g(it, "uom")), quotes[0][1], _money(quotes[0][0]),
                              ", ".join(f"{n} {_money(a)}" for a, n in quotes[1:3])])
            else:
                unquoted.append(str(_g(it, "description", default="")))
        if lines:
            tables.append(Table(title="Cheapest supplier for each item", columns=["Item", "Quantity", "Cheapest", "Amount", "Next best"], rows=lines))

        complete = [s for s in ranked if quoted(s) >= n_items]
        partial = [s for s in ranked if quoted(s) < n_items]
        text = f"{rfq['number']}: {len(suppliers)} supplier(s) have quoted. "
        if complete:
            text += f"Lowest complete quote: **{_g(complete[0], 'supplierName')}** ({_money(total(complete[0]))}). "
        else:
            text += "No supplier has quoted every item, so there is no complete quote to compare. "
        if partial:
            text += "Quoted only some items (their totals are not comparable): " + ", ".join(f"{_g(s, 'supplierName')} ({quoted(s)}/{n_items})" for s in partial) + ". "
        if unquoted:
            text += "Nobody has quoted: " + ", ".join(unquoted[:4]) + ". "
        text += ("This RFQ awards the whole lot to one supplier, so a complete quote is required." if _g(data, "addLotOption")
                 else "Awards are per item, so the per-item table shows where each supplier is cheapest.")
        text += " Say “award” to continue. These are the suppliers' own quotes in the system and exclude anything negotiated outside it."
        return FlowReply(text, ["Award to the lowest bidder per item", "Freeze bidding"], tables, data={"rfq_id": rfq["id"]})

    # ================================================================ actions that need confirmation
    def freeze(self, rfq: dict[str, Any]) -> tuple[dict[str, Any], FlowReply]:
        action = {"action": "freeze", "rfq": rfq, "phrase": None}
        return action, FlowReply(f"Freeze bidding on {rfq['number']} ({rfq['title'][:60]})? Suppliers will no longer be able to change their quotes. Say **confirm** to proceed or **cancel**.",
                                 ["Confirm", "Cancel"], awaiting="confirm_action", needs_confirmation=True)

    def award_plan(self, rfq: dict[str, Any], text: str) -> tuple[dict[str, Any] | None, FlowReply]:
        data, suppliers, items = self._bids(rfq)
        if not suppliers:
            return None, FlowReply(f"No supplier has quoted on {rfq['number']}, so there is nothing to award yet.")
        lot = bool(_g(data, "addLotOption"))
        names = [str(_g(s, "supplierName", default="?")) for s in suppliers]
        quote: dict[tuple[str, str], float] = {}
        for s in suppliers:
            for q in _g(_g(s, "latestVersion"), "items", default=[]) or []:
                quote[(str(_g(s, "supplierId")), str(_g(q, "buyerRFQItemId", "buyerRfqItemId")))] = float(_g(q, "quotedAmount", default=0) or 0)
        total_of = {str(_g(s, "supplierId")): float(_g(_g(s, "latestVersion"), "totalPrice", default=0) or 0) for s in suppliers}
        t = text.lower()
        named = pick_by_name(text, names)
        cheapest = bool(re.search(r"\b(lowest|cheapest|best price|least)\b", t))
        selections: list[dict[str, str]] = []
        if named is not None:
            sid = str(_g(suppliers[named], "supplierId"))
            lacking = [str(_g(i, "description")) for i in items if (sid, str(_g(i, "id"))) not in quote]
            if lacking:
                return None, FlowReply(f"{names[named]} did not quote every item (missing: {', '.join(lacking[:5])}), so I cannot award everything to them. Choose another supplier or the cheapest per item.")
            selections = [{"rfqItemId": str(_g(i, "id")), "supplierId": sid} for i in items]
        elif cheapest and lot:
            full = [s for s in suppliers if all((str(_g(s, "supplierId")), str(_g(i, "id"))) in quote for i in items)]
            if not full:
                return None, FlowReply("No single supplier quoted every item, and this RFQ must be awarded to one supplier.")
            best = min(full, key=lambda s: total_of[str(_g(s, "supplierId"))])
            selections = [{"rfqItemId": str(_g(i, "id")), "supplierId": str(_g(best, "supplierId"))} for i in items]
        elif cheapest:
            for i in items:
                opts = [(quote[(str(_g(s, "supplierId")), str(_g(i, "id")))], str(_g(s, "supplierId"))) for s in suppliers if (str(_g(s, "supplierId")), str(_g(i, "id"))) in quote]
                if not opts:
                    return None, FlowReply(f"Nobody quoted “{_g(i, 'description')}”, so it cannot be awarded. Award the other items another way or ask suppliers to quote it.")
                selections.append({"rfqItemId": str(_g(i, "id")), "supplierId": min(opts)[1]})
        else:
            return None, FlowReply(f"How should I award {rfq['number']}? Say “award to the lowest bidder per item”, or “award to {names[0]}” (any of: {', '.join(names)}).",
                                   ["Award to the lowest bidder per item"] + [f"Award to {n}" for n in names[:3]], awaiting="award_strategy")
        name_of = {str(_g(s, "supplierId")): str(_g(s, "supplierName", default="?")) for s in suppliers}
        desc = {str(_g(i, "id")): (str(_g(i, "description", default="")), _qty(_g(i, "quantity"), _g(i, "uom"))) for i in items}
        rows = [[desc[s["rfqItemId"]][0], desc[s["rfqItemId"]][1], name_of[s["supplierId"]], _money(quote[(s["supplierId"], s["rfqItemId"])])] for s in selections]
        total = sum(quote[(s["supplierId"], s["rfqItemId"])] for s in selections)
        winners = sorted({name_of[s["supplierId"]] for s in selections})
        plan = {"action": "award", "rfq": rfq, "phrase": "confirm award", "dto": {"rfqId": rfq["id"], "remarks": "Awarded via the procurement assistant", "selections": selections}}
        text_ = (f"Proposed award for {rfq['number']}: {len(selections)} item(s) to {len(winners)} supplier(s) ({', '.join(winners)}), total quoted {_money(total)}. "
                 "Awarding notifies the winning suppliers and changes the RFQ status to AWARDED. Type **confirm award** to proceed, or **cancel**.")
        return plan, FlowReply(text_, ["Confirm award", "Cancel"], [Table(title="Proposed award", columns=["Item", "Quantity", "Supplier", "Quoted amount"], rows=rows)],
                               awaiting="confirm_action", needs_confirmation=True)

    def unaward(self, rfq: dict[str, Any]) -> tuple[dict[str, Any], FlowReply]:
        return {"action": "unaward", "rfq": rfq, "phrase": "confirm unaward"}, FlowReply(
            f"Un-award {rfq['number']}? The award is deactivated and the RFQ goes back to Freezing, so you can award again. Type **confirm unaward** to proceed, or **cancel**.",
            ["Confirm unaward", "Cancel"], awaiting="confirm_action", needs_confirmation=True)

    def execute(self, plan: dict[str, Any]) -> FlowReply:
        rfq = plan["rfq"]
        try:
            if plan["action"] == "freeze":
                self.gw.set_rfq_status(rfq["id"], "Freezing")
                return FlowReply(f"Bidding on {rfq['number']} is frozen. Say “compare bids for {rfq['number']}” to review the quotes.", done=True)
            if plan["action"] == "award":
                res = self.gw.award(plan["dto"])
                return FlowReply(f"Awarded {rfq['number']}. The winning suppliers are being notified. Next, say “create a contract for {rfq['number']}”.", ["Create a contract"], done=True, data={"rfq_id": rfq["id"], "award": res})
            if plan["action"] == "unaward":
                self.gw.unaward(rfq["id"])
                return FlowReply(f"Un-awarded {rfq['number']}; its status is now Freezing.", done=True)
            if plan["action"] == "contract":
                res = self.gw.create_contract(plan["dto"])
                return FlowReply(f"Contract “{plan['dto']['contractName']}” was created" + (f" (id {res.get('id')})" if res.get("id") else "") + ". It may need approval in the buyer app before it is active.", done=True, data={"contract": res})
        except GatewayError as e:
            return FlowReply(f"That did not go through: {e.message}\nNothing was changed by me beyond what the buyer system confirmed. You can try again or say **cancel**.", ["Cancel"], awaiting="confirm_action", needs_confirmation=True)
        return FlowReply("I do not know how to do that.", done=True)

    # ================================================================ contract (small slot flow)
    def contract_start(self, rfq: dict[str, Any], text: str) -> tuple[dict[str, Any], FlowReply]:
        data, suppliers, items = self._bids(rfq)
        st: dict[str, Any] = {"rfq": rfq, "options": [{"id": str(_g(s, "supplierId")), "name": str(_g(s, "supplierName", default="?")),
                                                         "total": float(_g(_g(s, "latestVersion"), "totalPrice", default=0) or 0)} for s in suppliers]}
        if not suppliers:
            return st, FlowReply(f"{rfq['number']} has no quotes, so there is no supplier to make a contract with.")
        named = pick_by_name(text, [o["name"] for o in st["options"]])
        if named is not None:
            st["supplier"] = st["options"][named]
        elif len(st["options"]) == 1:
            st["supplier"] = st["options"][0]
        return st, self.contract_next(st)

    def contract_next(self, st: dict[str, Any]) -> FlowReply:
        rfq = st["rfq"]
        if not st.get("supplier"):
            lines = "\n".join(f"• {o['name']} (quoted {_money(o['total'])})" for o in st["options"])
            return FlowReply(f"Which supplier is the contract with?\n{lines}\n\nTell me the supplier name.", [o["name"] for o in st["options"]], awaiting="contract_supplier")
        if not st.get("start"):
            return FlowReply("When should the contract start? For example “1 Nov” or “in 2 weeks”.", awaiting="contract_start")
        if not st.get("end"):
            return FlowReply("When should it end? For example “31 Oct 2027” or “in 12 months”.", awaiting="contract_end")
        if st.get("amount") is None:
            return FlowReply(f"What is the contract amount? The supplier quoted {_money(st['supplier']['total'])}; reply “same” to use it, or type an amount.", ["Same"], awaiting="contract_amount")
        name = st.get("name") or f"{rfq['title'][:80]} - {st['supplier']['name']}"
        st["name"] = name
        dto = {"contractName": name, "rfqId": rfq["id"], "supplierId": st["supplier"]["id"], "startDate": st["start"], "endDate": st["end"], "amount": st["amount"], "attachments": None}
        st["dto"] = dto
        note = "" if rfq.get("status", "").upper() == "AWARDED" else f" Note: {rfq['number']} is not marked AWARDED yet, and the buyer system may refuse a contract."
        return FlowReply(f"Contract to create: “{name}” with {st['supplier']['name']} for {_money(st['amount'])}, {st['start'][:10]} to {st['end'][:10]}.{note} Say **confirm** to create it or **cancel**.",
                         ["Confirm", "Cancel"], awaiting="confirm_action", needs_confirmation=True)

    def contract_consume(self, st: dict[str, Any], awaiting: str, text: str) -> str | None:
        today = self.now.date()
        if awaiting == "contract_supplier":
            picks = parse_choices(text, len(st["options"]))
            by = pick_by_name(text, [o["name"] for o in st["options"]])
            idx = picks[0] if picks else by
            if idx is None:
                return "I could not match that to one of the suppliers. Please type the supplier name as listed."
            st["supplier"] = st["options"][idx]
        elif awaiting in ("contract_start", "contract_end"):
            dt = parse_date(text, today)
            if dt is None and (m := re.search(r"in\s+(\d+)\s+months?", text.lower())):
                dt = parse_date(f"in {int(m.group(1)) * 30} days", today)
            if dt is None:
                return "I could not read a date from that."
            iso = datetime.combine(dt, time(0, 0), tzinfo=timezone.utc).isoformat()
            if awaiting == "contract_end" and iso <= st["start"]:
                return "The end date must be after the start date."
            st["start" if awaiting == "contract_start" else "end"] = iso
        elif awaiting == "contract_amount":
            if re.search(r"\b(same|quoted|as quoted|yes)\b", text.lower()):
                st["amount"] = st["supplier"]["total"]
            else:
                v = parse_amount(text)
                if v is None or v <= 0:
                    return "Please give an amount, or say “same”."
                st["amount"] = v
        return None


# ============================================================================
# The conversation engine: one message in, one reply out, state kept in the database between messages.
# ============================================================================

QUERY_INTENTS = {"list_rfqs", "rfq_details", "compare", "purchase_orders", "search_items", "search_suppliers", "help"}
MAX_HISTORY = 200


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChatEngine:
    def __init__(self, db: Session, gw: BuyerGateway, organization_id: str, user_id: str, now: datetime | None = None,
                 permissions: frozenset[str] | None = None, buyer_id: str | None = None) -> None:
        self.db, self.gw, self.org, self.user = db, gw, organization_id, user_id
        self.permissions, self.buyer_id = permissions, buyer_id  # from Identity's token-claim; None = unknown (the services still enforce theirs)
        self.now = now or _now()
        self._refdata: RefData | None = None
        self._s: ChatSession | None = None  # the session of the turn in progress

    # ================================================================ sessions
    def _session(self, session_id: uuid.UUID | None) -> ChatSession:
        if session_id is not None:
            s = self.db.get(ChatSession, session_id)
            if s is None or s.organization_id != self.org or s.user_id != self.user:
                # Same answer for a made-up id and for someone else's conversation, so ids cannot be probed.
                raise NotFound("Conversation not found. To start a new one, leave session_id out (or null); to continue, use the session_id from the previous reply.")
            return s
        s = ChatSession(organization_id=self.org, user_id=self.user, state={})
        self.db.add(s)
        self.db.flush()
        return s

    def list_sessions(self, limit: int = 30) -> list[ChatSession]:
        return list(self.db.execute(select(ChatSession).where(ChatSession.organization_id == self.org, ChatSession.user_id == self.user)
                                    .order_by(ChatSession.updated_at.desc()).limit(limit)).scalars())

    def get_session(self, session_id: uuid.UUID) -> ChatSession:
        return self._session(session_id)

    def delete_session(self, session_id: uuid.UUID) -> None:
        self.db.delete(self._session(session_id))
        self.db.commit()

    def _log(self, s: ChatSession, role: str, content: str, data: dict[str, Any] | None = None) -> None:
        seq = (self.db.execute(select(ChatMessage.seq).where(ChatMessage.session_id == s.id).order_by(ChatMessage.seq.desc()).limit(1)).scalar_one_or_none() or 0) + 1
        if seq > MAX_HISTORY:
            raise ProcurementError("This conversation is very long. Please start a new one.")
        self.db.add(ChatMessage(session_id=s.id, seq=seq, role=role, content=content, data=data))

    def _save_state(self, s: ChatSession, state: dict[str, Any]) -> None:
        s.state = dict(state)  # a new dict, so the JSON column is seen as changed
        self.db.commit()

    # ================================================================ one turn
    def message(self, text: str, session_id: uuid.UUID | None = None, item_choices: list[ItemChoice] | None = None) -> ChatReply:
        self._item_choices = item_choices
        s = self._s = self._session(session_id)
        state: dict[str, Any] = dict(s.state or {})
        if not s.title:
            s.title = text.strip()[:80]
        self._log(s, "user", text)
        self._save_state(s, state)  # the user's words are kept even if something below fails

        try:
            reply = self._route(s, state, text)
        except GatewayError as e:
            reply = FlowReply(e.message, awaiting=state.get("last_awaiting"))
        flow = state.get("flow")
        state["last_prompt"], state["last_awaiting"] = (reply.text, reply.awaiting) if flow else (None, None)
        out = ChatReply(session_id=s.id, reply=reply.text, suggestions=reply.suggestions, tables=reply.tables, awaiting=reply.awaiting,
                        needs_confirmation=reply.needs_confirmation, flow=state.get("flow"), data=reply.data)
        self._log(s, "assistant", reply.text, {"tables": [t.model_dump() for t in reply.tables], "suggestions": reply.suggestions, "awaiting": reply.awaiting,
                                                "data": reply.data})
        self._save_state(s, state)
        return out

    def _route(self, s: ChatSession, state: dict[str, Any], text: str) -> FlowReply:
        flow = state.get("flow")
        if is_cancel(text):
            if flow:
                state.pop("flow", None), state.pop("draft", None), state.pop("action", None), state.pop("contract", None)
                return FlowReply("Okay, I discarded that. Nothing was sent or changed.", ["Create an RFQ", "Show my RFQs"])
            return FlowReply("There is nothing in progress to cancel.")

        if flow == "executing":
            return FlowReply("I am still carrying out your last confirmed action, or it was interrupted. Check the result with “show my RFQs” before trying again; "
                             "say **cancel** to clear this.")
        ops = Ops(self.gw, self._ref(), state.setdefault("ctx", {}), self.now)
        intent = classify(text)
        if intent and (not flow or intent in QUERY_INTENTS) and (refusal := missing_permission(intent, self.permissions)):
            return FlowReply(refusal, ["Help"])  # nothing is started, and a draft in progress is left as it was

        if flow == "create_rfq":
            draft = RfqDraft.model_validate(state["draft"])
            if intent == "create_rfq" and draft.stage != "sending":
                return FlowReply("You already have an RFQ draft open. Say **cancel** to discard it first, or keep answering. Here is where we are:\n\n" + state.get("last_prompt", ""),
                                 awaiting=state.get("last_awaiting"))
            if intent in QUERY_INTENTS and draft.awaiting != "confirm" and self._is_clear_query(text, intent):
                side = self._query(ops, intent, text, state)
                side.text += "\n\n(Your RFQ draft is still open.) " + state.get("last_prompt", "")
                side.awaiting = state.get("last_awaiting")
                return side
            rf = self._rfq_flow(state)
            try:
                if self._item_choices and draft.awaiting == "item_match":
                    r = rf.apply_item_choices(draft, self._item_choices)
                else:
                    r = rf.handle(draft, text)
            finally:
                state["draft"] = draft.model_dump()  # keep this turn's changes even if a service call failed half-way
            if r.done:
                state.pop("flow", None), state.pop("draft", None)
                if r.data.get("rfq_id"):  # "compare bids" right after creating an RFQ means that RFQ
                    state.setdefault("ctx", {})["last_rfq"] = {"id": r.data["rfq_id"], "number": r.data.get("rfq_number") or "", "title": draft.purpose or "", "status": "Open", "end": (draft.end_date or "")[:10]}
            return r

        if flow == "confirm_action":
            return self._confirm_action(state, ops, text)
        if flow == "contract":
            return self._contract_turn(state, ops, text)
        if flow == "pick_rfq":
            return self._pick_rfq(state, ops, text)
        if flow == "award_strategy":
            rfq, payload = state["pending"]["rfq"], state["pending"]
            return self._start_award(state, ops, rfq, payload["text"] + " " + text)

        if intent == "create_rfq":
            rf = self._rfq_flow(state)
            draft, r = rf.start(text)
            state["flow"], state["draft"] = "create_rfq", draft.model_dump()
            return r
        if intent in QUERY_INTENTS:
            return self._query(ops, intent, text, state)
        if intent in ("award", "unaward", "freeze", "contract"):
            rfq, ask = ops.resolve_rfq(text, intent)
            if rfq is None:
                state["flow"] = "pick_rfq"
                return ask  # type: ignore[return-value]
            return self._start_action(state, ops, intent, rfq, text)
        listed = [x for x in split_list(text) if re.search(_QTY, x, flags=re.I)]
        if listed and len(listed) == len(split_list(text)):  # “chicken 20 kg and meat 10 kg”: items with amounts, but no request
            offer = "create an RFQ for " + ", ".join(listed)
            return FlowReply(f"Do you want to create an RFQ for these items? Say “{offer}”.", [offer, "Help"])
        return FlowReply("I am not sure what you would like to do. You can say things like “create an RFQ for chicken and shrimp”, “show my open RFQs”, "
                         "or “compare bids for RFQ-…”. Say “help” to see everything I can do.", ["Help", "Create an RFQ", "Show my RFQs"])

    # ================================================================ helpers
    def _ref(self) -> RefData:
        """One reference-data cache per turn, shared by the flows, so profile and units are fetched at most once."""
        if self._refdata is None:
            self._refdata = RefData(self.gw, self.buyer_id)
        return self._refdata

    def _rfq_flow(self, state: dict[str, Any]) -> RfqFlow:
        def persist(draft: RfqDraft) -> None:
            state["draft"], state["flow"] = draft.model_dump(), "create_rfq"
            self._save_state(self._s, state)  # saved at every step; in particular BEFORE the RFQ is sent

        rf = RfqFlow(self.gw, self.now, persist)
        rf.ref = self._ref()
        return rf

    def _permission_note(self) -> str:
        if self.permissions is None:
            return ""
        can = capabilities(self.permissions)
        yes = [PERMISSION_FOR[k][1] for k, v in can.items() if v]
        no = [PERMISSION_FOR[k][1] for k, v in can.items() if not v]
        return "\n\nWith your permissions you can: " + (", ".join(yes) or "nothing here") + "." + (f" You cannot: {', '.join(no)}." if no else "")

    @staticmethod
    def _is_clear_query(text: str, intent: str) -> bool:
        """During an RFQ draft, only an unmistakable question is answered on the side; anything else is an answer to the draft's question."""
        t = text.lower().strip()
        if intent == "help":
            return True
        return bool(re.match(r"(show|list|find|search|what|which|compare|details?|status|how many|display|view)\b", t)) and bool(re.search(r"rfq|supplier|item|purchase|order|bid|quote", t))

    def _query(self, ops: Ops, intent: str, text: str, state: dict[str, Any]) -> FlowReply:
        if intent == "help":
            return FlowReply(HELP + self._permission_note(), ["Create an RFQ", "Show my RFQs"])
        if intent == "list_rfqs":
            return ops.list_rfqs(text)
        if intent == "purchase_orders":
            return ops.purchase_orders()
        if intent == "search_items":
            return ops.search_items(text)
        if intent == "search_suppliers":
            return ops.search_suppliers(text)
        rfq, ask = ops.resolve_rfq(text, intent)
        if rfq is None:
            state["flow"] = "pick_rfq"
            return ask  # type: ignore[return-value]
        return ops.compare(rfq) if intent == "compare" else ops.details(rfq)

    def _start_action(self, state: dict[str, Any], ops: Ops, intent: str, rfq: dict[str, Any], text: str) -> FlowReply:
        state["ctx"]["last_rfq"] = rfq
        if intent == "freeze":
            plan, r = ops.freeze(rfq)
        elif intent == "unaward":
            plan, r = ops.unaward(rfq)
        elif intent == "award":
            return self._start_award(state, ops, rfq, text)
        else:  # contract
            st, r = ops.contract_start(rfq, text)
            if r.awaiting or r.needs_confirmation:
                state["flow"], state["contract"] = "contract", st
            return r
        state["flow"], state["action"] = "confirm_action", plan
        return r

    def _start_award(self, state: dict[str, Any], ops: Ops, rfq: dict[str, Any], text: str) -> FlowReply:
        plan, r = ops.award_plan(rfq, text)
        if plan is not None:
            state["flow"], state["action"] = "confirm_action", plan
            state.pop("pending", None)
        elif r.awaiting == "award_strategy":
            state["flow"], state["pending"] = "award_strategy", {"rfq": rfq, "text": text}
        else:
            state.pop("flow", None)
        return r

    def _confirm_action(self, state: dict[str, Any], ops: Ops, text: str) -> FlowReply:
        plan = state["action"]
        phrase = plan.get("phrase")
        ok = bool(re.fullmatch(rf"\s*{re.escape(phrase)}[\s.!]*", norm(text).lower())) if phrase else is_confirm(text)
        if not ok:
            return FlowReply((f"To proceed type exactly **{phrase}**, or say **cancel**." if phrase else "Say **confirm** to proceed, or **cancel**."),
                             [phrase.title() if phrase else "Confirm", "Cancel"], awaiting="confirm_action", needs_confirmation=True)
        state["flow"] = "executing"
        self._save_state(self._s, state)  # saved BEFORE the call: a repeated "confirm" then sees 'executing' instead of acting twice
        r = ops.execute(plan)
        if r.done:
            state.pop("flow", None), state.pop("action", None)
        else:
            state["flow"] = "confirm_action"
        return r

    def _contract_turn(self, state: dict[str, Any], ops: Ops, text: str) -> FlowReply:
        st, awaiting = state["contract"], state.get("last_awaiting")
        if awaiting == "confirm_action":
            if is_confirm(text):
                state["flow"] = "executing"
                self._save_state(self._s, state)
                r = ops.execute({"action": "contract", "rfq": st["rfq"], "dto": st["dto"]})
                if not r.done:
                    state["flow"] = "contract"
                if r.done:
                    state.pop("flow", None), state.pop("contract", None)
                return r
            return FlowReply("Say **confirm** to create the contract, or **cancel**.", ["Confirm", "Cancel"], awaiting="confirm_action", needs_confirmation=True)
        problem = ops.contract_consume(st, awaiting or "", text)
        r = ops.contract_next(st)
        if problem:
            r.text = problem + "\n\n" + r.text
        return r

    def _pick_rfq(self, state: dict[str, Any], ops: Ops, text: str) -> FlowReply:
        shown = state["ctx"].get("rfqs") or []
        pending = state["ctx"].get("pending_pick") or {}
        picks: list[int] = []
        if m := re.search(r"RFQ-\d{6,}", text, re.I):
            picks = [i for i, r in enumerate(shown) if r["number"].upper() == m.group(0).upper()]
        if not picks and (named := pick_by_name(text, [r["title"] for r in shown if r["title"]])) is not None:
            picks = [named]  # typed by title
        if not picks:
            picks = parse_choices(text, len(shown))  # a row number from the table still works
        if len(picks) != 1:
            return FlowReply("Please tell me the RFQ number (for example " + (shown[0]["number"] if shown else "RFQ-…") + ") or the title of one RFQ in the list.",
                             [r["number"] for r in shown if r["number"]], awaiting="pick_rfq")
        rfq = shown[picks[0]]
        state.pop("flow", None)
        intent, original = pending.get("intent", "rfq_details"), pending.get("text", "")
        if intent in ("compare", "rfq_details"):
            return ops.compare(rfq) if intent == "compare" else ops.details(rfq)
        return self._start_action(state, ops, intent, rfq, original)


# ============================================================================
# The buyer assistant's REST API, mounted under /api/v1 (exposed through the gateway as "Python API's v1").
# ============================================================================

def current_token(request: Request) -> str | None:
    """The caller's access token (Bearer header, else cookie), exactly as received. Forwarded to the .NET services, which validate it themselves."""
    return extract_token(request.cookies, request.headers.get("authorization"))


# Declares the Bearer scheme in the OpenAPI document, so Swagger shows an Authorize button where the access_token value can be pasted.
bearer_scheme = HTTPBearer(auto_error=False, description="The value of the access_token cookie (copy it from the browser's DevTools after logging in).")
# The X-Actor-* test headers are shown in Swagger only when they are enabled.
_SHOW_TEST_HEADERS = procureiq_settings.dev_headers


def current_actor(
    request: Request,
    _bearer: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_actor_id: str | None = Header(default=None, include_in_schema=_SHOW_TEST_HEADERS),
    x_actor_type: str = Header(default=ActorType.USER.value, include_in_schema=_SHOW_TEST_HEADERS),
    x_actor_roles: str = Header(default="", include_in_schema=_SHOW_TEST_HEADERS),
    x_tenant_id: str | None = Header(default=None, include_in_schema=_SHOW_TEST_HEADERS),
) -> Actor:
    cfg = procureiq_settings
    token = current_token(request)
    if token:  # a login token decides who this is; any X-Actor-* headers sent with it are ignored
        try:  # Identity validates the token and says who it is and what it may do
            claims = fetch_claims(token, cfg)
        except IdentityRejected as e:
            raise (Unauthorized if e.status == 401 else Forbidden)(str(e)) from None
        except IdentityUnavailable as e:
            raise ServiceUnavailable(f"{e} Try again in a moment.") from None
        kind = ActorType.SUPPLIER if claims.org_type == "supplier" else ActorType.USER
        return Actor(id=claims.user_id, type=kind, roles=roles_for(claims.org_type, claims.role_id, cfg.role_map), tenant_id=claims.organization_id,
                     permissions=claims.permissions, buyer_id=claims.buyer_id)
    if not cfg.dev_headers:
        raise Unauthorized("Authentication required: sign in first (the access_token cookie).")
    if not x_actor_id or not x_tenant_id:
        raise Forbidden("Missing identity headers.")
    try:
        actor_type = ActorType(x_actor_type)
    except ValueError:
        raise Forbidden("Unknown actor type.") from None
    roles = frozenset(r.strip() for r in x_actor_roles.split(",") if r.strip())
    return Actor(id=x_actor_id.strip()[:200], type=actor_type, roles=roles, tenant_id=x_tenant_id.strip()[:100])


router = APIRouter(prefix="/api/v1", tags=["buyer-assistant"])


def install_error_handlers(app) -> None:  # type: ignore[no-untyped-def]
    @app.exception_handler(ProcurementError)
    async def _procurement_error(request: Request, exc: ProcurementError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"error": exc.code, "message": exc.message})


def buyer_gateway(request: Request) -> Iterator[BuyerGateway]:
    """Calls to the .NET services are made with the caller's own token, so their permission checks apply to the chatbot as to the person."""
    gw = HttpBuyerGateway(current_token(request))
    try:
        yield gw
    finally:
        gw.close()


def _engine(session: Session, gw: BuyerGateway, actor: Actor) -> ChatEngine:
    return ChatEngine(session, gw, actor.tenant_id, actor.id, permissions=actor.permissions, buyer_id=actor.buyer_id)


def _buyer_only(actor: Actor) -> None:
    if actor.type is not ActorType.USER or "buyer" not in actor.roles:
        raise Forbidden("The buyer assistant is for buyer users.")


def _session_out(s: ChatSession, with_messages: bool) -> SessionOut:
    return SessionOut(
        id=s.id, title=s.title, flow=(s.state or {}).get("flow"), updated_at=s.updated_at.isoformat(),
        messages=[{"role": m.role, "content": m.content, **(m.data or {})} for m in s.messages] if with_messages else [])


@router.post("/chat/message", response_model=ChatReply)
def chat_message(body: ChatRequest, session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    """Talk to the buyer assistant. Omit `session_id` to start a conversation; send it back to continue one."""
    _buyer_only(actor)
    return _engine(session, gw, actor).message(body.message, body.session_id, body.item_choices)


@router.get("/chat/sessions", response_model=list[SessionOut])
def chat_sessions(session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    _buyer_only(actor)
    return [_session_out(s, False) for s in _engine(session, gw, actor).list_sessions()]


@router.get("/chat/sessions/{session_id}", response_model=SessionOut)
def chat_session(session_id: uuid.UUID, session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    _buyer_only(actor)
    return _session_out(_engine(session, gw, actor).get_session(session_id), True)


@router.delete("/chat/sessions/{session_id}", status_code=204)
def chat_delete(session_id: uuid.UUID, session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    _buyer_only(actor)
    _engine(session, gw, actor).delete_session(session_id)


class MaterialGroupOut(BaseModel):
    material_group: str
    items: int  # item-master entries in this group
    example: str | None  # one item of the group, to make the name recognisable


@router.get("/chat/material-groups", response_model=list[MaterialGroupOut])
def chat_material_groups(search: str | None = None, session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    """Every material group in the buyer's item master (the Buyer API has no list of its own, so they are read from the item-master entries, paged).
    `search` narrows the groups by name, for example `search=frozen`. Use a name from here as the group of a free-text RFQ item."""
    _buyer_only(actor)
    found = collect_material_groups(gw, actor.buyer_id)
    seen = {g: MaterialGroupOut(material_group=g, items=n, example=ex) for g, (n, ex) in found.items()}
    out = sorted(seen.values(), key=lambda x: x.material_group.lower())
    return [o for o in out if not search or search.lower() in o.material_group.lower()]


class ItemMasterEntry(BaseModel):
    code: str
    group: str
    description: str


@router.get("/chat/item-master", response_model=list[ItemMasterEntry])
def chat_item_master(session: Session = Depends(get_session), actor: Actor = Depends(current_actor), gw: BuyerGateway = Depends(buyer_gateway)):
    """Every entry of the buyer's item master (code, material group, description), for choosing the entry of an item in the item table."""
    _buyer_only(actor)
    return collect_item_master(gw, actor.buyer_id)


class ActionAccess(BaseModel):
    action: str
    permission: str
    allowed: bool | None  # None when this login's permissions are not known (the .NET services still decide)


class ChatMe(BaseModel):
    user_id: str
    organization_id: str
    buyer_id: str | None
    roles: list[str]
    permissions_known: bool
    can: list[ActionAccess]
    permissions: list[str]


@router.get("/chat/me", response_model=ChatMe)
def chat_me(actor: Actor = Depends(current_actor)):
    """Who the assistant thinks you are (from the Identity service) and which of its actions your permissions allow."""
    _buyer_only(actor)

    perms = actor.permissions
    return ChatMe(user_id=actor.id, organization_id=actor.tenant_id, buyer_id=actor.buyer_id, roles=sorted(actor.roles), permissions_known=perms is not None,
                  can=[ActionAccess(action=text, permission=key, allowed=None if perms is None else key in perms) for key, text in PERMISSION_FOR.values()],
                  permissions=sorted(perms) if perms else [])
