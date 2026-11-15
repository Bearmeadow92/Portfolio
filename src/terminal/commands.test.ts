/**
 * @file Unit tests for commands.ts.
 */
import { describe, expect, it } from "vitest";
import { complete, runCommand } from "./commands";

const ctx = { history: [] as string[] };

describe("runCommand", () => {
  it("lists commands with help", () => {
    const out = runCommand("help", ctx).lines.map((l) => l.text).join("\n");
    expect(out).toContain("whoami");
    expect(out).not.toContain("coffee"); // Hidden commands stay hidden.
  });

  it("reports unknown commands", () => {
    expect(runCommand("hack-the-planet", ctx).lines[0]!.tone).toBe("bad");
  });

  it("returns side effect actions", () => {
    expect(runCommand("play firewall", ctx).action).toEqual({ type: "open", id: "firewall" });
    expect(runCommand("scene ripple", ctx).action).toEqual({ type: "scene", value: "ripple" });
    expect(runCommand("theme halftone", ctx).action).toEqual({ type: "scene", value: "halftone" }); // Alias.
    expect(runCommand("cd contact", ctx).action).toEqual({ type: "navigate", target: "contact" });
    expect(runCommand("clear", ctx).action).toEqual({ type: "clear" });
  });

  it("knows the most important command", () => {
    const r = runCommand("sudo hire-jesse", ctx);
    expect(r.lines.some((l) => l.text.includes("Access granted"))).toBe(true);
  });

  it("ignores blank input", () => {
    expect(runCommand("   ", ctx).lines).toEqual([]);
  });
});

describe("complete", () => {
  it("completes command names and arguments", () => {
    expect(complete("who")).toEqual(["whoami"]);
    expect(complete("play fire")).toEqual(["play firewall"]);
    expect(complete("scene si")).toEqual(["scene signal"]);
  });
});
