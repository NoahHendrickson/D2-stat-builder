import { test, expect } from "vitest";
import { characterForClass } from "./character-for-class";

test("picks the most-recently-played character of the given class", () => {
  const chars = [
    { id: "a", classType: 1, dateLastPlayed: "2026-01-01T00:00:00Z" },
    { id: "b", classType: 1, dateLastPlayed: "2026-06-01T00:00:00Z" },
    { id: "c", classType: 2, dateLastPlayed: "2026-07-01T00:00:00Z" },
  ];
  expect(characterForClass(chars, 1)?.id).toBe("b");
  expect(characterForClass(chars, 2)?.id).toBe("c");
});

test("returns undefined when no character matches the class", () => {
  expect(characterForClass([{ id: "a", classType: 0, dateLastPlayed: "2026-01-01T00:00:00Z" }], 1)).toBeUndefined();
});
