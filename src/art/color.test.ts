/**
 * @file Unit tests for color.ts.
 */
import { describe, expect, it } from "vitest";
import { hexToVec3 } from "./color";

describe("hexToVec3", () => {
  it("parses six digit hex", () => {
    expect(hexToVec3("#ff4433")).toEqual([1, 0x44 / 255, 0x33 / 255]);
  });

  it("expands three digit hex, which the CSS minifier produces", () => {
    // Regression: "#f43" used to parse as 0x000f43, a dark navy, instead of red.
    expect(hexToVec3("#f43")).toEqual(hexToVec3("#ff4433"));
    expect(hexToVec3(" #F43 ")).toEqual(hexToVec3("#ff4433"));
  });

  it("ignores alpha in four and eight digit hex", () => {
    expect(hexToVec3("#f43a")).toEqual(hexToVec3("#ff4433"));
    expect(hexToVec3("#ff4433aa")).toEqual(hexToVec3("#ff4433"));
  });

  it("falls back to black for anything else", () => {
    expect(hexToVec3("")).toEqual([0, 0, 0]);
    expect(hexToVec3("red")).toEqual([0, 0, 0]);
    expect(hexToVec3("#12345")).toEqual([0, 0, 0]);
  });
});
