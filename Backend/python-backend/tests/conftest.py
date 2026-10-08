import dataclasses

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import rfp
from app.rfp import Base, get_session


@pytest.fixture()
def session_factory():
    # One shared in-memory connection for the whole test.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


@pytest.fixture()
def session(session_factory):
    with session_factory() as s:
        yield s


@pytest.fixture()
def client(session_factory):
    app = FastAPI()
    app.include_router(rfp.router)
    rfp.install_error_handlers(app)

    def _session():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    return TestClient(app)


def headers(actor="alice", roles="buyer", tenant="acme", actor_type="user"):
    return {"X-Actor-Id": actor, "X-Actor-Roles": roles, "X-Tenant-Id": tenant, "X-Actor-Type": actor_type}


@pytest.fixture(autouse=True)
def _test_headers_on(monkeypatch):
    """Production leaves the X-Actor-* test headers off. The tests use them as a convenient identity, so they switch them on for themselves only."""
    monkeypatch.setattr(rfp, "procureiq_settings", dataclasses.replace(rfp.procureiq_settings, dev_headers=True, buyer_url="http://buyer", masterdata_url="http://md", supplier_url="http://sup", identity_url="http://id",
                                                                    default_verification_template_id="tmpl-test"))
    rfp.clear_cache()
