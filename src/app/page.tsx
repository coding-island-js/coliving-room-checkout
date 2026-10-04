import { getRooms } from "@/lib/rooms";
import CheckoutForm from "./CheckoutForm";

export default async function Home() {
  const rooms = (await getRooms()).filter((r) => r.status === "VACANT");
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Available rooms</h1>
      <p>Pick a room and a rent schedule. Your room is held for 45 minutes while you pay.</p>
      <CheckoutForm rooms={rooms} />
    </main>
  );
}
