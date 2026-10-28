/**
 * Client HTTP de l'application.
 *
 * Toutes les requêtes passent par /api (proxy Next.js vers Django). L'authentification
 * repose sur des cookies httpOnly : le navigateur les envoie automatiquement. Quand le
 * jeton d'accès expire (401), on demande un nouveau jeton une seule fois puis on rejoue
 * la requête.
 */

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[] | string>;

  constructor(message: string, status: number, errors: Record<string, string[] | string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** Premier message d'erreur pour un champ de formulaire. */
  field(name: string): string | undefined {
    const value = this.errors[name];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  keepalive?: boolean;
}

let refreshing: Promise<boolean> | null = null;

/** Vrai si le navigateur a une session (cookie indicatif posé par l'API à la connexion). */
export function hasSessionHint(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)ld_session=/.test(document.cookie);
}

async function refreshSession(): Promise<boolean> {
  if (!hasSessionHint()) return false;
  try {
    const response = await fetch("/api/auth/refresh/", { method: "POST", credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}

function send(path: string, { method = "GET", body, signal, keepalive }: RequestOptions) {
  return fetch(path, {
    method,
    credentials: "include",
    signal,
    keepalive,
    headers: body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = "Une erreur est survenue. Réessaie dans un instant.";
  let errors: Record<string, string[] | string> = {};
  try {
    const data = await response.json();
    if (data && typeof data === "object") {
      detail = (data.detail as string) || detail;
      errors = (data.errors as Record<string, string[]>) || {};
    }
  } catch {
    if (response.status >= 500) detail = "Le serveur ne répond pas correctement. Vérifie que le backend est lancé.";
  }
  if (response.status === 429) detail = "Trop de tentatives. Patiente une minute avant de réessayer.";
  return new ApiError(detail, response.status, errors);
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      refreshing ??= refreshSession().finally(() => {
        refreshing = null;
      });
      if (await refreshing) response = await send(path, options);
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("Impossible de joindre le serveur. Vérifie ta connexion.", 0);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return null as T; // corps vide (ex. « pas encore de quiz »)
  const type = response.headers.get("content-type") || "";
  return (type.includes("application/json") ? JSON.parse(text) : text) as T;
}

/** Télécharge un fichier (export CSV) renvoyé par l'API. */
export async function downloadFile(path: string, filename: string) {
  const response = await send(path, {});
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** Construit une URL avec paramètres en ignorant les valeurs vides. */
export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
