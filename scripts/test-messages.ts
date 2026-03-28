import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { appSettings } from "../drizzle/schema";

const BASE_URL = "https://api.openphone.com/v1";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
  const apiKey = rows[0]?.value;
  if (!apiKey) { console.log("No API key"); process.exit(1); }

  // Get phone number IDs
  const pnRes = await fetch(`${BASE_URL}/phone-numbers`, {
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
  });
  const pnData = await pnRes.json();
  const phoneNumberIds = (pnData.data || []).map((p: any) => p.id);
  console.log("Phone number IDs:", phoneNumberIds);

  // Test with a known contact
  const testPhone = "+19022291500"; // PAUL SHAKOTKO
  for (const pnId of phoneNumberIds) {
    const url = `${BASE_URL}/messages?phoneNumberId=${pnId}&participants=${encodeURIComponent(testPhone)}&maxResults=10`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    const data = await res.json();
    const msgs = data.data || [];
    if (msgs.length > 0) {
      console.log(`\nFound ${msgs.length} messages on pnId ${pnId}:`);
      for (const m of msgs) {
        const body = m.body || "(empty)";
        console.log(`  [${m.direction}] ${m.createdAt}: ${body.substring(0, 120)}`);
      }
      break;
    }
  }

  // Also test fetching recent conversations to see what's active
  console.log("\n=== Recent conversations ===");
  for (const pnId of phoneNumberIds) {
    const url = `${BASE_URL}/messages?phoneNumberId=${pnId}&maxResults=20`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    const data = await res.json();
    const msgs = data.data || [];
    // Group by from/to to see unique conversations
    const seen = new Set<string>();
    for (const m of msgs) {
      const otherParty = m.direction === "incoming" ? m.from : m.to;
      if (typeof otherParty === "string" && !seen.has(otherParty)) {
        seen.add(otherParty);
        const body = m.body || "(empty)";
        console.log(`  ${otherParty} [${m.direction}] ${m.createdAt}: ${body.substring(0, 80)}`);
      }
    }
    if (seen.size > 0) break;
  }

  process.exit(0);
}

main();
