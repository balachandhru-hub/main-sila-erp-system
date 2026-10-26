import { getProperties, type Property } from "../propertyApi";
import { getInventoryTransactions, getLocations, type SilaLocation } from "./silaInventoryApi";
import { getErpPostings, reprocessErpPosting, type SilaErpPosting } from "./silaReceivingApi";
import { getTransfer } from "./silaMovementsApi";
import type { SilaTrackerPage, SilaTrackerQuery, SilaTrackerReprocessResult, SilaTrackerRow, SilaTrackerSummary } from "./silaTrackerApi";

const PAGE = 200;
const MAX_ROWS = 1000;
const API_TRANSFER = "FIVE S4 - Transfer Stock";
const API_PLANT_TRANSFER = "FIVE S4 - Plant Transfer Stock";

const emptySummary = (): SilaTrackerSummary => ({
  total: 0,
  processing: 0,
  successful: 0,
  failed: 0,
  reprocessing: 0,
  needsAttention: 0,
});

interface Stages {
  receive: string;
  erp: string;
  local: string;
  overall: string;
  action: string;
  reprocessFrom: string | null;
  erpCallAllowed: boolean;
}

interface Place {
  property?: string;
  plant?: string;
  storage?: string;
  company?: string;
}

const same = (left?: string | null, right?: string | null): boolean =>
  (left ?? "").trim().toUpperCase() === (right ?? "").trim().toUpperCase();

const includes = (value: string | null | undefined, term: string): boolean =>
  (value ?? "").toLowerCase().includes(term.toLowerCase());

const finish = (receive: string, erp: string, local: string, reprocessing: boolean, waitingForJob: boolean): Stages => {
  let overall: string;
  if (erp === "UNKNOWN") overall = "POSTING_UNKNOWN";
  else if (local === "FAILED" && erp === "SUCCESS") overall = "FAILED_LOCAL";
  else if (receive === "FAILED" || erp === "FAILED" || local === "FAILED") overall = "FAILED";
  else if (receive === "SUCCESS" && erp === "SUCCESS" && local === "SUCCESS") overall = "SUCCESS";
  else if (reprocessing) overall = "REPROCESSING";
  else if (receive === "SUCCESS" && erp === "NOT_STARTED" && local === "NOT_STARTED") overall = "RECEIVED";
  else overall = "PROCESSING";

  if (erp === "UNKNOWN") return { receive, erp, local, overall, action: "RECONCILE", reprocessFrom: null, erpCallAllowed: false };
  if (overall === "SUCCESS" || waitingForJob) return { receive, erp, local, overall, action: "NONE", reprocessFrom: null, erpCallAllowed: false };
  if (erp === "SUCCESS" && local !== "SUCCESS") return { receive, erp, local, overall, action: "REPROCESS", reprocessFrom: "LOCAL", erpCallAllowed: false };
  if (erp === "FAILED") return { receive, erp, local, overall, action: "REPROCESS", reprocessFrom: "ERP", erpCallAllowed: true };
  if (local === "FAILED") return { receive, erp, local, overall, action: "REPROCESS", reprocessFrom: "LOCAL", erpCallAllowed: false };
  if (erp === "NOT_STARTED") return { receive, erp, local, overall, action: "REPROCESS", reprocessFrom: "RECEIVE", erpCallAllowed: false };
  return { receive, erp, local, overall, action: "NONE", reprocessFrom: null, erpCallAllowed: false };
};

const ofPosting = (status: string, attempts: number, erpReference?: string | null): Stages => {
  const accepted = Boolean(erpReference?.trim()) || status === "ERP_ACCEPTED" || status === "FAILED_LOCAL" || status === "POSTED";
  let erp: string;
  let local: string;
  if (status === "UNKNOWN") {
    erp = "UNKNOWN";
    local = "NOT_STARTED";
  } else if (status === "POSTED") {
    erp = "SUCCESS";
    local = "SUCCESS";
  } else if (status === "FAILED_LOCAL" || (accepted && status !== "FAILED" && status !== "SKIPPED")) {
    erp = "SUCCESS";
    local = status === "FAILED_LOCAL" ? "FAILED" : "NOT_STARTED";
  } else if (accepted && (status === "FAILED" || status === "SKIPPED")) {
    erp = "SUCCESS";
    local = "FAILED";
  } else if (status === "FAILED" || status === "SKIPPED") {
    erp = "FAILED";
    local = "NOT_STARTED";
  } else if (attempts > 0) {
    erp = "PROCESSING";
    local = "NOT_STARTED";
  } else {
    erp = "NOT_STARTED";
    local = "NOT_STARTED";
  }
  const waiting = status === "PENDING";
  return finish("SUCCESS", erp, local, attempts > 0 && waiting, waiting);
};

