export function normalizePublicApiBase(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return "";

  const parsed = new URL(candidate);
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) origin without credentials, query, or fragment.");
  }

  return parsed.origin;
}

export const publicApiBase = normalizePublicApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);

export function toApiUrl(path: string): string {
  if (!path.startsWith("/")) throw new Error("API paths must be root-relative.");
  return `${publicApiBase}${path}`;
}

export function toApiResourceUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) throw new Error("API resource paths must be absolute HTTP(S) URLs or root-relative paths.");
  return toApiUrl(value);
}
