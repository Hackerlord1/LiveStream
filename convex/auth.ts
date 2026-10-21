import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

// Sites a sign-in may return to: the live site (SITE_URL) and local development
function allowedOrigins() {
  return [process.env.SITE_URL, "http://localhost:3000"]
    .filter((url): url is string => Boolean(url))
    .map((url) => new URL(url).origin);
}

// Google sign-in, used to post in the live TV chat. Needs AUTH_GOOGLE_ID,
// AUTH_GOOGLE_SECRET, SITE_URL, JWT_PRIVATE_KEY and JWKS set on the deployment.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    // The chat passes the page it was opened on, so viewers come back to their channel
    async redirect({ redirectTo }) {
      const site = process.env.SITE_URL;
      if (site && (redirectTo.startsWith("/") || redirectTo.startsWith("?"))) return `${site}${redirectTo}`;
      try {
        if (allowedOrigins().includes(new URL(redirectTo).origin)) return redirectTo;
      } catch {
        // not a URL
      }
      throw new Error(`Invalid redirectTo: ${redirectTo}`);
    },
  },
});
