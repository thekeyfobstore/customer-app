import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { contacts, appSettings } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
  const apiKey = rows[0]?.value;
  if (!apiKey) { console.log("No API key"); process.exit(1); }
  
  // Get one real contact to test
  const allContacts = await db.select().from(contacts);
  const real = allContacts.find(c => {
    return c.openPhoneId && c.openPhoneId.indexOf("conv-") !== 0 && c.phone;
  });
  if (!real) { console.log("No test contact"); process.exit(1); }
  
  const phoneDigits = (real.phone || "").replace(/\D/g, "");
  const sourceUrl = `https://custcrmapp-nxdjk2u8.manus.space/link?phone=${phoneDigits}`;
  
  console.log("Testing with:", real.phone, real.openPhoneId);
  console.log("SourceUrl:", sourceUrl);
  
  const res = await fetch(`https://api.openphone.com/v1/contacts/${real.openPhoneId}`, {
    method: "PATCH",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceUrl,
      source: "ClientBook",
    }),
  });
  
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2).substring(0, 500));
  process.exit(0);
}

main();
