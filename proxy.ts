import { NextResponse } from "next/server"
import { auth } from "@/auth"

// Next.js 16 renamed Middleware to Proxy (see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
// Proxy defaults to the Node.js runtime here, so the full `auth` config (Postgres + bcrypt) can run directly.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAuthed = !!req.auth

  if (!isAuthed && !isPublicPath) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isAuthed && isPublicPath) {
    const url = req.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: [
    "/((?!api/auth|api/password-reset|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
