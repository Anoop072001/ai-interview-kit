import { createHash } from "node:crypto";

export function contentHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}