/** The ledger line means local stock is already written. ERP follows the posting. */
const ofLedger = (status?: string | null, attempts = 0, erpReference?: string | null): Stages => {
  if (!status) return finish("SUCCESS", "NOT_STARTED", "SUCCESS", false, false);
  const posting = ofPosting(status, attempts, erpReference);
  const waiting = posting.action === "NONE" && (posting.erp === "PROCESSING" || posting.erp === "NOT_STARTED");
  return finish("SUCCESS", posting.erp, "SUCCESS", posting.overall === "REPROCESSING", waiting);
};

const decideTransfer = (
  fromPlant?: string | null,
  fromStorage?: string | null,
  toPlant?: string | null,
  toStorage?: string | null,
  fromCompany?: string | null,
  toCompany?: string | null,
): { movement?: string; api?: string; problem?: string } => {
  if (!fromPlant?.trim() || !fromStorage?.trim()) return { problem: "SOURCE_SAP_LOCATION_MAPPING_MISSING" };
  if (!toPlant?.trim() || !toStorage?.trim()) return { problem: "DESTINATION_SAP_LOCATION_MAPPING_MISSING" };
  const companiesKnown = Boolean(fromCompany?.trim() && toCompany?.trim());
  if (companiesKnown && !same(fromCompany, toCompany)) return { problem: "CROSS_COMPANY_TRANSFER_NOT_CONFIGURED" };
  if (!same(fromPlant, toPlant)) {
    if (!companiesKnown) return { problem: "CROSS_COMPANY_TRANSFER_NOT_CONFIGURED" };
    return { movement: "301", api: API_PLANT_TRANSFER };
  }
  if (same(fromStorage, toStorage)) return { problem: "INVALID_TRANSFER_LOCATION" };
  return { movement: "311", api: API_TRANSFER };
};

const describeProblem = (code: string): string => {
  const text: Record<string, string> = {
    SOURCE_SAP_LOCATION_MAPPING_MISSING: "The source location has no SAP plant or storage location.",
    DESTINATION_SAP_LOCATION_MAPPING_MISSING: "The destination location has no SAP plant or storage location.",
    INVALID_TRANSFER_LOCATION: "The source and destination storage locations are the same.",
    CROSS_COMPANY_TRANSFER_NOT_CONFIGURED: "The source and destination company codes differ, so this transfer is not posted.",
  };
  return `${code}. ${text[code] ?? "The stock movement cannot be posted."}`;
};

/** A skipped POST_GOODS_MOVEMENT transfer is shown as the 311 or 301 API it should use. */
const describeLegacyTransfer = (
  movementType: string | null | undefined,
  integrationName: string | null | undefined,
  error: string | null | undefined,
  status: string | null | undefined,
  from?: Place,
  to?: Place,
): { movement: string; api: string | null; error: string | null } => {
  const movement = movementType ?? "";
  if (movement === "311" || movement === "301" || movement === "Z01" || movement === "Z02") {
    return { movement, api: integrationName ?? null, error: error ?? null };
  }
  const legacy = movement.toUpperCase() === "TRANSFER" || !movement.trim() || (error ?? "").includes("POST_GOODS_MOVEMENT");
  if (!legacy) return { movement, api: integrationName ?? null, error: error ?? null };
  if (!from?.plant?.trim() || !from.storage?.trim() || !to?.plant?.trim() || !to.storage?.trim()) {
    return { movement, api: integrationName ?? null, error: error ?? null };
  }
  const decided = decideTransfer(from?.plant, from?.storage, to?.plant, to?.storage, from?.company, to?.company);
  const failed = !status || status === "FAILED" || status === "SKIPPED";
  const oldMessage = !error?.trim() || error.includes("POST_GOODS_MOVEMENT");
  if (decided.problem || !decided.movement || !decided.api) {
    return {
      movement,
      api: integrationName ?? null,
      error: failed && decided.problem && oldMessage ? describeProblem(decided.problem) : error ?? null,
    };
  }
  return {
    movement: decided.movement,
    api: integrationName?.trim() ? integrationName : decided.api,
    error: failed && oldMessage ? `SAP_API_CONFIGURATION_NOT_FOUND. Activate ${decided.api}. No other API is used.` : error ?? null,
  };
};

