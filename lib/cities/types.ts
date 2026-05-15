export type ViolationStatus = "paid" | "unpaid" | "in_dispute" | "dismissed" | "unknown";

export interface Violation {
  id: string;
  issueDate: string; // ISO
  violationType: string;
  location?: string;
  fineAmount: number;
  amountPaid: number;
  amountDue: number;
  status: ViolationStatus;
  imageUrl?: string;
  issuingAgency?: string;
  precinct?: string;
}

export interface OwnershipSignal {
  /** ISO date of the violation that triggered the signal — interpreted as
   *  "this is roughly when ownership may have changed". */
  detectedAt: string;
  kind: "license_type_change" | "long_gap";
  detail: string;
}

export interface PlateLookupResult {
  city: string;
  plate: string;
  state: string;
  totalViolations: number;
  totalPaid: number;
  totalUnpaid: number;
  totalDismissed: number;
  totalFinesIssued: number;
  totalFinesPaid: number;
  totalFinesOutstanding: number;
  firstViolationDate?: string;
  lastViolationDate?: string;
  violations: Violation[];
  /** Heuristic indicators that the plate may have changed ownership. NYC's
   *  open data doesn't include explicit transfer events; these are inferred. */
  ownershipSignals?: OwnershipSignal[];
  cityPortalUrl?: string;
}

export interface LeaderboardEntry {
  rank: number;
  plate: string;
  state: string;
  violationCount: number;
  totalFines: number;
}

export interface LeaderboardMeta {
  window: "1w" | "1m" | "1y" | "all";
  computedAt: string;
  oldestIssueDate: string;
  newestIssueDate: string;
  rowsScanned: number;
  uniquePlates: number;
}

export interface PercentileBuckets {
  city: string;
  computedAt: string;
  totalPlatesObserved: number;
  /** map from "p50" | "p75" | "p90" | "p95" | "p99" -> minimum violation count to clear that percentile */
  buckets: Record<"p50" | "p75" | "p90" | "p95" | "p99", number>;
}

export type LeaderboardWindow = "1w" | "1m" | "1y" | "all";

export interface RankInfo {
  /** 1 = worst. Plates tied at the same violation count share a rank;
   *  the next distinct count skips by the tie-group size (standard competition ranking). */
  rank: number;
  /** Total number of plates observed in the all-time distribution. */
  total: number;
}

export interface CityAdapter {
  id: string;
  name: string;
  shortName: string;
  enabled: boolean;
  supportedStates: string[];
  cityPortalUrl: string;
  lookup(plate: string, state: string): Promise<PlateLookupResult>;
  getLeaderboard(limit: number, window?: LeaderboardWindow): Promise<LeaderboardEntry[]>;
  getLeaderboardMeta?(window: LeaderboardWindow): Promise<LeaderboardMeta | null>;
  getPercentile(violationCount: number): Promise<number>;
  /**
   * Returns the plate's competition rank. When `totalFines` is provided, ties
   * on ticket count are broken by fine quantile (approximate, 5% precision).
   */
  getRank?(violationCount: number, totalFines?: number): Promise<RankInfo | null>;
}

export class CityNotYetSupportedError extends Error {
  readonly cityId: string;
  constructor(cityId: string, message?: string) {
    super(message ?? `City "${cityId}" is not yet supported.`);
    this.name = "CityNotYetSupportedError";
    this.cityId = cityId;
  }
}

export class PlateNotFoundError extends Error {
  constructor(message = "Plate not found.") {
    super(message);
    this.name = "PlateNotFoundError";
  }
}

export class UpstreamApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamApiError";
    this.status = status;
  }
}

export class InvalidPlateError extends Error {
  constructor(message = "Invalid plate format.") {
    super(message);
    this.name = "InvalidPlateError";
  }
}
