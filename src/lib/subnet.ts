/**
 * @file IPv4 subnet math with 32-bit unsigned integers.
 * Every operation is O(1). `>>> 0` forces JavaScript numbers back to unsigned 32-bit.
 */

export interface SubnetInfo {
  ip: string;
  cidr: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  scope: string;
  binaryIp: string;
  binaryMask: string;
}

/** Parses dotted decimal ("10.0.0.1") into an unsigned 32-bit integer, or null if invalid. */
export function parseIp(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    // Reject empty parts, signs, and leading zeros like "01" (ambiguous octal notation).
    if (!/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith("0"))) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

/** Formats an unsigned 32-bit integer as dotted decimal. */
export function toIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/** Formats a 32-bit value as four dot separated binary octets. */
export function toBinary(n: number): string {
  return (n >>> 0).toString(2).padStart(32, "0").replace(/(.{8})(?!$)/g, "$1.");
}

/**
 * Converts a prefix length to a subnet mask.
 * /0 is special cased because JavaScript shifts are modulo 32, so `x << 32` equals `x << 0`.
 */
export function cidrToMask(cidr: number): number {
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
}

/** Legacy address class plus the special-purpose range (private, loopback, and so on). */
function classify(ip: number): { ipClass: string; scope: string } {
  const first = ip >>> 24;
  const ipClass = first < 128 ? "A" : first < 192 ? "B" : first < 224 ? "C" : first < 240 ? "D (multicast)" : "E (reserved)";
  const inRange = (base: string, bits: number) => ((ip & cidrToMask(bits)) >>> 0) === parseIp(base);
  let scope = "Public";
  if (inRange("10.0.0.0", 8) || inRange("172.16.0.0", 12) || inRange("192.168.0.0", 16)) scope = "Private (RFC 1918)";
  else if (inRange("127.0.0.0", 8)) scope = "Loopback";
  else if (inRange("169.254.0.0", 16)) scope = "Link-local (APIPA)";
  else if (inRange("100.64.0.0", 10)) scope = "Carrier-grade NAT";
  else if (first >= 224) scope = "Multicast / reserved";
  return { ipClass, scope };
}

/** Accepts "10.0.0.5/24" or an IP plus a separate CIDR. Returns null on invalid input. */
export function calculateSubnet(input: string, cidrOverride?: number): SubnetInfo | null {
  const [ipPart, cidrPart] = input.split("/");
  const ip = parseIp(ipPart ?? "");
  const cidr = cidrOverride ?? (cidrPart === undefined ? 24 : Number(cidrPart));
  if (ip === null || !Number.isInteger(cidr) || cidr < 0 || cidr > 32) return null;

  const mask = cidrToMask(cidr);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = 2 ** (32 - cidr);

  // /31 is point-to-point (RFC 3021) and /32 is a single host: both have no network/broadcast waste.
  const usable = cidr >= 31 ? total : total - 2;
  const first = cidr >= 31 ? network : network + 1;
  const last = cidr >= 31 ? broadcast : broadcast - 1;

  return {
    ip: toIp(ip),
    cidr,
    mask: toIp(mask),
    wildcard: toIp(~mask >>> 0),
    network: toIp(network),
    broadcast: toIp(broadcast),
    firstHost: toIp(first),
    lastHost: toIp(last),
    totalAddresses: total,
    usableHosts: usable,
    ...classify(ip),
    binaryIp: toBinary(ip),
    binaryMask: toBinary(mask),
  };
}
