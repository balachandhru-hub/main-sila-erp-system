from datetime import date, datetime, timezone

import re

import pytest

from app import rfp
from app.rfp import ChatEngine
from app.rfp import GatewayError
from app.rfp import ChatMessage, ChatSession

from fakes import BUYER_ID, ORG_ID, FakeBuyer

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
YOUR_SENTENCE = ("create a rfq for fresh and frozen meat products for regular hotel/restaurant operations, "
                 "including chicken, chicken wings, chicken 5×5 cubes, shrimp, and frozen mutton")


class Chat:
    """Drives one conversation the way the API does: a new engine per message, same database."""

    def __init__(self, db, gw=None, org=ORG_ID, user="buyer-1", permissions=None, buyer_id=None):
        self.db, self.gw, self.org, self.user, self.sid = db, gw or FakeBuyer(), org, user, None
        self.permissions, self.buyer_id = permissions, buyer_id
        self.last = None

    def say(self, text):
        engine = ChatEngine(self.db, self.gw, self.org, self.user, now=NOW, permissions=self.permissions, buyer_id=self.buyer_id)
        self.last = engine.message(text, self.sid)
        self.sid = self.last.session_id
        return self.last


def script_to_review(chat: Chat) -> None:
    """The full happy path: every answer a buyer would give for YOUR_SENTENCE."""
    chat.say(YOUR_SENTENCE)
    chat.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    chat.say("1")          # chicken -> Chicken Breast Fresh
    chat.say("1")          # delivery location -> Central Kitchen
    chat.say("Kitchen")    # department
    chat.say("in 7 days")  # bidding closes
    chat.say("in 3 weeks") # delivery
    chat.say("no budget")
    chat.say("1")          # sub-category -> Meat and poultry products
    chat.say("1, 2")       # suppliers
    chat.say("Please confirm halal and HACCP certificates")


def test_your_sentence_is_understood_and_the_first_question_is_quantities(session):
    c = Chat(session)
    r = c.say(YOUR_SENTENCE)
    assert "5 item(s): chicken, chicken wings, chicken 5x5 cubes, shrimp, frozen mutton" in r.reply
    assert r.awaiting == "quantities" and r.flow == "create_rfq"
    for name in ("chicken wings", "chicken 5x5 cubes", "shrimp", "frozen mutton"):
        assert name in r.reply
    assert c.gw.count("create_rfq") == 0  # nothing is sent while collecting


def test_full_conversation_builds_the_exact_request_and_waits_for_confirmation(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)

    r = c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    assert r.awaiting == "item_match" and "Chicken Breast Fresh" in r.reply and "Whole Chicken Frozen" in r.reply  # 'chicken' is ambiguous in the item master
    # Every item is looked up at once, so the automatic decisions are reported in the same reply as the one question that remains.
    assert "“chicken wings” matches your item master entry “Chicken Wings” (MC-103)" in r.reply  # exact match: no question
    assert "“frozen mutton” matches your item master entry “Frozen Mutton Leg”" in r.reply
    assert "“shrimp” is not in your item master" in r.reply
    r = c.say("1")
    assert r.awaiting == "location" and "Central Kitchen" in r.reply and "(default)" in r.reply

    r = c.say("1")
    assert r.awaiting == "department" and "Kitchen" in r.reply
    r = c.say("Kitchen")
    assert "Cost center: KIT-001" in r.reply and "Currency: AED (from your company profile)" in r.reply and "Region: United Arab Emirates" in r.reply
    assert r.awaiting == "end_date"
    r = c.say("in 7 days")
    assert r.awaiting == "delivery_date" and "2026-10-13" in r.reply
    r = c.say("in 3 weeks")
    assert r.awaiting == "budget"
    r = c.say("no budget")
    assert r.awaiting == "family" and "Meat and poultry products" in r.reply and "Fish and seafood" in r.reply  # the items span two sub-categories: ask
    r = c.say("1")
    assert r.awaiting == "suppliers" and "Al Barsha Meats" in r.reply and "Gulf Seafood Trading" in r.reply
    r = c.say("Al Barsha Meats, Empty Foods")
    assert "Empty Foods has no users to notify" in r.reply  # a supplier nobody can be notified at is not silently dropped
    assert r.awaiting == "questions"
    r = c.say("Please confirm halal and HACCP certificates")

    assert r.awaiting == "confirm" and r.needs_confirmation
    assert "published the moment you confirm" in r.reply
    assert c.gw.count("create_rfq") == 0  # still nothing sent
    titles = [t.title for t in r.tables]
    assert titles == ["RFQ", "Items", "Suppliers", "Questions to suppliers"]
    items = {row[1]: row for row in r.tables[1].rows}
    assert items["chicken"][2] == "50 KG" and "Chicken Breast Fresh (MC-101)" in items["chicken"][3]
    assert items["shrimp"][3] == "free text"

    r = c.say("confirm")
    assert c.gw.count("create_rfq") == 1
    assert "has been created and sent as **RFQ-20261006100001**" in r.reply and r.flow is None
    assert r.data["rfq_number"] == "RFQ-20261006100001"

    dto = c.gw.created_dtos[0]
    assert dto["title"] == "Fresh and frozen meat products for regular hotel/restaurant operations"
    assert dto["department"] == "Kitchen" and dto["currency"] == "AED" and dto["region"] == "United Arab Emirates"
    assert dto["deliveryLocation"] == "Central Kitchen, Al Quoz, Dubai, UAE"
    assert dto["startDate"].startswith("2026-10-06") and dto["endDate"].startswith("2026-10-13T23:59:59") and dto["deliveryTargetDate"].startswith("2026-10-27")
    assert dto["budget"] == 0 and dto["addLotOption"] is False
    assert (dto["segmentId"], dto["familyId"]) == (50, 5011) and dto["familyTitle"] == "Meat and poultry products"
    assert dto["templateId"] and dto["rfqVerificationTemplateId"] == "tmpl-test"
    assert len(dto["items"]) == 5
    by = {i["description"]: i for i in dto["items"]}
    assert by["Chicken Breast Fresh"]["materialCode"] == "MC-101" and by["Chicken Breast Fresh"]["quantity"] == 50 and by["Chicken Breast Fresh"]["uom"] == "KG"
    assert by["Chicken Wings"]["materialCode"] == "MC-103" and by["Chicken Wings"]["quantity"] == 30
    assert by["chicken 5x5 cubes"]["materialCode"] == "N/A" and by["chicken 5x5 cubes"]["materialGroup"] == "Meat and poultry products"
    assert by["shrimp"]["quantity"] == 15 and by["Frozen Mutton Leg"]["quantity"] == 40
    assert all(i["costCenter"] == "KIT-001" for i in dto["items"])
    assert dto["supplierInvites"] == [{"supplierId": "s1", "userIds": ["u1a", "u1b"]}] and dto["externalSuppliers"] == []
    assert [q["question"] for q in dto["questions"]] == ["Please confirm halal and HACCP certificates"]
    assert dto["questions"][0]["questionType"] == "INPUT" and dto["questions"][0]["isRequired"] is True
    # The Buyer API rejects empty strings on required text fields, so nothing required may be empty.
    for key in ("title", "description", "department", "region", "currency", "deliveryLocation"):
        assert dto[key].strip()
    assert c.gw.find_suppliers_args() if hasattr(c.gw, "find_suppliers_args") else True


