import { NextResponse } from "next/server";
import { getCity } from "@/lib/cities";
import {
  CityNotYetSupportedError,
  InvalidPlateError,
  UpstreamApiError,
} from "@/lib/cities/types";
import { isValidPlate, normalizePlate, normalizeState } from "@/lib/format";
import { getClientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cityId = (url.searchParams.get("city") || "").toLowerCase();
  const stateParam = url.searchParams.get("state") || "";
  const plateParam = url.searchParams.get("plate") || "";

  const city = getCity(cityId);
  if (!city) {
    return NextResponse.json({ error: "unknown city" }, { status: 400 });
  }

  const plate = normalizePlate(plateParam);
  const state = normalizeState(stateParam);

  if (!isValidPlate(plate)) {
    return NextResponse.json({ error: "invalid plate format" }, { status: 400 });
  }
  if (state.length !== 2) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate limited", retryAfter: rl.reset },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.reset),
        },
      },
    );
  }

  try {
    const result = await city.lookup(plate, state);
    const rank = city.getRank ? await city.getRank(result.totalViolations) : null;
    return NextResponse.json({ result, rank });
  } catch (err) {
    if (err instanceof CityNotYetSupportedError) {
      return NextResponse.json(
        { error: "city not yet supported", cityId: err.cityId },
        { status: 501 },
      );
    }
    if (err instanceof InvalidPlateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof UpstreamApiError) {
      return NextResponse.json(
        { error: "upstream city api error", status: err.status },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
