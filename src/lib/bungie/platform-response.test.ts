import { describe, expect, it } from "vitest";
import {
  profileErrorMessage,
  shouldClearSessionOnBungieError,
} from "./platform-response";

describe("profileErrorMessage", () => {
  it("prefers a known message and appends Bungie detail", () => {
    expect(
      profileErrorMessage({
        ErrorCode: 12,
        ErrorStatus: "InsufficientPrivileges",
        Message: "Membership ID not found",
      }),
    ).toBe(
      "Bungie denied access — check your Destiny privacy settings (inventory must be visible to third-party apps) (InsufficientPrivileges: Membership ID not found)",
    );
  });

  it("falls back to Bungie status and message for unknown codes", () => {
    expect(
      profileErrorMessage({
        ErrorCode: 999,
        ErrorStatus: "WeirdError",
        Message: "Something broke",
      }),
    ).toBe("WeirdError: Something broke");
  });

  it("handles a bare error code", () => {
    expect(profileErrorMessage({ ErrorCode: 0 })).toBe(
      "Bungie profile request failed (error 0)",
    );
  });
});

describe("shouldClearSessionOnBungieError", () => {
  it("clears session on AuthenticationInvalid only", () => {
    expect(shouldClearSessionOnBungieError(10)).toBe(true);
    expect(shouldClearSessionOnBungieError(12)).toBe(false);
  });
});
