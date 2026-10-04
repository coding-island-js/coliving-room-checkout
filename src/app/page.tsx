import { getRooms } from "@/lib/rooms";
import { dallasNow, HOLD_MINUTES } from "@/lib/checkout";
import { ensureSchema, liveHolds } from "@/lib/db";
import CheckoutForm, { type RoomView } from "./CheckoutForm";

export const dynamic = "force-dynamic";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const now = new Date();
  await ensureSchema();
  const holds = await liveHolds(now);
  const rooms: RoomView[] = (await getRooms()).map((r) => {
    const until = holds.get(r.id);
    return { ...r, minutesLeft: until ? Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000)) : 0 };
  });
  const today = dallasNow(now);
  const sameDayOpen = today.hour < 19;
  const earliest = sameDayOpen ? today.date : addDays(today.date, 1);

  return (
    <>
      <div className="banner" role="note">
        Demo in Stripe test mode. Use card <strong>4242&nbsp;4242 4242&nbsp;4242</strong>, any future date, any CVC.
      </div>
      <main className="wrap">
        {params.booked === "1" && (
          <section className="notice ok" aria-live="polite">
            <h2>You are booked.</h2>
            <p>Stripe took the move-in fee and started the rent. The room now shows as taken for everyone else.</p>
          </section>
        )}
        {params.released === "1" && (
          <section className="notice" aria-live="polite">
            <p>You left the payment page, so nothing was charged and the room is open again.</p>
          </section>
        )}
        <header className="intro">
          <p className="eyebrow">Co-living room checkout demo</p>
          <h1>Pick a room and move in.</h1>
          <p>Choose a room and how often you pay rent. The room is held for you for {HOLD_MINUTES} minutes while you pay, so nobody else can take it.</p>
        </header>
        <CheckoutForm
          rooms={rooms}
          earliestDate={earliest}
          sameDayOpen={sameDayOpen}
          leftHoldId={typeof params.left === "string" ? params.left : ""}
        />
        <section className="rules">
          <h2>What this demo checks</h2>
          <ul>
            <li>Only one member can hold a room at a time. The hold ends after {HOLD_MINUTES} minutes, or as soon as the member leaves the payment page.</li>
            <li>Same-day move-in closes at 7 PM Dallas time.</li>
            <li>Name, phone, email and the member terms are required.</li>
            <li>Rent is charged weekly, every two weeks or monthly, plus a one-time move-in fee. Try the code <strong>DEMO10</strong> on the payment page for 10% off.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
