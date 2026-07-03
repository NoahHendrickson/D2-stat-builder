import { solve } from "./solve";
import type { OptimizerInput, OptimizerOutput } from "./types";

/**
 * Wall-clock budget for the background exhaustive pass after a capped first answer.
 * One worker core for up to this long, and any input change terminates the worker —
 * still far lighter than the competitors' every-core-for-the-whole-search approach.
 */
const REFINE_TOPN_BUDGET_MS = 30_000;
/** Ceiling-refinement budget for the background pass (more generous than pass 1's). */
const REFINE_CEILING_BUDGET_MS = 5_000;

export interface SessionCallbacks {
  /** 0–1 search progress. Streams for BOTH passes; the refining result post separates them. */
  onProgress: (progress: number) => void;
  /** Ceiling updates as they refine (seed first, then per-stat improvements). */
  onCeilings: (ceilings: number[]) => void;
  /**
   * A results post. `refining: true` means these are the best builds found within the
   * responsive budget and an exhaustive background pass is now running — a final post
   * always follows (same callback, `refining: false`).
   */
  onResult: (output: OptimizerOutput, refining: boolean) => void;
}

/** Budget overrides — production uses the defaults; tests shrink them to force capping. */
export interface SessionBudgets {
  topNBudgetMs?: number;
  ceilingBudgetMs?: number;
  refineTopNBudgetMs?: number;
  refineCeilingBudgetMs?: number;
}

/**
 * The worker's two-pass search session. Pass 1 runs on the responsive default budgets;
 * if it completes (the common case) its result is final. If it was time-capped, the
 * capped best-effort result is posted immediately (so the UI shows builds now) and a
 * second, much longer pass re-solves the same input for the exhaustive answer. Pass 2
 * restarts from scratch — a resumable search isn't worth the complexity for re-doing
 * pass 1's few seconds — and seeds its ceilings from pass 1's, so the streamed ceilings
 * never regress below what the UI already displayed. Cancellation is the caller's
 * problem (the main thread terminates the whole worker), which is why this can be a
 * plain synchronous function.
 */
export function runSolveSession(
  input: OptimizerInput,
  cb: SessionCallbacks,
  budgets: SessionBudgets = {},
): void {
  const first = solve(input, {
    onProgress: cb.onProgress,
    onCeilings: cb.onCeilings,
    topNBudgetMs: budgets.topNBudgetMs,
    ceilingBudgetMs: budgets.ceilingBudgetMs,
  });
  if (!first.capped) {
    cb.onResult(first, false);
    return;
  }
  cb.onResult(first, true);
  const second = solve(input, {
    onProgress: cb.onProgress,
    onCeilings: cb.onCeilings,
    topNBudgetMs: budgets.refineTopNBudgetMs ?? REFINE_TOPN_BUDGET_MS,
    ceilingBudgetMs: budgets.refineCeilingBudgetMs ?? REFINE_CEILING_BUDGET_MS,
    ceilingSeed: first.ceilings,
  });
  cb.onResult(second, false);
}
