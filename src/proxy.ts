import { auth } from "@/auth";

// Next 16: the middleware file convention is deprecated; this is proxy.ts.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  // Everything except: NextAuth routes, the Postmark webhook (token-secured),
  // the login page, and static assets.
  matcher: [
    "/((?!api/auth|api/inbound-email|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
