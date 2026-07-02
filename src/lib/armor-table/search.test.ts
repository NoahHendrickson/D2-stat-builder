import { test, expect } from "vitest";
import {
  looseNameMatch,
  nameMatchesSearch,
  tokenizeSearchQuery,
} from "./search";

test("tokenizeSearchQuery splits on whitespace and lowercases", () => {
  expect(tokenizeSearchQuery("  Ferro   Smoke ")).toEqual(["ferro", "smoke"]);
  expect(tokenizeSearchQuery("")).toEqual([]);
});

test("looseNameMatch matches substrings ignoring case and punctuation", () => {
  expect(looseNameMatch("ferro", "Ferropotent Helm")).toBe(true);
  expect(looseNameMatch("smokejumper", "Smoke-Jumper Boots")).toBe(true);
});

test("looseNameMatch matches ordered subsequence for partial typing", () => {
  expect(looseNameMatch("frpot", "Ferropotent")).toBe(true);
  expect(looseNameMatch("ferro", "Smokejumper")).toBe(false);
});

test("nameMatchesSearch ORs tokens", () => {
  const tokens = tokenizeSearchQuery("ferro smoke");
  expect(nameMatchesSearch("Ferropotent Helm", tokens)).toBe(true);
  expect(nameMatchesSearch("Smokejumper Boots", tokens)).toBe(true);
  expect(nameMatchesSearch("Iron Will Suit", tokens)).toBe(false);
  expect(nameMatchesSearch("anything", [])).toBe(true);
});
