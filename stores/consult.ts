// @MX:NOTE Consult store — minimal client state for selected session ID.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-052, REQ-V3-UI-057)
import { create } from 'zustand';

interface ConsultState {
  selectedSessionId: string | null;
  setSelectedSessionId: (sessionId: string | null) => void;
}

export const useConsultStore = create<ConsultState>((set) => ({
  selectedSessionId: null,
  setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),
}));
