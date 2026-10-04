import Stripe from "stripe";
import { z } from "zod";
import { sql } from "./db";
import { getRoom, type Cadence } from "./rooms";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const HOLD_MINUTES = 45;
const CUTOFF_HOUR = 19; // 7 PM, Dallas time, for same-day move-in
const TZ = "America/Chicago";

export const CheckoutInput = z.object({
  roomId: z.string().min(1),
  cadence: z.enum(["weekly", "biweekly", "monthly"]),
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().refine((p) => p.replace(/\D/g, "").length >= 10, "Phone is required"),
  email: z.string().email("A valid email is required"),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

// Today's date and hour in Dallas, whatever time zone the server runs in.
export function dallasNow(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function checkMoveInDate(moveInDate: string, now: Date): string | null {
  const today = dallasNow(now);
  if (moveInDate < today.date) return "Move-in date is in the past";
  if (moveInDate === today.date && today.hour >= CUTOFF_HOUR) return "Same-day move-in closes at 7 PM. Pick tomorrow or later.";
  return null;
}

const STRIPE_INTERVAL: Record<Cadence, { interval: "week" | "month"; interval_count: number }> = {
  weekly: { interval: "week", interval_count: 1 },
  biweekly: { interval: "week", interval_count: 2 },
  monthly: { interval: "month", interval_count: 1 },
};

export type CheckoutResult = { ok: true; url: string; holdId: number } | { ok: false; status: number; error: string };

export async function startCheckout(raw: unknown, now = new Date()): Promise<CheckoutResult> {
  const parsed = CheckoutInput.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const dateError = checkMoveInDate(input.moveInDate, now);
  if (dateError) return { ok: false, status: 400, error: dateError };

  const room = await getRoom(input.roomId);
  if (!room) return { ok: false, status: 404, error: "Room not found" };
  if (room.status !== "VACANT") return { ok: false, status: 409, error: "This room is not available" };

  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  let holdId: number;
  try {
    holdId = await sql.begin(async (tx) => {
      // Holds past their 45 minutes stop blocking the room.
      await tx`update holds set status = 'released' where room_id = ${room.id} and status = 'held' and expires_at <= ${now}`;
      const [hold] = await tx`insert into holds (room_id, expires_at) values (${room.id}, ${expiresAt}) returning id`;
      return hold.id as number;
    });
  } catch (e: any) {
    if (e?.code === "23505") return { ok: false, status: 409, error: "Someone else is checking out this room. Try again in a few minutes." };
    throw e;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: input.email,
      allow_promotion_codes: true, // coupons
      expires_at: Math.floor(expiresAt.getTime() / 1000), // Stripe's page closes when the hold does
      line_items: [
        { quantity: 1, price_data: { currency: "usd", unit_amount: room.rentCents[input.cadence],
          recurring: STRIPE_INTERVAL[input.cadence], product_data: { name: `${room.property}: ${room.name} (${input.cadence} rent)` } } },
        { quantity: 1, price_data: { currency: "usd", unit_amount: room.moveInFeeCents,
          product_data: { name: "Move-in fee (non-refundable)" } } },
      ],
      custom_text: { submit: { message: "The move-in fee is non-refundable. Your room is held for 45 minutes." } },
      metadata: { holdId: String(holdId), roomId: room.id, memberName: input.name, memberPhone: input.phone, moveInDate: input.moveInDate },
      success_url: `${process.env.BASE_URL ?? "http://localhost:3000"}/?booked=1`,
      cancel_url: `${process.env.BASE_URL ?? "http://localhost:3000"}/?room=${room.id}`,
    });
    await sql`update holds set stripe_session_id = ${session.id} where id = ${holdId}`;
    return { ok: true, url: session.url!, holdId };
  } catch (e) {
    await sql`update holds set status = 'released' where id = ${holdId}`; // never leave a room stuck on a failed checkout
    throw e;
  }
}

// Stripe tells us how each checkout ended. Paid: the hold becomes a booking.
// Expired or abandoned: the hold is released and the room is bookable again.
export async function handleStripeEvent(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (event.type === "checkout.session.completed") {
    await sql`update holds set status = 'converted' where stripe_session_id = ${session.id} and status = 'held'`;
    // Production: post the new member to the Make webhook that writes to ClickUp. The site never writes ClickUp directly.
    return "converted";
  }
  if (event.type === "checkout.session.expired") {
    await sql`update holds set status = 'released' where stripe_session_id = ${session.id} and status = 'held'`;
    return "released";
  }
  return "ignored";
}
