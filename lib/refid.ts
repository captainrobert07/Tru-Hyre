import { randomBytes } from "crypto";

export function makeRefId(prefix = "TH"): string {
  const bytes = randomBytes(4).toString("hex").toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${ts}-${bytes}`;
}
