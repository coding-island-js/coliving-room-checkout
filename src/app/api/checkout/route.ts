import { startCheckout } from "@/lib/checkout";
import { ensureSchema } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  const result = await startCheckout(await req.json().catch(() => null));
  return result.ok ? Response.json({ url: result.url }) : Response.json({ error: result.error }, { status: result.status });
}
