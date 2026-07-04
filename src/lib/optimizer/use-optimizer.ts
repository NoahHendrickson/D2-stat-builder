"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeCeilingCarry } from "./carryover";
import type {
  OptimizerInput,
  OptimizerOutput,
  OptimizerRequest,
  OptimizerResponse,
  RefinementState,
  StatArray,
} from "./types";

const IDLE: RefinementState = { phase: "idle" };

/**
 * Element-wise max of the displayed ceilings and an update. Every ceiling the app
 * shows is proven-achievable for the current query, so within one run the displayed
 * value must never regress — all ceiling writes during/after a refinement go through
 * this one helper.
 */
function mergeCeilingsMonotone(prev: StatArray | null, next: StatArray): StatArray {
  return prev ? next.map((v, s) => Math.max(v, prev[s])) : next;
}

/**
 * Drives the optimizer Web Worker. Runs are tagged with an increasing seq so that when
 * changes fire faster than the worker finishes, only the latest run's messages are applied
 * (stale ones are dropped). Ceilings stream in ahead of the final result for live slider
 * animation; the previous result stays visible while a new run is in flight (no flicker).
 *
 * A time-capped search posts a result whose build list is FINAL for this query — the
 * list never changes under the reader — and moves `refinement` to "running" while the
 * worker keeps refining in the background: rising ceilings surface live in the slider
 * overlays, and a strictly-better build list lands as `refinement.pending`, applied
 * only via `applyPending()` (an explicit user action). The worker stays "in flight"
 * through refinement so a new run (or cancel) terminates the background CPU work
 * immediately.
 */
