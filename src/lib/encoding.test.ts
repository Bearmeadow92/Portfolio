/**
 * @file Unit tests for encoding.ts.
 */
import { describe, expect, it } from "vitest";
import { codecs, hash, rot13, type Codec } from "./encoding";

describe("codecs", () => {
  const samples = ["Hello, world!", "Ship it 🚀", "ünïcødé ✓", ""];

  it("round trips every codec, including emoji", () => {
    for (const name of Object.keys(codecs) as Codec[]) {
      for (const s of samples) {
        expect(codecs[name].decode(codecs[name].encode(s))).toBe(s);
      }
    }
  });

  it("matches known encodings", () => {
    expect(codecs.base64.encode("hi")).toBe("aGk=");
    expect(codecs.hex.encode("hi")).toBe("68 69");
    expect(codecs.binary.encode("A")).toBe("01000001");
    expect(rot13("Hello")).toBe("Uryyb");
  });

  it("throws on invalid input", () => {
    expect(() => codecs.hex.decode("abc")).toThrow();
    expect(() => codecs.binary.decode("0102")).toThrow();
  });
});

describe("hash", () => {
  it("produces the known SHA-256 of 'abc'", async () => {
    expect(await hash("abc", "SHA-256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
