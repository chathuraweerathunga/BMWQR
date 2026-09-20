import { describe, expect, it } from "vitest";
import {
  attemptTransition,
  getAllowedNextStatuses,
  isTerminalStatus,
  TERMINAL_STATUSES,
} from "./state-machine";
import type { RequestStatus } from "./types";

const ALL_STATUSES: RequestStatus[] = [
  "NEW",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
];

describe("state machine: happy path", () => {
  it("walks the full lifecycle NEW -> ACCEPTED -> IN_PROGRESS -> COMPLETED -> CLOSED", () => {
    const path: Array<[RequestStatus, RequestStatus]> = [
      ["NEW", "ACCEPTED"],
      ["ACCEPTED", "IN_PROGRESS"],
      ["IN_PROGRESS", "COMPLETED"],
      ["COMPLETED", "CLOSED"],
    ];
    for (const [from, to] of path) {
      const result = attemptTransition({ from, to, actorKind: "staff_or_manager" });
      expect(result.ok, `${from} -> ${to} should be allowed`).toBe(true);
    }
  });

  it("stamps the correct timestamp field for each forward transition", () => {
    expect(
      attemptTransition({ from: "NEW", to: "ACCEPTED", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true, timestampField: "acceptedAt" });
    expect(
      attemptTransition({ from: "ACCEPTED", to: "IN_PROGRESS", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true, timestampField: "startedAt" });
    expect(
      attemptTransition({ from: "IN_PROGRESS", to: "COMPLETED", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true, timestampField: "completedAt" });
    expect(
      attemptTransition({ from: "COMPLETED", to: "CLOSED", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true, timestampField: "closedAt" });
  });
});

describe("state machine: rejection and cancellation branches", () => {
  it("allows staff to reject a NEW request", () => {
    expect(
      attemptTransition({ from: "NEW", to: "REJECTED", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true });
  });

  it("does not allow a guest to reject a request", () => {
    expect(
      attemptTransition({ from: "NEW", to: "REJECTED", actorKind: "guest" }),
    ).toEqual({ ok: false, reason: "ACTOR_NOT_PERMITTED_FOR_TRANSITION" });
  });

  it.each<RequestStatus>(["NEW", "ACCEPTED"])(
    "allows a guest to cancel their own request while it is %s",
    (from) => {
      expect(
        attemptTransition({ from, to: "CANCELLED", actorKind: "guest" }),
      ).toMatchObject({ ok: true });
    },
  );

  it("does not allow a guest to cancel once work is IN_PROGRESS", () => {
    expect(
      attemptTransition({ from: "IN_PROGRESS", to: "CANCELLED", actorKind: "guest" }),
    ).toEqual({ ok: false, reason: "ACTOR_NOT_PERMITTED_FOR_TRANSITION" });
  });

  it("allows staff to cancel IN_PROGRESS work", () => {
    expect(
      attemptTransition({ from: "IN_PROGRESS", to: "CANCELLED", actorKind: "staff_or_manager" }),
    ).toMatchObject({ ok: true });
  });
});

describe("state machine: invalid and terminal transitions", () => {
  it("rejects skipping a state (NEW -> IN_PROGRESS)", () => {
    expect(
      attemptTransition({ from: "NEW", to: "IN_PROGRESS", actorKind: "staff_or_manager" }),
    ).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });

  it("rejects going backwards (IN_PROGRESS -> ACCEPTED)", () => {
    expect(
      attemptTransition({ from: "IN_PROGRESS", to: "ACCEPTED", actorKind: "staff_or_manager" }),
    ).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });

  it("rejects a no-op self-transition", () => {
    expect(
      attemptTransition({ from: "ACCEPTED", to: "ACCEPTED", actorKind: "staff_or_manager" }),
    ).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });

  it.each([...TERMINAL_STATUSES])(
    "refuses any transition out of terminal state %s",
    (from) => {
      for (const to of ALL_STATUSES) {
        if (to === from) continue;
        expect(
          attemptTransition({ from, to, actorKind: "staff_or_manager" }),
        ).toEqual({ ok: false, reason: "TERMINAL_STATE" });
      }
    },
  );

  it("isTerminalStatus agrees with TERMINAL_STATUSES", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(TERMINAL_STATUSES.has(status));
    }
  });
});

describe("getAllowedNextStatuses", () => {
  it("returns both accept and reject and cancel for staff from NEW", () => {
    expect(new Set(getAllowedNextStatuses("NEW", "staff_or_manager"))).toEqual(
      new Set(["ACCEPTED", "REJECTED", "CANCELLED"]),
    );
  });

  it("returns only cancel for a guest from NEW", () => {
    expect(getAllowedNextStatuses("NEW", "guest")).toEqual(["CANCELLED"]);
  });

  it("returns nothing from a terminal state", () => {
    expect(getAllowedNextStatuses("CLOSED", "staff_or_manager")).toEqual([]);
    expect(getAllowedNextStatuses("CANCELLED", "guest")).toEqual([]);
  });
});
