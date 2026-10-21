import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Convex Auth's sign-in routes, including /api/auth/callback/google
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
