// Runs the rescue agent on one failure: tsx --conditions=react-server --env-file=.env.local scripts/spikes/diagnose.ts <donor name>
import { eq, ilike } from "drizzle-orm";
import { db, schema as s } from "../../src/db";
import { diagnose } from "../../src/server/ai/rescue";

const donor = await db.query.donors.findFirst({ where: ilike(s.donors.name, `${process.argv[2]}%`) });
if (!donor) throw new Error("no such donor");
const failure = await db.query.failures.findFirst({ where: eq(s.failures.donorId, donor.id) });
if (!failure) throw new Error("no failure for donor");
console.log(failure.id, await diagnose(failure.id));
process.exit(0);
