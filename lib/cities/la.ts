import { CityAdapter, CityNotYetSupportedError } from "./types";

export const laAdapter: CityAdapter = {
  id: "la",
  name: "Los Angeles",
  shortName: "LA",
  enabled: false,
  supportedStates: ["CA"],
  cityPortalUrl: "https://www.lacity.org/residents/popular-information/pay-parking-ticket",
  async lookup() {
    throw new CityNotYetSupportedError("la");
  },
  async getLeaderboard() {
    return [];
  },
  async getPercentile() {
    return 50;
  },
};
