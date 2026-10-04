import { releaseHold } from "@/lib/checkout";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const holdId = Number(body?.holdId);
  if (!Number.isInteger(holdId) || holdId <= 0) return Response.json({ error: "Bad hold" }, { status: 400 });
  return Response.json({ released: await releaseHold(holdId) });
}
