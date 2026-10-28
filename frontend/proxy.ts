import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirige vers la page de connexion quand on ouvre un espace protégé sans session.
 * La vérification du rôle se fait ensuite côté application (RequireRole) et côté API.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("ld_refresh") || request.cookies.has("ld_access");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/apprenant/:path*", "/formateur/:path*", "/admin/:path*", "/bienvenue"],
};
