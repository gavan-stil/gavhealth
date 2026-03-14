import useMomentumSignals from "./useMomentumSignals";
import type { MomentumSignalsData } from "./useMomentumSignals";

export type { MomentumSignalsData as ProgressData };

export default function useProgress() {
  return useMomentumSignals(14);
}
