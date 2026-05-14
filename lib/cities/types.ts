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
