import { stripe, handleStripeEvent } from "@/lib/checkout";

export async function POST(req: Request) {
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }
  return Response.json({ received: true, result: await handleStripeEvent(event) });
}
