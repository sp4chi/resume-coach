import { auth } from "@clerk/nextjs/server";

// Before login existed, every route read `userId` from the request body.
// That was never safe -- a caller could pass any id and read someone else's
// resume. The id now comes from the signed session, server-side only.
//
// Each route calls this for itself rather than relying on path matching in
// proxy.ts. Clerk deprecated the middleware-matcher approach because path
// patterns can drift from real routing and leave data reachable.
//
// Returns the user id, or a 401 Response to hand straight back to the client.
export async function requireUser(): Promise<
  { userId: string; denied: null } | { userId: null; denied: Response }
> {
  const { userId } = await auth();
  if (!userId) {
    return {
      userId: null,
      denied: Response.json({ error: "not signed in" }, { status: 401 }),
    };
  }
  return { userId, denied: null };
}
