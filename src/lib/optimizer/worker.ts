import { solve } from "./solve";
import type { OptimizerRequest, OptimizerResponse } from "./types";

// Runs the (CPU-heavy) combinatorial search off the main thread. Streams ceiling updates
// as they refine, then posts the final result. Each message echoes the request seq so the
// main thread can ignore responses from superseded runs.
const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  const { seq, input } = e.data;
  const output = solve(input, {
    onCeilings: (ceilings) =>
      ctx.postMessage({ seq, kind: "ceilings", ceilings } satisfies OptimizerResponse),
  });
  ctx.postMessage({ seq, kind: "result", output } satisfies OptimizerResponse);
};
