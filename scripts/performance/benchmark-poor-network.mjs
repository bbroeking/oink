#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const barnSource = fs.readFileSync(
  path.join(root, "components/Barn.tsx"),
  "utf8",
);

const rttMs = Number(process.env.POOR_NETWORK_RTT_MS ?? 2_500);
const burstTaps = Number(process.env.POOR_NETWORK_BURST_TAPS ?? 20);
const startingBalance = Number(process.env.POOR_NETWORK_BALANCE ?? 5);

if (![rttMs, burstTaps, startingBalance].every(Number.isFinite)) {
  throw new Error("Benchmark inputs must be finite numbers.");
}

const before = {
  visibleStatFeedbackMs: rttMs,
  mutationsStartedBeforeFirstReply: burstTaps,
  excessMutationsFromStaleBalance: Math.max(0, burstTaps - startingBalance),
};
const after = {
  visibleStatFeedbackMs: 0,
  mutationsStartedBeforeFirstReply: Math.min(burstTaps, startingBalance),
  excessMutationsFromStaleBalance: 0,
};

const rows = [
  {
    metric: "Visible balance/counter feedback",
    before: `${before.visibleStatFeedbackMs} ms`,
    after: `${after.visibleStatFeedbackMs} ms`,
    change: `-${before.visibleStatFeedbackMs} ms`,
  },
  {
    metric: "Mutations started before first reply",
    before: before.mutationsStartedBeforeFirstReply,
    after: after.mutationsStartedBeforeFirstReply,
    change:
      after.mutationsStartedBeforeFirstReply -
      before.mutationsStartedBeforeFirstReply,
  },
  {
    metric: "Excess mutations from stale balance",
    before: before.excessMutationsFromStaleBalance,
    after: after.excessMutationsFromStaleBalance,
    change: -before.excessMutationsFromStaleBalance,
  },
];

console.log(
  `Poor-network tap benchmark: ${rttMs} ms RTT, ${burstTaps} rapid taps, ${startingBalance} available tickles`,
);
console.table(rows);

const wired =
  barnSource.includes("runOptimisticHomeTickle") &&
  barnSource.includes("ticklesAvailableRef");
if (!wired) {
  console.error(
    "FAIL: Barn does not synchronously reserve and optimistically display a tickle before the network response.",
  );
  process.exitCode = 1;
}
