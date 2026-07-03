import { runSolveSession } from "./session";
import type { OptimizerRequest, OptimizerResponse } from "./types";

// Runs the (CPU-heavy) combinatorial search off the main thread. Streams progress and
// ceiling updates as they refine, then posts the result — twice when the responsive
// pass was time-capped (interim `refining: true`, then the exhaustive final). Each
// message echoes the request seq so the main thread can ignore superseded runs.
const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  const { seq, input } = e.data;
  runSolveSession(input, {
    onProgress: (progress) =>
      ctx.postMessage({ seq, kind: "progress", progress } satisfies OptimizerResponse),
    onCeilings: (ceilings) =>
      ctx.postMessage({ seq, kind: "ceilings", ceilings } satisfies OptimizerResponse),
    onResult: (output, refining) =>
      ctx.postMessage({ seq, kind: "result", output, refining } satisfies OptimizerResponse),
  });
};
