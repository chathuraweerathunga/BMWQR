/**
 * Validates a post-login "return to" path. Only same-site relative paths
 * are allowed. `//evil.com` and `/\evil.com` start with "/" but browsers
 * treat them as a different host, so a naive `startsWith("/")` check is an
 * open redirect.
 */
export function safeRedirectPath(candidate: string | null | undefined, fallback = "/"): string {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 512) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // Control characters (tabs, newlines) are stripped by URL parsers and can
  // smuggle a second slash in.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, "https://oneweb.invalid");
    if (url.origin !== "https://oneweb.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
