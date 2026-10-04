import directory from "../../data/room-directory.json";

export type Cadence = "weekly" | "biweekly" | "monthly";
export type Room = {
  id: string;
  property: string;
  name: string;
  status: "VACANT" | "OCCUPIED";
  rentCents: Record<Cadence, number>;
  moveInFeeCents: number;
};

// Stand-in for the ClickUp Room Directory. The site keeps no copy of business data:
// in production these two functions call the ClickUp API live, with a short TTL at most.
export async function getRooms(): Promise<Room[]> {
  return directory as Room[];
}

export async function getRoom(id: string): Promise<Room | undefined> {
  return (await getRooms()).find((r) => r.id === id);
}