const transactionTypeOf = (referenceType: string, movement: string, fallback: string): string => {
  if (referenceType === "ITO" && movement === "301") return "PLANT_TRANSFER_301";
  if (referenceType === "ITO") return "INTERNAL_TRANSFER_311";
  if (referenceType === "STOCK_COUNT" && movement === "Z01") return "PHYSICAL_COUNT_SURPLUS";
  if (referenceType === "STOCK_COUNT" && movement === "Z02") return "PHYSICAL_COUNT_SHORTAGE";
  if (referenceType === "ADJUSTMENT" && movement === "Z01") return "POSITIVE_STOCK_ADJUSTMENT";
  if (referenceType === "ADJUSTMENT" && movement === "Z02") return "NEGATIVE_STOCK_ADJUSTMENT";
  return fallback;
};

const keep = (stages: Stages, query: SilaTrackerQuery): boolean => {
  if (query.status && stages.overall.toUpperCase() !== query.status.trim().toUpperCase()) return false;
  if (!query.stage) return true;
  const stage = query.stage.trim().toUpperCase();
  if (stage === "LOCAL") return stages.local === "FAILED" || stages.reprocessFrom === "LOCAL";
  if (stage === "ERP") return stages.erp === "FAILED" || stages.erp === "UNKNOWN" || stages.erp === "PROCESSING";
  return stages.receive !== "SUCCESS" || stages.reprocessFrom === "RECEIVE";
};

const count = (summary: SilaTrackerSummary, overall: string) => {
  if (overall === "SUCCESS") summary.successful += 1;
  else if (overall === "FAILED" || overall === "PARTIAL") summary.failed += 1;
  else if (overall === "FAILED_LOCAL") {
    summary.failed += 1;
    summary.needsAttention += 1;
  } else if (overall === "POSTING_UNKNOWN") summary.needsAttention += 1;
  else if (overall === "REPROCESSING") {
    summary.reprocessing += 1;
    summary.processing += 1;
  } else summary.processing += 1;
};

