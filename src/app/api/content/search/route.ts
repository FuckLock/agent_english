import { NextResponse } from "next/server";

import {
  searchDiscoveryCandidates,
  type DiscoveryFilters
} from "@/server/content/content-pipeline";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const result = searchDiscoveryCandidates(readFilters(params));

  return NextResponse.json({ ok: true, ...result });
}

function readFilters(params: URLSearchParams): DiscoveryFilters {
  return {
    q: params.get("q") ?? "",
    category: params.get("category") as DiscoveryFilters["category"],
    length: params.get("length") as DiscoveryFilters["length"],
    difficulty: params.get("difficulty") as DiscoveryFilters["difficulty"],
    mode: params.get("mode") as DiscoveryFilters["mode"]
  };
}
