import dns from "node:dns/promises";
import net from "node:net";

export class UrlValidationError extends Error {
  code = "URL_REJECTED";
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded v4 address too.
    return isPrivateIPv4(lower.slice("::ffff:".length));
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return false;
}

export interface UrlValidationOptions {
  /** Allow private/loopback hosts — only for local dev and the batch harness
   * (Section 9: company sites there may be served from a local address). */
  allowLocal: boolean;
}

/**
 * Validates a URL is safe to fetch: http(s) only, and (unless explicitly
 * allowed for local dev/batch mode) not pointing at a private or loopback
 * address, to close off SSRF against internal services (Section 11).
 */
export async function assertUrlIsFetchable(
  rawUrl: string,
  options: UrlValidationOptions
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlValidationError(`Not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError(`Unsupported protocol: ${url.protocol}`);
  }

  if (options.allowLocal) return url;

  const hostname = url.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UrlValidationError("Local hosts are not allowed in this environment");
  }

  const directIpVersion = net.isIP(hostname);
  if (directIpVersion && isPrivateIp(hostname)) {
    throw new UrlValidationError(`Refusing to fetch private address: ${hostname}`);
  }

  if (!directIpVersion) {
    let resolved: { address: string }[];
    try {
      resolved = await dns.lookup(hostname, { all: true });
    } catch {
      throw new UrlValidationError(`Could not resolve host: ${hostname}`);
    }
    if (resolved.some((r) => isPrivateIp(r.address))) {
      throw new UrlValidationError(`Host resolves to a private address: ${hostname}`);
    }
  }

  return url;
}
