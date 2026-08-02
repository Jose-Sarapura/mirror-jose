import { NextResponse } from "next/server";

export function middleware(request) {
  const auth = request.cookies.get("mirror-auth");

  if (!auth && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
};