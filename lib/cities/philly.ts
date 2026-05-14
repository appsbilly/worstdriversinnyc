import { CityAdapter, CityNotYetSupportedError } from "./types";

export const phillyAdapter: CityAdapter = {
  id: "philly",
  name: "Philadelphia",
  shortName: "Philly",
  enabled: false,
  supportedStates: ["PA", "NJ", "DE"],
  cityPortalUrl: "https://www.phila.gov/services/payments-assistance-taxes/pay-or-contest-a-ticket/",
  async lookup() {
    throw new CityNotYetSupportedError("philly");
  },
  async getLeaderboard() {
    return [];
  },
  async getPercentile() {
    return 50;
  },
};
