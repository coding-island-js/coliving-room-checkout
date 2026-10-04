import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { startCheckout, checkMoveInDate, handleStripeEvent, stripe, HOLD_MINUTES } from "@/lib/checkout";
import { sql, ensureSchema } from "@/lib/db";

// 2:00 PM Dallas time on Oct 6, 2026 (Dallas is UTC-5 in October)
const AFTERNOON = new Date("2026-10-06T19:00:00Z");
const member = { name: "Jordan Lee", phone: "(214) 555-0142", email: "member@example.com", acceptedTerms: true as const };
const order = (o: object = {}) => ({ roomId: "rd-101", cadence: "weekly", moveInDate: "2026-10-07", ...member, ...o });

beforeAll(ensureSchema);
beforeEach(async () => { await sql`delete from holds`; });
afterAll(async () => { await sql.end(); });

describe("7 PM cutoff for same-day move-in (Dallas time)", () => {
  test("same day at 6:59 PM is allowed", () => {
    expect(checkMoveInDate("2026-10-06", new Date("2026-10-06T23:59:00Z"))).toBeNull();
  });
  test("same day at 7:00 PM is refused", () => {
    expect(checkMoveInDate("2026-10-06", new Date("2026-10-07T00:00:00Z"))).toMatch(/7 PM/);
  });
  test("tomorrow is fine after 7 PM", () => {
    expect(checkMoveInDate("2026-10-07", new Date("2026-10-07T00:30:00Z"))).toBeNull();
  });
});

describe("checkout rules", () => {
  test("terms must be accepted", async () => {
    const r = await startCheckout(order({ acceptedTerms: false }), AFTERNOON);
    expect(r).toMatchObject({ ok: false, status: 400, error: "You must accept the terms" });
  });
  test("name, phone and email are required", async () => {
    expect(await startCheckout(order({ phone: "555" }), AFTERNOON)).toMatchObject({ ok: false, status: 400 });
    expect(await startCheckout(order({ email: "nope" }), AFTERNOON)).toMatchObject({ ok: false, status: 400 });
  });
  test("a room that is not VACANT in the Room Directory cannot be booked", async () => {
    expect(await startCheckout(order({ roomId: "rd-102" }), AFTERNOON)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("45-minute hold and Stripe recurring rent", () => {
  test.each(["weekly", "biweekly", "monthly"])("%s rent opens a real Stripe test checkout with coupons on", async (cadence) => {
    const r = await startCheckout(order({ cadence }), new Date());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [hold] = await sql`select * from holds where id = ${r.holdId}`;
    const session = await stripe.checkout.sessions.retrieve(hold.stripe_session_id, { expand: ["line_items"] });
    expect(session.mode).toBe("subscription");
    expect(session.allow_promotion_codes).toBe(true);
    const rent = session.line_items!.data.find((l) => l.price?.recurring)!;
    const expected = { weekly: ["week", 1], biweekly: ["week", 2], monthly: ["month", 1] }[cadence]!;
    expect([rent.price!.recurring!.interval, rent.price!.recurring!.interval_count]).toEqual(expected);
    expect(session.line_items!.data.some((l) => !l.price?.recurring && l.description?.includes("Move-in fee"))).toBe(true);
    const minutesHeld = Math.round((new Date(hold.expires_at).getTime() - Date.now()) / 60_000);
    expect(minutesHeld).toBeGreaterThanOrEqual(HOLD_MINUTES - 1);
    await stripe.checkout.sessions.expire(session.id); // tidy up test mode
    await sql`delete from holds`;
  });

  test("a second member cannot check out a room that is on hold", async () => {
    const first = await startCheckout(order(), new Date());
    expect(first.ok).toBe(true);
    expect(await startCheckout(order({ email: "other@example.com" }), new Date())).toMatchObject({ ok: false, status: 409 });
  });

  test("after 45 minutes the hold stops blocking the room", async () => {
    const first = await startCheckout(order(), new Date());
    expect(first.ok).toBe(true);
    await sql`update holds set expires_at = now() - interval '1 minute'`;
    expect((await startCheckout(order({ email: "later@example.com" }), new Date())).ok).toBe(true);
  });

  test("Stripe's expired notice releases the hold; a paid notice turns it into a booking", async () => {
    const a = await startCheckout(order(), new Date());
    if (!a.ok) throw new Error("checkout failed");
    const [hold] = await sql`select stripe_session_id from holds where id = ${a.holdId}`;
    const fake = (type: string) => ({ type, data: { object: { id: hold.stripe_session_id } } }) as any;
    expect(await handleStripeEvent(fake("checkout.session.expired"))).toBe("released");
    expect((await sql`select status from holds where id = ${a.holdId}`)[0].status).toBe("released");

    const b = await startCheckout(order({ email: "payer@example.com" }), new Date());
    if (!b.ok) throw new Error("checkout failed");
    const [hold2] = await sql`select stripe_session_id from holds where id = ${b.holdId}`;
    await handleStripeEvent({ type: "checkout.session.completed", data: { object: { id: hold2.stripe_session_id } } } as any);
    expect((await sql`select status from holds where id = ${b.holdId}`)[0].status).toBe("converted");
  });
});
