import { NextResponse } from "next/server";

const fallback = {
  bitcoin: { usd: 65000 },
  ethereum: { usd: 3200 }
};

export async function GET() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!response.ok) throw new Error("Rates request failed");
    const rates = await response.json();
    return NextResponse.json({ rates, source: "coingecko" });
  } catch {
    return NextResponse.json({ rates: fallback, source: "fallback" });
  }
}
