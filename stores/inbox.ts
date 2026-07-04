import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface InboxStore {
  selectedTicketId: string | null;
  showArchived: boolean;
  setSelectedTicketId: (id: string | null) => void;
  toggleArchived: () => void;
}

export const useInboxStore = create<InboxStore>()(
  devtools(
    (set) => ({
      selectedTicketId: null,
      showArchived: false,
      setSelectedTicketId: (id) => set({ selectedTicketId: id }),
      toggleArchived: () => set((state) => ({ showArchived: !state.showArchived })),
    }),
    { name: 'InboxStore' },
  ),
);
