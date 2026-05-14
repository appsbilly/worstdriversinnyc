import { CityAdapter, CityNotYetSupportedError } from "./types";

export const bostonAdapter: CityAdapter = {
  id: "boston",
  name: "Boston",
  shortName: "Boston",
  enabled: false,
  supportedStates: ["MA"],
  cityPortalUrl: "https://www.boston.gov/departments/parking-clerk/how-pay-parking-ticket",
  async lookup() {
    throw new CityNotYetSupportedError("boston");
  },
  async getLeaderboard() {
    return [];
  },
  async getPercentile() {
    return 50;
  },
};
