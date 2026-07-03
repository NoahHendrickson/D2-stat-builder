"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OptimizerInput,
  OptimizerOutput,
  OptimizerRequest,
  OptimizerResponse,
  StatArray,
} from "./types";

/** Did the exhaustive pass beat the interim answer anywhere in the ranked list? */
function foundBetter(interim: OptimizerOutput, final: OptimizerOutput): boolean {
  if (final.loadouts.length > interim.loadouts.length) return true;
  return final.loadouts.some(
    (lo, i) => lo.total > (interim.loadouts[i]?.total ?? -1),
  );
}

/**
 * How a background refinement pass ended: the exhaustive search found better builds
 * than the responsive pass showed, or it confirmed nothing better exists. Null while
 * no refinement has resolved (including when even the background pass was capped —
 * that surfaces through `result.capped` instead).
 */
export type RefineOutcome = "improved" | "confirmed" | null;

/**
 * Drives the optimizer Web Worker. Runs are tagged with an increasing seq so that when
 * changes fire faster than the worker finishes, only the latest run's messages are applied
 * (stale ones are dropped). Ceilings stream in ahead of the final result for live slider
 * animation; the previous result stays visible while a new run is in flight (no flicker).
 *
 * A time-capped search posts an interim result (`refining` becomes true) and keeps
 * searching in the background; `refineProgress` streams the background pass, and when it
 * lands `refineOutcome` says whether it improved on the interim answer. The worker stays
 * "in flight" through refinement so a new run (or cancel) terminates the background CPU
 * work immediately.
 */
export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  // Whether a solve is in flight on the current worker. A worker is single-threaded, so a
  // message posted mid-solve would queue behind it — run() checks this to terminate first.
  const inFlightRef = useRef(false);
  // Between the interim (refining) result and the final one; refs mirror state for the
  // stable onmessage closure.
  const refiningRef = useRef(false);
  const interimRef = useRef<OptimizerOutput | null>(null);
  const [result, setResult] = useState<OptimizerOutput | null>(null);
  const [ceilings, setCeilings] = useState<StatArray | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refining, setRefining] = useState(false);
  const [refineProgress, setRefineProgress] = useState(0);
  const [refineOutcome, setRefineOutcome] = useState<RefineOutcome>(null);
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
        if (msg.kind === "progress") {
          if (refiningRef.current) setRefineProgress(msg.progress);
          else setProgress(msg.progress);
        } else if (msg.kind === "ceilings") {
          if (refiningRef.current) {
            // The background pass seeds from the interim's ceilings so it can't truly
            // regress, but merge monotonically anyway — the UI must never show a
            // ceiling dropping while the same query refines.
            setCeilings((prev) =>
              prev ? msg.ceilings.map((v, s) => Math.max(v, prev[s])) : msg.ceilings,
            );
          } else {
            setCeilings(msg.ceilings);
          }
        } else if (msg.refining) {
          // Time-capped responsive pass: show its best-effort answer now; the worker is
          // still busy on the exhaustive pass, so stay "in flight" for cancellation.
          refiningRef.current = true;
          interimRef.current = msg.output;
          setResult(msg.output);
          setCeilings(msg.output.ceilings);
          setRunning(false);
          setRefining(true);
          setRefineProgress(0);
        } else {
          const interim = interimRef.current;
          refiningRef.current = false;
          interimRef.current = null;
          inFlightRef.current = false;
          setResult(msg.output);
          setCeilings((prev) =>
            interim && prev
              ? msg.output.ceilings.map((v, s) => Math.max(v, prev[s]))
              : msg.output.ceilings,
          );
          setRunning(false);
          setRefining(false);
          // A background pass that was itself capped proves nothing — leave the outcome
          // unset and let result.capped drive the time-limit messaging.
          if (interim && !msg.output.capped) {
            setRefineOutcome(
              foundBetter(interim, msg.output) ? "improved" : "confirmed",
            );
          }
        }
      };
      worker.onerror = () => {
        inFlightRef.current = false;
        refiningRef.current = false;
        interimRef.current = null;
        setRunning(false);
        setRefining(false);
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

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
      refiningRef.current = false;
      interimRef.current = null;
      setRunning(true);
      setProgress(0);
      setRefining(false);
      setRefineProgress(0);
      setRefineOutcome(null);
      setRunId(seq);
      getWorker().postMessage({ seq, input } satisfies OptimizerRequest);
    },
    [getWorker],
  );

  // Abandon the in-flight run: bump the seq (so any late messages are ignored) and tear
  // the worker down so its CPU work stops.
  const cancel = useCallback(() => {
    seqRef.current++;
    inFlightRef.current = false;
    refiningRef.current = false;
    interimRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setRefining(false);
    setRefineOutcome(null);
  }, []);

  return {
    run,
    cancel,
    result,
    ceilings,
    running,
    progress,
    runId,
    refining,
    refineProgress,
    refineOutcome,
  };
}