const inWindow = (value: string | null | undefined, from?: string, to?: string): boolean => {
  if (!value) return !from && !to;
  const day = value.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

const pullPages = async <T>(read: (index: number) => Promise<T[]>): Promise<T[]> => {
  const all: T[] = [];
  for (let index = 0; all.length < MAX_ROWS; index += PAGE) {
    const page = await read(index);
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
};

const placeOf = (locations: Map<string, SilaLocation>, properties: Map<string, Property>, locationId?: string | null): Place => {
  const location = locationId ? locations.get(locationId) : undefined;
  const property = location ? properties.get(location.propertyId) : undefined;
  return {
    property: location?.propertyName || property?.propertyName,
    plant: property?.plantCode,
    storage: location?.storageLocationCode ?? undefined,
    company: property?.companyCode || location?.companyCode || undefined,
  };
};

const referenceKey = (type: string, id: string): string => `${type}|${id}`.toLowerCase();

/**
 * The deployed tracker route is not on the live API yet. SILA ME is read from the inventory
 * ledger and the ERP postings that already exist, and a same-plant transfer is shown as 311.
 */
export const composeLiveSilaMeTracker = async (query: SilaTrackerQuery): Promise<SilaTrackerPage> => {
  if (query.dataClass === "MASTER_DATA") {
    return { total: 0, summary: emptySummary(), rows: [] };
  }

  const [transactions, postings, locationList, propertyList] = await Promise.all([
    pullPages((index) => getInventoryTransactions({ from: query.from, to: query.to, index, limit: PAGE })),
    pullPages((index) => getErpPostings("", "", { index, limit: PAGE })),
    getLocations("ALL"),
    getProperties(),
  ]);

  const locations = new Map(locationList.map((location) => [location.id, location]));
  const properties = new Map(propertyList.map((property) => [property.id, property]));
  const ledger = transactions.filter((line) => line.referenceType !== "POS_SALE");
  const covered = new Set(ledger.map((line) => referenceKey(line.referenceType, line.referenceId)));
  const postingByReference = new Map<string, SilaErpPosting>();
  postings.forEach((posting) => {
    const key = referenceKey(posting.referenceType, posting.referenceId);
    if (!postingByReference.has(key)) postingByReference.set(key, posting);
  });

  const sides = new Map<string, { from?: string; to?: string }>();
  ledger.forEach((line) => {
    if (line.referenceType !== "ITO") return;
    const side = sides.get(line.referenceId) ?? {};
    if (line.transactionType === "TRANSFER_OUT") side.from = line.locationId;
    if (line.transactionType === "TRANSFER_IN") side.to = line.locationId;
    sides.set(line.referenceId, side);
  });

  const transferEnds = async (referenceId: string): Promise<{ from?: Place; to?: Place }> => {
    let side = sides.get(referenceId) ?? {};
    if (!side.from || !side.to) {
      try {
        const transfer = await getTransfer(referenceId);
        side = { from: side.from || transfer.fromLocationId, to: side.to || transfer.toLocationId };
        sides.set(referenceId, side);
      } catch {
        sides.set(referenceId, side);
      }
    }
    return {
      from: placeOf(locations, properties, side.from),
      to: placeOf(locations, properties, side.to),
    };
  };

  const rows: SilaTrackerRow[] = [];
  for (const line of ledger) {
    const posting = postingByReference.get(referenceKey(line.referenceType, line.referenceId));
    const place = placeOf(locations, properties, line.locationId);
    let movement = posting?.movementType ?? "";
    let api = posting?.integrationSystem ?? null;
    let error = posting?.errorMessage ?? null;
    if (line.referenceType === "ITO") {
      const ends = await transferEnds(line.referenceId);
      const described = describeLegacyTransfer(movement, api, error, posting?.status, ends.from, ends.to);
      movement = described.movement;
      api = described.api;
      error = described.error;
    }
    const stages = ofLedger(posting?.status, posting?.attempts ?? 0, posting?.erpReference);
    const transactionType = transactionTypeOf(line.referenceType, movement, line.transactionType);
    if (!matches(query, {
      transactionType,
      fallbackType: line.transactionType,
      direction: line.direction === "IN" ? "INBOUND" : "OUTBOUND",
      company: posting?.companyCode || place.company,
      plant: place.plant,
      storage: place.storage,
      integration: api,
      stages,
      searchIn: [line.transactionNumber, line.referenceNumber, line.materialCode, line.materialDescription, line.reason, posting?.erpReference, posting?.referenceNumber, api],
      source: "SILA",
      target: api || "SAP",
    })) continue;

    rows.push({
      id: `LEDGER~${line.id}`,
      source: "LEDGER",
      occurredOn: line.dateCreated,
      businessDate: line.businessDate,
      transactionType,
      dataClass: "TRANSACTION_DATA",
      direction: line.direction === "IN" ? "INBOUND" : "OUTBOUND",
      companyCode: posting?.companyCode || place.company,
      propertyName: place.property,
      plant: place.plant,
      storageLocation: place.storage,
      sourceSystem: "SILA",
      targetSystem: api || "SAP",
      businessReference: line.transactionNumber,
      receiveStatus: stages.receive,
      erpStatus: stages.erp,
      localStatus: stages.local,
      overallStatus: stages.overall,
      retryCount: posting?.attempts ?? 0,
      lastError: error,
      erpReference: posting?.erpReference,
      integrationName: api,
      action: stages.action,
      reprocessFrom: stages.reprocessFrom,
      erpCallAllowed: stages.erpCallAllowed,
      quantity: line.quantity,
      uom: line.baseUom,
      movementType: movement || null,
      erpPostingId: posting?.id ?? null,
    });
  }

  for (const posting of postings) {
    if (posting.referenceType === "POS_SALE") continue;
    if (covered.has(referenceKey(posting.referenceType, posting.referenceId))) continue;
    if (!inWindow(posting.createdOn, query.from, query.to)) continue;
    const place = placeOf(locations, properties, posting.locationId);
    let movement = posting.movementType;
    let api = posting.integrationSystem ?? null;
    let error = posting.errorMessage ?? null;
    if (posting.referenceType === "ITO") {
      const ends = await transferEnds(posting.referenceId);
      const described = describeLegacyTransfer(movement, api, error, posting.status, ends.from, ends.to);
      movement = described.movement;
      api = described.api;
      error = described.error;
    }
    const stages = ofPosting(posting.status, posting.attempts, posting.erpReference);
    const transactionType = transactionTypeOf(posting.referenceType, movement, posting.referenceType);
    if (!matches(query, {
      transactionType,
      fallbackType: posting.referenceType,
      direction: "OUTBOUND",
      company: posting.companyCode || place.company,
      plant: place.plant,
      storage: place.storage,
      integration: api,
      stages,
      searchIn: [posting.referenceNumber, posting.erpReference, api, error],
      source: "SILA",
      target: api || "SAP",
    })) continue;
    rows.push({
      id: `ERP~${posting.id}`,
      source: "ERP",
      occurredOn: posting.createdOn,
      transactionType,
      dataClass: "TRANSACTION_DATA",
      direction: "OUTBOUND",
      companyCode: posting.companyCode || place.company,
      propertyName: place.property || posting.locationName,
      plant: place.plant,
      storageLocation: place.storage,
      sourceSystem: "SILA",
      targetSystem: api || "SAP",
      businessReference: posting.referenceNumber,
      receiveStatus: stages.receive,
      erpStatus: stages.erp,
      localStatus: stages.local,
      overallStatus: stages.overall,
      retryCount: posting.attempts,
      lastError: error,
      erpReference: posting.erpReference,
      integrationName: api,
      action: stages.action,
      reprocessFrom: stages.reprocessFrom,
      erpCallAllowed: stages.erpCallAllowed,
      movementType: movement || null,
      erpPostingId: posting.id,
    });
  }

  rows.sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
  const summary = emptySummary();
  rows.forEach((row) => count(summary, row.overallStatus));
  summary.total = rows.length;
  return {
    total: rows.length,
    summary,
    rows: rows.slice(query.index, query.index + query.limit),
  };
};

const matches = (query: SilaTrackerQuery, row: {
  transactionType: string;
  fallbackType: string;
  direction: string;
  company?: string | null;
  plant?: string | null;
  storage?: string | null;
  integration?: string | null;
  stages: Stages;
  searchIn: Array<string | null | undefined>;
  source: string;
  target: string;
}): boolean => {
  if (query.transactionType && !same(row.transactionType, query.transactionType) && !same(row.fallbackType, query.transactionType)) return false;
  if (query.direction && !same(row.direction, query.direction)) return false;
  if (query.companyCode && !same(row.company, query.companyCode)) return false;
  if (query.plant && !same(row.plant, query.plant)) return false;
  if (query.storageLocation && !same(row.storage, query.storageLocation)) return false;
  if (query.integration && !includes(row.integration, query.integration.trim())) return false;
  if (query.material && !row.searchIn.some((value) => includes(value, query.material!.trim()))) return false;
  if (query.search && !row.searchIn.some((value) => includes(value, query.search!.trim()))) return false;
  if (query.sourceSystem && !includes(row.source, query.sourceSystem.trim())) return false;
  if (query.targetSystem && !includes(row.target, query.targetSystem.trim())) return false;
  if (query.dataClass && query.dataClass !== "TRANSACTION_DATA") return false;
  return keep(row.stages, query);
};

/** Continues the ERP posting that belongs to the inventory line. One posting is sent once. */
export const reprocessLivePostings = async (
  rows: Array<Pick<SilaTrackerRow, "erpPostingId">>,
): Promise<SilaTrackerReprocessResult> => {
  const result: SilaTrackerReprocessResult = { eligible: 0, ineligible: 0, completed: 0, failed: 0, messages: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    const postingId = row.erpPostingId;
    if (!postingId) {
      result.ineligible += 1;
      result.failed += 1;
      result.messages.push("This inventory transaction has no ERP posting to continue.");
      continue;
    }
    if (seen.has(postingId)) {
      result.eligible += 1;
      result.completed += 1;
      result.messages.push("This line uses the same ERP posting as another selected line. SAP is called once.");
      continue;
    }
    seen.add(postingId);
    try {
      await reprocessErpPosting(postingId);
      result.eligible += 1;
      result.completed += 1;
      result.messages.push("The ERP posting resumed from ERP processing.");
    } catch (error) {
      result.ineligible += 1;
      result.failed += 1;
      result.messages.push(error instanceof Error ? error.message : "Could not reprocess the posting.");
    }
  }
  return result;
};
