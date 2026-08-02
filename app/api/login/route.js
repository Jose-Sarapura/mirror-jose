import { NextResponse } from "next/server";

export async function POST(request) {
  const { user, password } = await request.json();

  if (
    user === process.env.MIRROR_USER &&
    password === process.env.MIRROR_PASSWORD
  ) {
    const response = NextResponse.json({ success: true });

    response.cookies.set("mirror-auth", "true", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  }

  return NextResponse.json(
    { success: false },
    { status: 401 }
  );
}