// Convex Auth issues the tokens itself; this tells Convex to trust them.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
