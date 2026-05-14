import { nycAdapter } from "./nyc";
import { dcAdapter } from "./dc";
import { phillyAdapter } from "./philly";
import { sfAdapter } from "./sf";
import { laAdapter } from "./la";
import { bostonAdapter } from "./boston";
import { CityAdapter } from "./types";

export const cityRegistry: Record<string, CityAdapter> = {
  [nycAdapter.id]: nycAdapter,
  [dcAdapter.id]: dcAdapter,
  [phillyAdapter.id]: phillyAdapter,
  [sfAdapter.id]: sfAdapter,
  [laAdapter.id]: laAdapter,
  [bostonAdapter.id]: bostonAdapter,
};

export function getCity(id: string): CityAdapter | undefined {
  return cityRegistry[id.toLowerCase()];
}

export function listCities(): CityAdapter[] {
  return Object.values(cityRegistry);
}

export function listEnabledCities(): CityAdapter[] {
  return listCities().filter((c) => c.enabled);
}

export * from "./types";
