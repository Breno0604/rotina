import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly maintenance: age observed memories that lost their grounding in
// recent data (see memories.runStalenessCheck).
crons.weekly(
  "revisar-memorias-observadas",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.memories.runStalenessCheck,
);

export default crons;