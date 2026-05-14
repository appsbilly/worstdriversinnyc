import { CityAdapter, CityNotYetSupportedError } from "./types";

export const dcAdapter: CityAdapter = {
  id: "dc",
  name: "Washington, D.C.",
  shortName: "DC",
  enabled: false,
  supportedStates: ["DC", "MD", "VA"],
  cityPortalUrl: "https://dmv.dc.gov/page/pay-or-contest-ticket",
  async lookup() {
    throw new CityNotYetSupportedError("dc");
  },
  async getLeaderboard() {
    return [];
  },
  async getPercentile() {
    return 50;
  },
};
