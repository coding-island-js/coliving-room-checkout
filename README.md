# Co-living room checkout demo

A working version of a co-living room checkout: a member picks a room and a rent schedule, the room is held
for 45 minutes, and Stripe takes the move-in fee and starts recurring rent.

Built with **Next.js, Stripe (test mode), Postgres and Zod**, and tested.

**Live demo: https://coliving-demo.withmagic.ai** (Stripe test mode). Pay with card `4242 4242 4242 4242`,
any future date, any CVC. Try the code `DEMO10` on the payment page for 10% off. A room someone is paying for
shows as "Held for 45 minutes" until they pay, leave the payment page, or the hold runs out.

## The rules it enforces

- **A room is bookable only when its Room Directory status is VACANT.** Room data is read through one small
  module (`src/lib/rooms.ts`). Here it reads a sample file. In production it calls the ClickUp API live,
  so the site keeps no copy of business data.
- **45-minute hold.** Starting checkout creates a hold. A database rule allows only one live hold per room,
  so two members cannot pay for the same room. Stripe's checkout page closes when the hold does.
- **Holds release themselves.** When Stripe reports the checkout expired, the hold is released. A hold past
  its 45 minutes also stops blocking the room on the next attempt.
- **7 PM cutoff for same-day move-in, in Dallas time,** no matter where the server runs.
- **Name, phone and email required, and the terms must be accepted.**
- **Rent weekly, every two weeks or monthly** as a Stripe subscription, plus a **one-time, non-refundable
  move-in fee**, with **coupons** enabled.
- **Paid checkout turns the hold into a booking.** The next step in production is posting the new member to
  the Make webhook that writes to ClickUp. The site never writes ClickUp directly.
- The site's own database holds only one table: the holds.

## Tests

`npx vitest run` runs 12 tests against Postgres and Stripe in test mode:
the 7 PM cutoff (6:59 PM allowed, 7:00 PM refused, tomorrow fine), required fields and terms, a non-VACANT
room refused, a real Stripe test checkout for each rent schedule (interval, move-in fee, coupons, hold length),
one hold per room, a stale hold releasing, and Stripe's expired and paid notices.

## Run it

Create `.env.local`:

```
DATABASE_URL=postgres://user:password@localhost:5432/roomwise
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=http://localhost:3000
```

Then `npm install`, `npx vitest run`, and `npm run dev`.

## Where things live

| File | What it holds |
|---|---|
| `src/lib/checkout.ts` | Checkout rules, the hold, Stripe session, Stripe notices |
| `src/lib/rooms.ts` | The Room Directory adapter (sample file here, ClickUp in production) |
| `src/lib/db.ts` | The holds table |
| `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts` | Start checkout, and Stripe's notices |
| `src/app/api/holds/release/route.ts` | Frees the room when a member leaves the payment page without paying |
| `tests/checkout.test.ts` | The 12 tests |
