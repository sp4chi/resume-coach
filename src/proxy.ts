import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed "middleware" to "proxy". The file must be named proxy.ts
// and sit beside the app directory. Clerk's docs still say middleware.ts --
// that name is deprecated in Next 16.
//
// This only attaches the session to the request. It does NOT decide who may
// see what. Clerk deprecated createRouteMatcher for that, because matching on
// paths can drift from how Next actually routes a request and quietly leave
// something reachable. Each route checks for itself instead -- see
// src/lib/user.ts and the `requireUser` call at the top of every API route.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static files, unless in a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
