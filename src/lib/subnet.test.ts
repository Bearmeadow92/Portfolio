/**
 * @file Unit tests for subnet.ts.
 */
import { describe, expect, it } from "vitest";
import { calculateSubnet, parseIp, toIp } from "./subnet";

describe("parseIp / toIp", () => {
  it("round trips addresses", () => {
    for (const ip of ["0.0.0.0", "10.1.2.3", "192.168.1.255", "255.255.255.255"]) {
      expect(toIp(parseIp(ip)!)).toBe(ip);
    }
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "1.2.3", "1.2.3.4.5", "256.1.1.1", "1.2.3.-4", "01.2.3.4", "a.b.c.d"]) {
      expect(parseIp(bad)).toBeNull();
    }
  });
});

describe("calculateSubnet", () => {
  it("handles a classic /24", () => {
    const r = calculateSubnet("192.168.1.42/24")!;
    expect(r.network).toBe("192.168.1.0");
    expect(r.broadcast).toBe("192.168.1.255");
    expect(r.mask).toBe("255.255.255.0");
    expect(r.wildcard).toBe("0.0.0.255");
    expect(r.firstHost).toBe("192.168.1.1");
    expect(r.lastHost).toBe("192.168.1.254");
    expect(r.usableHosts).toBe(254);
    expect(r.scope).toBe("Private (RFC 1918)");
    expect(r.ipClass).toBe("C");
  });

  it("handles non octet boundaries", () => {
    const r = calculateSubnet("172.16.20.5/20")!;
    expect(r.network).toBe("172.16.16.0");
    expect(r.broadcast).toBe("172.16.31.255");
    expect(r.usableHosts).toBe(4094);
  });

  it("treats /31 and /32 per RFC 3021", () => {
    expect(calculateSubnet("10.0.0.0/31")!.usableHosts).toBe(2);
    const host = calculateSubnet("8.8.8.8/32")!;
    expect(host.usableHosts).toBe(1);
    expect(host.firstHost).toBe("8.8.8.8");
    expect(host.scope).toBe("Public");
  });

  it("handles /0 without overflowing 32 bits", () => {
    const r = calculateSubnet("1.2.3.4/0")!;
    expect(r.network).toBe("0.0.0.0");
    expect(r.broadcast).toBe("255.255.255.255");
    expect(r.totalAddresses).toBe(2 ** 32);
  });

  it("rejects invalid prefixes", () => {
    expect(calculateSubnet("10.0.0.1/33")).toBeNull();
    expect(calculateSubnet("10.0.0.1/abc")).toBeNull();
  });
});
