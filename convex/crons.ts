import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh token every 30 minutes
crons.interval("refresh-token", { minutes: 30 }, internal.iptv.refreshTokenCron);

export default crons;