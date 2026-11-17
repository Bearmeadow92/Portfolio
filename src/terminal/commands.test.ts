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
    expect(runCommand("scene breach", ctx).action).toEqual({ type: "scene", value: "breach" });
    expect(runCommand("theme chrome", ctx).action).toEqual({ type: "scene", value: "chrome" }); // Alias.
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

describe("hostile input", () => {
  // Names that exist on every plain JavaScript object through its prototype.
  const builtins = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "prototype"];

  it("never treats inherited object properties as commands", () => {
    for (const name of builtins) {
      expect(runCommand(name, ctx).lines[0]!.text).toContain("command not found");
    }
  });

  it("never treats inherited object properties as files", () => {
    // Regression: `cat constructor` used to throw "content.map is not a function".
    for (const name of builtins) {
      expect(() => runCommand(`cat ${name}`, ctx)).not.toThrow();
      expect(runCommand(`cat ${name}`, ctx).lines[0]!.tone).toBe("bad");
    }
  });

  it("never throws on any argument to any command", () => {
    for (const cmd of ["play", "scene", "goto", "skills", "cat", "sudo", "echo"]) {
      for (const arg of [...builtins, "<script>alert(1)</script>", "../../etc/passwd", "%00", "a".repeat(5000)]) {
        expect(() => runCommand(`${cmd} ${arg}`, ctx)).not.toThrow();
      }
    }
  });

  it("caps very long input", () => {
    const echoed = runCommand(`echo ${"x".repeat(5000)}`, ctx).lines[0]!.text;
    expect(echoed.length).toBeLessThan(200);
  });
});

describe("complete", () => {
  it("completes command names and arguments", () => {
    expect(complete("who")).toEqual(["whoami"]);
    expect(complete("play fire")).toEqual(["play firewall"]);
    expect(complete("scene dr")).toEqual(["scene drivetrain"]);
  });
});