export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  // Whether a solve is in flight on the current worker. A worker is single-threaded, so a
  // message posted mid-solve would queue behind it — run() checks this to terminate first.
  const inFlightRef = useRef(false);
  // The input of the run currently producing messages, paired with each result so lastRef
  // can be updated with a matching (input, output). Set on every run() before postMessage.
  const inFlightInputRef = useRef<OptimizerInput | null>(null);
  // The most recent (input, output) pair — the source for cross-edit ceiling carryover.
  // Updated on EVERY result message (interim and final): an interim output's uppers are
  // proven too (Step 3), so a slider adjustment mid-refinement can still carry bounds from
  // a killed worker's last post. cancel() leaves this intact so the next run can carry.
  const lastRef = useRef<{ input: OptimizerInput; output: OptimizerOutput } | null>(null);
  const [result, setResult] = useState<OptimizerOutput | null>(null);
  const [ceilings, setCeilings] = useState<StatArray | null>(null);
  // Are the displayed ceilings PROVEN maxima? False while a run streams or a background
  // refinement is still probing — every displayed ceiling is achievable either way, but
  // the UI must present unproven ones as "at least", never as "max" (solve.ts contract).
  const [ceilingsExact, setCeilingsExact] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  // Single source of truth for the background-refinement lifecycle. The ref mirrors
  // the state so the stable onmessage closure always reads the current phase.
  const refinementRef = useRef<RefinementState>(IDLE);
  const [refinement, setRefinementState] = useState<RefinementState>(IDLE);
  const setRefinement = useCallback((next: RefinementState) => {
    refinementRef.current = next;
    setRefinementState(next);
  }, []);
  // Identity of the latest run — lets the UI restart progress animation per search.
  const [runId, setRunId] = useState(0);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent<OptimizerResponse>) => {
        const msg = e.data;
        if (msg.seq !== seqRef.current) return; // superseded run — ignore
        const ref = refinementRef.current;
        switch (msg.kind) {
          case "progress":
            if (ref.phase === "running") {
              setRefinement({ ...ref, progress: msg.progress });
            } else {
              setProgress(msg.progress);
            }
            break;
          case "ceilings":
            setCeilings((prev) =>
              ref.phase === "running"
                ? mergeCeilingsMonotone(prev, msg.ceilings)
                : msg.ceilings,
            );
            break;
          case "better":
            // The background search beat the frozen list — hold it, don't apply it.
            if (ref.phase === "running") {
              setRefinement({ ...ref, pending: msg.output });
            }
            break;
          case "result":
            setCeilingsExact(msg.output.ceilingsExact);
            // Record the latest (input, output) for cross-edit carryover. Every posted
            // result — interim or final — carries proven uppers (Step 3), so both are
            // valid carry sources; the last one wins.
            if (inFlightInputRef.current) {
              lastRef.current = {
                input: inFlightInputRef.current,
                output: msg.output,
              };
            }
            if (msg.refining) {
              // Time-capped search: its build list is final and shown now (and never
              // replaced); the worker is still refining, so stay "in flight" for
              // cancellation.
              setResult(msg.output);
              setCeilings(msg.output.ceilings);
              setRunning(false);
              setRefinement({
                phase: "running",
                progress: 0,
                interim: msg.output,
                pending: null,
              });
            } else {
              inFlightRef.current = false;
              // After a refinement this carries the SAME loadouts (list stays frozen)
              // with the refined ceilings.
              setResult(msg.output);
              setCeilings((prev) =>
                ref.phase === "running"
                  ? mergeCeilingsMonotone(prev, msg.output.ceilings)
                  : msg.output.ceilings,
              );
              setRunning(false);
              if (ref.phase === "running") {
                const rose = msg.output.ceilings.some(
                  (v, s) => v > ref.interim.ceilings[s],
                );
                // "confirmed" is a proven claim about BOTH halves: the build walk ran
                // to exhaustion (msg.verified) AND the ceilings are proven exact
                // (output.ceilingsExact). Anything less resolves to a null outcome so
                // the UI never overclaims.
                setRefinement({
                  phase: "done",
                  outcome: rose
                    ? "improved"
                    : msg.verified && msg.output.ceilingsExact
                      ? "confirmed"
                      : null,
                  pending: ref.pending,
                  verified: msg.verified,
                });
              }
            }
            break;
          default: {
            const _exhaustive: never = msg;
            void _exhaustive;
          }
        }
      };
      worker.onerror = () => {
        inFlightRef.current = false;
        setRunning(false);
        setRefinement(IDLE);
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, [setRefinement]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = useCallback(
    (input: OptimizerInput) => {
      const seq = ++seqRef.current;
      // Kill a superseded solve so this one starts immediately instead of queueing
      // behind it (the worker is stateless — recreating it costs single-digit ms).
      // inFlight covers background refinement too: its CPU work dies here.
      if (inFlightRef.current) {
        workerRef.current?.terminate();
        workerRef.current = null;
      }
      inFlightRef.current = true;
      inFlightInputRef.current = input;
      setRunning(true);
      setProgress(0);
      setCeilingsExact(false); // the new query's ceilings are unproven until its result lands
      setRefinement(IDLE);
      setRunId(seq);
      // Carry proven ceiling bounds from the previous query when this edit only changed
      // the minimums — lets the worker skip re-proving what the last query established.
      // computeCeilingCarry returns undefined whenever the carry wouldn't be sound.
      const last = lastRef.current;
      const carry = last
        ? computeCeilingCarry(last.input, last.output, input)
        : undefined;
      getWorker().postMessage({ seq, input, carry } satisfies OptimizerRequest);
    },
    [getWorker, setRefinement],
  );

  // Abandon the in-flight run: bump the seq (so any late messages are ignored) and tear
  // the worker down so its CPU work stops.
  const cancel = useCallback(() => {
    seqRef.current++;
    inFlightRef.current = false;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setRefinement(IDLE);
  }, [setRefinement]);

  // Swap the offered better list in — the explicit user action that lets a shown list
  // change. Ceilings only max-merge (both lists' ceilings are proven-achievable).
  const applyPending = useCallback(() => {
    const ref = refinementRef.current;
    if (ref.phase !== "done" || !ref.pending) return;
    const pending = ref.pending;
    setRefinement(IDLE);
    setResult(pending);
    setCeilings((prev) => mergeCeilingsMonotone(prev, pending.ceilings));
    setCeilingsExact(pending.ceilingsExact);
  }, [setRefinement]);

  return {
    run,
    cancel,
    result,
    ceilings,
    ceilingsExact,
    running,
    progress,
    runId,
    refinement,
    applyPending,
  };
}