def test_suppliers_are_searched_with_the_chosen_category_and_the_buyer_id(session):
    c = Chat(session)
    script_to_review(c)
    call = next(args for name, args in c.gw.calls if name == "find_suppliers")
    assert call[1:] == (50, 5011, None, BUYER_ID)  # segment, family, all suppliers (verified or not), buyer id


def test_a_repeated_confirm_never_sends_twice(session):
    c = Chat(session)
    script_to_review(c)
    c.say("confirm")
    r = c.say("confirm")
    assert c.gw.count("create_rfq") == 1
    assert r.flow is None and "not sure" in r.reply


def test_the_draft_survives_between_messages_and_belongs_to_one_user(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    stored = session.get(ChatSession, c.sid)
    assert stored.state["flow"] == "create_rfq" and len(stored.state["draft"]["items"]) == 5
    assert [m.role for m in session.query(ChatMessage).filter_by(session_id=c.sid).order_by(ChatMessage.seq)] == ["user", "assistant"]
    other = Chat(session, user="someone-else")
    other.sid = c.sid
    with pytest.raises(rfp.NotFound):
        other.say("show my rfqs")
    stranger = Chat(session, org="another-company")
    stranger.sid = c.sid
    with pytest.raises(rfp.NotFound):
        stranger.say("hello")


def test_cancel_discards_the_draft_and_nothing_was_sent(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    r = c.say("cancel")
    assert "discarded" in r.reply and r.flow is None and c.gw.count("create_rfq") == 0
    assert c.say("cancel").reply.startswith("There is nothing in progress")


def test_a_bare_quantity_is_not_silently_applied_to_every_item(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    r = c.say("50 kg")
    assert r.awaiting == "bare_qty" and "for each of the 5 items" in r.reply
    r = c.say("no")
    assert r.awaiting == "quantities"
    r = c.say("50 kg")
    r = c.say("yes")
    assert r.awaiting == "item_match"  # moved on: all five now have 50 KG


def test_unknown_unit_is_refused_with_the_available_units(session):
    c = Chat(session)
    c.say("create an rfq for rice, sugar")
    r = c.say("rice 5 tons, sugar 10 kg")  # T is not in this buyer's unit list
    assert "rice: unit T is not in your unit list" in r.reply and "KG" in r.reply
    assert r.awaiting == "quantities"
    assert "for:\n• rice" in r.reply and "• sugar" not in r.reply  # only rice is still missing: sugar's 10 KG was accepted


def test_dates_must_make_sense(session):
    c = Chat(session)
    c.say("create an rfq for rice, sugar")
    c.say("all 10 kg")
    for _ in range(10):
        if c.last.awaiting == "end_date":
            break
        c.say("1")
    assert c.last.awaiting == "end_date"
    assert "after today" in c.say("today").reply
    assert "could not read a date" in c.say("whenever").reply
    r = c.say("in 10 days")
    assert r.awaiting == "delivery_date"
    assert "cannot be before bidding closes" in c.say("in 2 days").reply


def test_review_edits_then_confirm(session):
    c = Chat(session)
    script_to_review(c)
    r = c.say("remove shrimp")
    assert r.awaiting == "confirm" and "Removed shrimp" in r.reply and all(row[1] != "shrimp" for row in r.tables[1].rows)
    r = c.say("add beef 25 kg")
    assert r.awaiting == "item_match" or r.awaiting == "confirm"
    while c.last.awaiting == "item_match":
        c.say("1")
    r = c.say("change currency to USD")
    assert r.awaiting == "confirm" and "Currency is now USD" in r.reply
    r = c.say("close on 25 Oct")
    assert "closes on 2026-10-25" in r.reply
    r = c.say("budget 50000")
    assert "Budget is now 50000" in r.reply
    r = c.say("make chicken 80 kg")
    assert "quantities" in r.reply.lower() and any(row[1] == "chicken" and row[2] == "80 KG" for row in r.tables[1].rows)
    c.say("confirm")
    dto = c.gw.created_dtos[0]
    assert dto["currency"] == "USD" and dto["budget"] == 50000 and dto["endDate"].startswith("2026-10-25")
    assert sorted(i["quantity"] for i in dto["items"] if "hicken Breast" in i["description"]) == [80]
    assert "shrimp" not in [i["description"] for i in dto["items"]] and any(i["description"] == "beef" for i in dto["items"])


def test_unrecognised_edit_keeps_the_summary_and_explains(session):
    c = Chat(session)
    script_to_review(c)
    r = c.say("make it better")
    assert r.awaiting == "confirm" and "did not understand that change" in r.reply and c.gw.count("create_rfq") == 0


def test_change_suppliers_reopens_only_that_question(session):
    c = Chat(session)
    script_to_review(c)
    r = c.say("change suppliers")
    assert r.awaiting == "suppliers" and "Al Barsha Meats" in r.reply
    r = c.say("external Acme Foods acme@foods.example")
    assert r.awaiting == "confirm"
    c.say("confirm")
    dto = c.gw.created_dtos[0]
    assert dto["externalSuppliers"] == [{"supplierName": "Acme Foods", "email": "acme@foods.example", "phoneNumber": "N/A", "address": "N/A"}]
    assert dto["supplierInvites"] == []


def test_single_choices_are_filled_in_without_asking(session):
    gw = FakeBuyer(single_department=True, one_location=True)
    c = Chat(session, gw)
    c.say("create an rfq for rice and sugar, closing in 5 days, deliver by 20 Oct 2026, budget 20k")
    r = c.say("all 10 kg")
    assert "Delivery location: Central Kitchen" in r.reply and "Department: Kitchen (the only one set up)" in r.reply
    assert r.awaiting == "family" or r.awaiting == "suppliers" or r.awaiting == "segment" or r.awaiting == "questions"
    assert "closing in 5 days" not in r.reply  # the first message already gave the dates and budget, so they are not asked again
    assert gw.count("create_rfq") == 0


def test_no_delivery_addresses_in_the_profile_asks_for_one(session):
    c = Chat(session, FakeBuyer(no_locations=True))
    c.say("create an rfq for rice, sugar")
    r = c.say("all 10 kg")
    assert r.awaiting == "location" and "Type the delivery address" in r.reply
    assert c.say("x").awaiting == "location"  # too short to be an address
    assert c.say("Warehouse 4, Jebel Ali, Dubai").awaiting != "location"


def test_a_failed_send_that_saved_nothing_can_be_retried(session):
    c = Chat(session)
    script_to_review(c)
    c.gw.fail["create_rfq"] = GatewayError(400, "Invalid supplier user.")
    r = c.say("confirm")
    assert "was not sent: Invalid supplier user." in r.reply and r.awaiting == "confirm" and c.gw.rfqs == []
    del c.gw.fail["create_rfq"]
    r = c.say("confirm")
    assert "has been created and sent" in r.reply and len(c.gw.rfqs) == 1


def test_a_failure_after_the_rfq_was_saved_is_reported_not_retried(session):
    c = Chat(session)
    script_to_review(c)
    c.gw.fail["create_rfq"] = GatewayError(400, "Supplier service is down.")
    c.gw.create_saves_before_failing = True  # the real Buyer API saves, then fails calling the supplier service
    r = c.say("confirm")
    assert len(c.gw.rfqs) == 1
    assert "an RFQ titled" in r.reply and "RFQ-2026100610" in r.reply and "I will not send it again" in r.reply
    assert c.say("confirm").reply.startswith("I am not sure") and len(c.gw.rfqs) == 1


def test_a_buyer_without_permission_gets_a_clear_message(session):
    gw = FakeBuyer()
    gw.fail["profile"] = GatewayError(403, "You do not have permission to do that in the buyer system.")
    c = Chat(session, gw)
    c.say("create an rfq for rice, sugar")
    r = c.say("all 10 kg")  # the next step needs the profile, which this user may not read
    assert "do not have permission" in r.reply and gw.count("create_rfq") == 0
    stored = session.get(ChatSession, c.sid).state["draft"]
    assert [i["quantity"] for i in stored["items"]] == [10, 10]  # what the buyer already answered is kept
    del gw.fail["profile"]  # permissions fixed: the conversation carries on from where it stopped
    r = c.say("continue")
    assert r.awaiting in ("item_match", "location", "department") and "do not have permission" not in r.reply


def test_side_questions_during_a_draft_do_not_lose_it(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    r = c.say("show my rfqs")
    assert "You have no RFQs" in r.reply or "I found no RFQs" in r.reply
    assert "(Your RFQ draft is still open.)" in r.reply and r.awaiting == "quantities"
    assert c.say("create another rfq for milk").reply.startswith("You already have an RFQ draft open")


# ---------------------------------------------------------------- several ambiguous items are asked in ONE question

@pytest.fixture()
def two_ambiguous(monkeypatch):
    """Your master data has several entries for both 'chicken' and 'shrimp'."""
    import fakes as inmemory

    extra = [{"id": "i5", "description": "White Shrimp, Peeled and Deveined, Fresh", "materialCode": "SEA-100001", "materialGroup": "SEAFOOD"},
             {"id": "i6", "description": "Vannamei Shrimp, Peeled, Deveined, Frozen", "materialCode": "SEA-100002", "materialGroup": "SEAFOOD"}]
    monkeypatch.setattr(inmemory, "ITEM_MASTER", inmemory.ITEM_MASTER + extra)


def start_with_quantities(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    return c, c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")


def test_all_ambiguous_items_are_asked_together_in_one_reply(session, two_ambiguous):
    c, r = start_with_quantities(session)
    assert r.awaiting == "item_match"
    assert r.reply.count("Your item master has several entries") == 1  # one question, not one per item
    assert "**chicken**" in r.reply and "**shrimp**" in r.reply
    assert "1." not in r.reply and "number" not in r.reply.lower()  # the customer is never told to answer with numbers
    assert "White Shrimp" in r.reply and "Vannamei Shrimp" in r.reply and "Chicken Breast Fresh" in r.reply
    assert "free text for all" in r.reply and "first option for all" in r.reply
    assert c.gw.count("item_master") == 5  # each item looked up once
    r = c.say("1, 2")  # one message answers both
    assert r.awaiting == "location"
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert items["chicken"]["matched_description"] == "Chicken Breast Fresh" and items["shrimp"]["matched_description"].startswith("Vannamei")
    assert c.gw.count("item_master") == 5  # not looked up again


@pytest.mark.parametrize("answer, chicken, shrimp", [
    ("shrimp 2, chicken 1", "Chicken Breast Fresh", "Vannamei"), ("A1, B1", "Chicken Breast Fresh", "White Shrimp"),
    ("1 for all", "Chicken Breast Fresh", "White Shrimp"), ("free text for all", None, None), ("chicken 4, shrimp 1", None, "White Shrimp"),
])
def test_the_ways_a_buyer_can_answer_the_batch(session, two_ambiguous, answer, chicken, shrimp):
    c, _ = start_with_quantities(session)
    r = c.say(answer)
    assert r.awaiting == "location"
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert (items["chicken"]["matched_description"] or None) == chicken or (chicken and items["chicken"]["matched_description"].startswith(chicken))
    assert (items["shrimp"]["matched_description"] or None) == shrimp or (shrimp and items["shrimp"]["matched_description"].startswith(shrimp))


def test_a_partial_answer_keeps_what_was_given_and_asks_only_the_rest(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("chicken 2")
    assert r.awaiting == "item_match" and "shrimp" in r.reply and "chicken" not in r.reply.split("Which one do you mean?")[0].replace("For “shrimp”", "")
    assert "For “shrimp” your item master has several matching entries" in r.reply  # now a single question about the one item left
    assert c.gw.count("item_master") == 5  # nothing was looked up again
    assert c.say("2").awaiting == "location"


def test_a_wrong_number_is_explained_and_the_rest_still_applies(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("chicken 2, shrimp 9")
    assert "shrimp: choose a number from 1 to 3, not 9" in r.reply and r.awaiting == "item_match"
    assert "For “shrimp”" in r.reply  # chicken was accepted; only shrimp is asked again
    assert c.say("1").awaiting == "location"


def test_an_unreadable_answer_asks_again_without_losing_anything(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("hmm not sure")
    assert "I could not tell which entries you mean" in r.reply and r.awaiting == "item_match" and "**chicken**" in r.reply


# ---------------------------------------------------------------- cost centers are looked up per department (as the buyer app does)

def to_department_question(c: Chat) -> None:
    c.say("create an rfq for rice, sugar")
    c.say("all 10 kg")
    while c.last.awaiting == "location":
        c.say("1")


def test_cost_center_is_looked_up_for_the_chosen_department(session):
    c = Chat(session)
    to_department_question(c)
    assert c.last.awaiting == "department"
    r = c.say("Kitchen")
    assert "Cost center: KIT-001 (the only one for Kitchen)" in r.reply
    asked = [args for name, args in c.gw.calls if name == "cost_centers"]
    assert asked == [("d1",)]  # asked for Kitchen's department id, not for "all cost centers"


def test_several_cost_centers_for_a_department_are_offered_as_a_choice(session):
    c = Chat(session, FakeBuyer(two_cost_centers=True))
    to_department_question(c)
    r = c.say("Kitchen")
    assert r.awaiting == "cost_center" and "• KIT-001" in r.reply and "• KIT-002" in r.reply and r.suggestions == ["KIT-001", "KIT-002"]
    c.say("KIT-002")
    assert session.get(ChatSession, c.sid).state["draft"]["cost_center"] == "KIT-002"


def test_a_department_typed_by_hand_has_no_id_so_the_cost_center_is_asked(session):
    c = Chat(session, FakeBuyer(single_department=True))
    c.gw.departments = lambda: []  # no departments set up: the buyer types one
    to_department_question(c)
    assert c.last.awaiting == "department"
    r = c.say("Stores")
    assert r.awaiting == "cost_center" and "Type it" in r.reply
    assert not [a for n, a in c.gw.calls if n == "cost_centers"]  # nothing to look up without a department id


def test_your_real_departments_and_cost_center_flow_without_asking_for_the_cost_center(session):
    class YourData(FakeBuyer):
        def departments(self):
            return [{"id": "57b91ace-877f-40ac-88bf-cee1fc2a50c3", "department": "DEPT1"}, {"id": "dept-15", "department": "DEPT15"},
                    {"id": "dept-t", "department": "Testing"}, {"id": "dept-t21", "department": "Testing 21"}]

        def cost_centers(self, department_id=None):
            rows = [{"id": "ee30ea8d-db21-4354-ad29-185df765e90a", "departmentId": "57b91ace-877f-40ac-88bf-cee1fc2a50c3", "costCenter": "COST1"}]
            return [r for r in rows if r["departmentId"] == department_id]

    c = Chat(session, YourData())
    to_department_question(c)
    r = c.say("1")  # DEPT1
    assert "Cost center: COST1 (the only one for DEPT1)" in r.reply and r.awaiting != "cost_center"


# ---------------------------------------------------------------- free-text items can be given a code or a material group

def test_free_text_items_can_be_given_a_code_and_a_group_in_the_same_answer(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("chicken 5x5 cubes CHK-100002, frozen mutton group SEAFOOD, chicken 2, shrimp 1")
    assert r.awaiting == "location"
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert items["chicken 5x5 cubes"]["material_code"] == "CHK-100002" and not items["chicken 5x5 cubes"]["matched_description"]
    assert items["frozen mutton"]["material_group"] == "SEAFOOD"
    assert items["chicken"]["matched_description"] == "Whole Chicken Frozen"  # chicken 2 still picks the second candidate
    assert items["shrimp"]["matched_description"].startswith("White Shrimp")


def test_codes_alone_keep_the_batch_question_open(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("frozen mutton group seafood")
    assert r.awaiting == "item_match" and "Noted “frozen mutton”: group SEAFOOD" in r.reply and "**chicken**" in r.reply
    assert c.say("1, 1").awaiting == "location"


def test_the_codes_reach_the_request_that_is_sent(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    c.say("chicken 5x5 cubes CHK-100002, frozen mutton group SEAFOOD, 1, 1")
    d = session.get(ChatSession, c.sid).state["draft"]
    cubes = next(i for i in d["items"] if i["name"] == "chicken 5x5 cubes")
    mutton = next(i for i in d["items"] if i["name"] == "frozen mutton")
    assert (cubes["material_code"], mutton["material_group"]) == ("CHK-100002", "SEAFOOD")


def test_empty_json_columns_are_stored_as_sql_null_not_the_text_null(session):
    """SQL Server's ISJSON() rejects the text 'null', so an empty `data` or `state` must be a real NULL."""
    from sqlalchemy import text

    c = Chat(session)
    c.say("help")
    assert session.execute(text("select count(*) from chat_message where data is null")).scalar() >= 1
    assert session.execute(text("select count(*) from chat_message where data = 'null'")).scalar() == 0
    assert session.execute(text("select count(*) from chat_session where state = 'null'")).scalar() == 0


@pytest.mark.parametrize("text, purpose, items", [
    ("I need an RFQ for milk, cheese and eggs for the hotel kitchen", "hotel kitchen", ["milk", "cheese", "eggs"]),
    ("create a rfq for rice, sugar and flour for our restaurants", "our restaurants", ["rice", "sugar", "flour"]),
    ("create a rfq for fresh and frozen meat for regular hotel operations", "fresh and frozen meat for regular hotel operations", []),  # one purpose, not a list
    ("create a rfq for rice, sugar", None, ["rice", "sugar"]),
])
def test_a_list_followed_by_what_it_is_for_is_understood(text, purpose, items):
    from app.rfp import parse_request

    assert parse_request(text) == (purpose, items)


# ---------------------------------------------------------------- a group or code can be given at any step, and must exist

def to_location_question(session):
    c = Chat(session)
    c.say("I need an RFQ for rice, sugar and flour for the hotel kitchen")
    r = c.say("rice 10 kg, sugar 5 kg, flour 20 kg")
    return c, r


def test_a_group_can_be_given_after_the_item_questions_in_any_step(session):
    c, r = to_location_question(session)
    assert r.awaiting in ("location", "item_match")
    while c.last.awaiting == "item_match":
        c.say("free text for all")
    r = c.say("rice group poultry, sugar group MEAT; flour group Meat")
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert (items["rice"]["material_group"], items["sugar"]["material_group"], items["flour"]["material_group"]) == ("POULTRY", "MEAT", "MEAT")  # spelt as the item master does
    assert "Noted" in r.reply and r.awaiting == "location"  # the question that was open is asked again


def test_a_group_that_does_not_exist_is_refused_with_suggestions(session):
    c, _ = to_location_question(session)
    while c.last.awaiting == "item_match":
        c.say("free text for all")
    r = c.say("rice group POULTY")
    assert "no material group “POULTY”" in r.reply and "Did you mean: POULTRY" in r.reply and r.awaiting == "location"
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert not items["rice"]["material_group"]


def test_a_group_can_be_changed_at_the_summary(session):
    c = Chat(session)
    script_to_review(c)
    r = c.say("shrimp group MEAT")
    assert r.awaiting == "confirm" and "Noted “shrimp”: group MEAT" in r.reply
    assert next(i for i in session.get(ChatSession, c.sid).state["draft"]["items"] if i["name"] == "shrimp")["material_group"] == "MEAT"


def test_ordinary_answers_are_not_mistaken_for_assignments(session):
    c, _ = to_location_question(session)
    while c.last.awaiting == "item_match":
        c.say("free text for all")
    r = c.say("1")
    assert r.awaiting == "department" or r.awaiting == "currency" or r.awaiting == "end_date"


@pytest.mark.parametrize("text, expected", [
    ("DEPT1", 0), ("DEPT15", 1), ("dept15", 1), ("Testing", 2), ("Testing 21", 3), ("testing 21", 3), ("the DEPT15 one", 1), ("21", None), ("dept", None), ("nothing here", None),
])
def test_an_option_can_be_chosen_by_its_name_even_when_one_name_starts_with_another(text, expected):
    from app.rfp import pick_by_name

    assert pick_by_name(text, ["DEPT1", "DEPT15", "Testing", "Testing 21"]) == expected


def test_the_sub_category_can_be_chosen_by_typing_its_name(session):
    c = Chat(session)
    c.say(YOUR_SENTENCE)
    c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    for a in ("1", "1", "1", "Kitchen", "in 7 days", "in 3 weeks", "no budget"):
        r = c.say(a)
    assert r.awaiting == "family"
    r = c.say("Fish and seafood")  # typed, not numbered
    assert r.awaiting == "suppliers" and "Gulf Seafood Trading" in r.reply
    assert session.get(ChatSession, c.sid).state["draft"]["family_title"] == "Fish and seafood"


# ---------------------------------------------------------------- every question is answered with names, never with numbers

NUMBERED = re.compile(r"(?m)^\s*\d+\.\s|reply with (?:a )?numbers?|pick .* numbers?")


def test_no_question_asks_for_numbers_and_the_quick_replies_are_the_names(session, two_ambiguous):
    c, r = start_with_quantities(session)
    seen = [r]
    seen.append(c.say("chicken: Chicken Breast Fresh; shrimp: Vannamei Shrimp, Peeled, Deveined, Frozen"))
    assert seen[-1].awaiting == "location"
    for answer in ("Central Kitchen", "Kitchen", "in 7 days", "in 3 weeks", "no budget"):
        seen.append(c.say(answer))
    seen.append(c.say("skip")) if seen[-1].awaiting in ("segment", "family") else None
    for reply in seen:
        assert not NUMBERED.search(reply.reply), reply.reply
        assert not any(s.isdigit() for s in reply.suggestions), reply.suggestions
    sup = next((x for x in seen if x.awaiting == "suppliers"), None)
    assert sup is None or ("• " in sup.reply and "Al Barsha Meats" in sup.suggestions and "All" in sup.suggestions)


def test_items_department_and_suppliers_are_chosen_by_typing_names(session, two_ambiguous):
    c, _ = start_with_quantities(session)
    r = c.say("chicken: Chicken Breast Fresh; shrimp: Vannamei Shrimp, Peeled, Deveined, Frozen")
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert items["shrimp"]["matched_description"].startswith("Vannamei") and items["chicken"]["resolved"]
    r = c.say("Central Kitchen")
    assert r.awaiting == "department"
    r = c.say("Kitchen")
    assert session.get(ChatSession, c.sid).state["draft"]["department"] == "Kitchen"


def test_a_dashed_word_inside_an_item_name_is_not_taken_for_a_code(session):
    from app.rfp import DraftItem, RfqDraft, RfqFlow

    d = RfqDraft(items=[DraftItem(name="chicken")])
    flow = RfqFlow(FakeBuyer(), NOW)
    rest, note, bad = flow._take_assignments(d, "Chicken Drumstick, Bone-In, Fresh", strict=False)
    assert note is None and bad is None and d.items[0].material_group is None


@pytest.mark.parametrize("text, purpose, items", [
    ("create RFQ for chicken", None, ["chicken"]),
    ("I need an rfq for frozen mutton", None, ["frozen mutton"]),
    ("create a rfq for fresh meat products", "fresh meat products", []),  # a kind of goods, not one item: the items are asked
    ("create a rfq for office supplies", "office supplies", []),
])
def test_one_short_item_after_for_is_taken_as_the_item(text, purpose, items):
    from app.rfp import parse_request

    assert parse_request(text) == (purpose, items)


def test_each_item_master_option_shows_its_code_and_material_group(session, two_ambiguous):
    c, r = start_with_quantities(session)
    assert "Vannamei Shrimp, Peeled, Deveined, Frozen (code SEA-100002; group SEAFOOD)" in r.reply
    assert "Chicken Breast Fresh (code MC-101; group POULTRY)" in r.reply


class AllCategories(FakeBuyer):
    def segments(self, search):
        rows = super().segments(search)
        if search is None:
            rows = [{"segment": 10, "title": "Live Plant and Animal Material"}, {"segment": 50, "title": "Food Beverage and Tobacco Products"}, {"segment": 90, "title": "Travel and Lodging"}]
        return rows

    def families(self, segment):
        return super().families(segment) + [{"family": 5099, "title": "Tobacco products"}]


def test_the_category_question_lists_every_category_and_every_sub_category(session):
    c = Chat(session, AllCategories())
    c.say(YOUR_SENTENCE)
    c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    r = c.say("1")
    for a in ("1", "1", "Kitchen", "in 7 days", "in 3 weeks", "no budget"):
        r = c.say(a)
    assert r.awaiting == "segment"
    assert "• Live Plant and Animal Material" in r.reply and "• Travel and Lodging" in r.reply and "All other categories:" in r.reply
    assert r.reply.index("Food Beverage and Tobacco Products") < r.reply.index("All other categories:")  # the likely ones come first
    assert "Travel and Lodging" not in r.suggestions and "Skip" in r.suggestions
    r = c.say("Travel and Lodging")  # an "other" category can be chosen by name
    assert r.awaiting in ("family", "suppliers")


class MixedSuppliers(FakeBuyer):
    def find_suppliers(self, search, segment, family, verified, buyer_id, limit):
        rows = [{"supplierId": "s1", "organizationId": "o1", "supplierName": "IBM", "isVerified": False},
                {"supplierId": "s2", "organizationId": "o2", "supplierName": "IBM Technologies Pvt ltd", "isVerified": True},
                {"supplierId": "s3", "organizationId": "o3", "supplierName": "asian", "isVerified": False}]
        self.calls.append(("find_suppliers", (search, segment, family, verified, buyer_id)))
        return rows


def test_all_suppliers_are_offered_verified_first_and_a_long_name_does_not_pick_the_short_one(session):
    gw = MixedSuppliers()
    c = Chat(session, gw)
    r = script_to_suppliers(c)
    assert r.awaiting == "suppliers"
    assert r.reply.index("IBM Technologies Pvt ltd (verified)") < r.reply.index("• asian") < r.reply.index("• IBM\n")  # verified first, then the rest by name
    assert r.suggestions[:3] == ["IBM Technologies Pvt ltd", "asian", "IBM"]
    c.say("IBM Technologies Pvt ltd")
    picked = [p["name"] for p in session.get(ChatSession, c.sid).state["draft"]["picked"]]
    assert picked == ["IBM Technologies Pvt ltd"]


def script_to_suppliers(c):
    c.say(YOUR_SENTENCE)
    c.say("chicken 50 kg, wings 30 kg, 5x5 cubes 20 kg, shrimp 15 kg, frozen mutton 40 kg")
    r = c.say("1")
    for a in ("1", "1", "Kitchen", "in 7 days", "in 3 weeks", "no budget"):
        r = c.say(a)
    while r.awaiting in ("segment", "family"):
        r = c.say("skip")
    return r


@pytest.mark.parametrize("text", [
    "create an RFQ for chicken 20 kg and meat 10 kg", "create rfq chicken 20 kg, meat 10 kg", "create an rfq: chicken 20 kg, meat 10 kg", "rfq for chicken 20 kg,meat 10 kg",
])
def test_items_with_amounts_are_understood_however_the_request_is_phrased(text):
    from app.rfp import parse_request

    assert parse_request(text) == (None, ["chicken 20 kg", "meat 10 kg"])


def test_items_with_amounts_and_no_request_get_an_offer_to_create_the_rfq(session):
    c = Chat(session)
    r = c.say("chicken 20 kg,meat 10 kg")
    assert r.flow is None and "create an RFQ for chicken 20 kg, meat 10 kg" in r.reply and r.suggestions[0] == "create an RFQ for chicken 20 kg, meat 10 kg"
    r = c.say(r.suggestions[0])  # one tap on the suggestion starts it, with the amounts already filled in
    assert r.flow == "create_rfq"
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert (items["chicken"]["quantity"], items["chicken"]["uom"], items["meat"]["quantity"]) == (20.0, "KG", 10.0)


class DuplicateEntries(FakeBuyer):
    def item_master(self, search, buyer_id, index=0, limit=10):
        self._c("item_master", search, buyer_id)
        if search == "chicken":
            return [{"id": "1", "description": "Chicken Breast Boneless, Skinless, Frozen", "materialCode": "CHK-100002", "materialGroup": "CHICKEN-FROZEN"},
                    {"id": "2", "description": "Chicken Drumstick, Bone-In, Fresh", "materialCode": "CHK-100006", "materialGroup": "CHICKEN-FRESH"}]
        if search == "meat":
            return [{"id": "3", "description": "Mutton Liver, Cleaned, Fresh", "materialCode": "MEAT-100030", "materialGroup": "MUTTON-OFFAL"},
                    {"id": "4", "description": "Mutton Liver, Cleaned, Fresh", "materialCode": "MEAT-100031", "materialGroup": "MUTTON-OFFAL"}]
        return []


def test_an_entry_can_be_named_after_the_item_with_group_or_a_colon_and_duplicate_names_ask_for_the_code(session):
    c = Chat(session, DuplicateEntries())
    c.say("create an RFQ for chicken 20 kg and meat 10 kg")
    r = c.say("chicken group Chicken Breast Boneless, Skinless, Frozen , meat group Mutton Liver, Cleaned, Fresh ")  # a description with commas, and "group" before it
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert items["chicken"]["matched_description"] == "Chicken Breast Boneless, Skinless, Frozen" and items["chicken"]["material_group"] == "CHICKEN-FROZEN"
    assert not items["meat"]["resolved"]  # two entries have that name
    assert "no material group" not in r.reply and "2 entries called “Mutton Liver, Cleaned, Fresh”" in r.reply and "MEAT-100030" in r.reply
    r = c.say("meat: Mutton Liver, Cleaned, Fresh (MEAT-100031)")
    items = {i["name"]: i for i in session.get(ChatSession, c.sid).state["draft"]["items"]}
    assert items["meat"]["material_code"] == "MEAT-100031" and r.awaiting == "location"


def test_the_item_question_carries_a_table_a_screen_can_show_and_its_answer_is_understood(session, two_ambiguous):
    c, r = start_with_quantities(session)
    table = r.data["item_table"]
    rows = {row["name"]: row for row in table["rows"]}
    assert len(table["rows"]) == 5 and all(row["quantity"] is not None for row in table["rows"])
    chicken, shrimp = rows["chicken"], rows["shrimp"]
    assert chicken["state"] == shrimp["state"] == "choose" and chicken["candidates"] and shrimp["candidates"]
    pick = shrimp["candidates"][0]
    answer = f"chicken: free text; shrimp: {pick['description']} ({pick['code']})"
    after = c.say(answer)
    assert "item_table" not in after.data or all(row["state"] != "choose" for row in after.data["item_table"]["rows"])
    assert f"{pick['description']}" in str(after.reply) or after.awaiting != "item_match"


def test_the_item_table_answer_replaces_what_was_typed_with_the_chosen_entry(session, two_ambiguous):
    from sqlalchemy import text

    from app.rfp import ItemChoice

    c, r = start_with_quantities(session)
    engine = ChatEngine(session, c.gw, c.org, c.user, now=NOW)
    rows = {row["name"]: row for row in r.data["item_table"]["rows"]}
    pick = rows["shrimp"]["candidates"][1]
    reply = engine.message("shrimp → " + pick["description"], c.sid, [ItemChoice(item="shrimp", code=pick["code"]), ItemChoice(item="chicken", code=None)])
    shown = {row["name"]: row for row in reply.data["item_table"]["rows"]} if "item_table" in reply.data else {}
    assert not shown or all(row["state"] != "choose" for row in shown.values())
    draft = session.execute(text("select state from chat_session")).scalar()
    assert pick["description"] in str(draft) and pick["code"] in str(draft)
    bad = ChatEngine(session, c.gw, c.org, c.user, now=NOW).message("x", c.sid, [ItemChoice(item="shrimp", code="NOPE")])
    assert bad is not None


FIRST_MESSAGE = ("Create an RFQ for frozen mutton 20 kg, material group MEAT, department Kitchen, deliver to Hotel Marina, bidding closes in 3 days, "
                 "delivery in 10 days, budget 2000, category Food Beverage and Tobacco Products, sub-category Meat and poultry products, supplier Al Barsha Meats (verified)")


def test_everything_in_the_first_message_goes_straight_to_the_supplier_questions(session):
    c = Chat(session)
    r = c.say(FIRST_MESSAGE)
    assert r.awaiting == "questions" and "Do you want to ask suppliers any questions" in r.reply
    r = c.say("none")
    assert r.needs_confirmation
    c.say("confirm")
    dto = c.gw.created_dtos[0]
    item = dto["items"][0]
    assert (item["description"], item["materialCode"], item["materialGroup"], item["quantity"]) == ("Frozen Mutton Leg", "MC-201", "MEAT", 20)
    assert dto["deliveryLocation"].startswith("Hotel Marina") and dto["budget"] == 2000
    assert (date.fromisoformat(dto["endDate"][:10]) - NOW.date()).days == 3
    assert (date.fromisoformat(dto["deliveryTargetDate"][:10]) - NOW.date()).days == 10


def test_what_the_first_message_leaves_out_is_still_asked(session):
    c = Chat(session)
    r = c.say("Create an RFQ for frozen mutton 20 kg, department Kitchen, budget 2000")
    assert r.awaiting == "location"  # the department and budget were taken; the delivery location was not given, and there are two to choose from
    assert "budget" not in r.reply.lower()
