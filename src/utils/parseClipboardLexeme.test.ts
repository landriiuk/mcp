import { describe, expect, it } from "vitest";
import { parseClipboardLexeme } from "./parseClipboardLexeme";

describe("parseClipboardLexeme", () => {
  it("returns null for empty input", () => {
    expect(parseClipboardLexeme("")).toBeNull();
    expect(parseClipboardLexeme("   ")).toBeNull();
  });

  it("treats a single token as word only", () => {
    expect(parseClipboardLexeme("apple")).toEqual({ word: "apple", meaning: "" });
  });

  it("splits em dash / en dash / hyphen pairs", () => {
    expect(parseClipboardLexeme("apple — яблуко")).toEqual({
      word: "apple",
      meaning: "яблуко",
    });
    expect(parseClipboardLexeme("brief - short")).toEqual({
      word: "brief",
      meaning: "short",
    });
  });

  it("splits tab-separated pairs", () => {
    expect(parseClipboardLexeme("apple\tяблуко")).toEqual({
      word: "apple",
      meaning: "яблуко",
    });
  });

  it("uses the first non-empty line only", () => {
    expect(parseClipboardLexeme("\napple — fruit\nbanana")).toEqual({
      word: "apple",
      meaning: "fruit",
    });
  });
});
