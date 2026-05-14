import { CityAdapter, CityNotYetSupportedError } from "./types";

export const sfAdapter: CityAdapter = {
  id: "sf",
  name: "San Francisco",
  shortName: "SF",
  enabled: false,
  supportedStates: ["CA"],
  cityPortalUrl: "https://www.sfmta.com/getting-around/drive-park/citations",
  async lookup() {
    throw new CityNotYetSupportedError("sf");
  },
  async getLeaderboard() {
    return [];
  },
  async getPercentile() {
    return 50;
  },
};
