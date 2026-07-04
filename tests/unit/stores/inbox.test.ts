import { useInboxStore } from '@/stores/inbox';
import { beforeEach, describe, expect, it } from 'vitest';

describe('stores/inbox', () => {
  beforeEach(() => {
    // Reset to default state
    useInboxStore.setState({ selectedTicketId: null, showArchived: false });
  });

  it('should initialize with default state', () => {
    const store = useInboxStore.getState();

    expect(store.selectedTicketId).toBeNull();
    expect(store.showArchived).toBe(false);
  });

  it('should set selectedTicketId', () => {
    const { setSelectedTicketId } = useInboxStore.getState();

    setSelectedTicketId('ticket-123');
    expect(useInboxStore.getState().selectedTicketId).toBe('ticket-123');

    setSelectedTicketId(null);
    expect(useInboxStore.getState().selectedTicketId).toBeNull();
  });

  it('should toggle showArchived', () => {
    const { toggleArchived } = useInboxStore.getState();

    expect(useInboxStore.getState().showArchived).toBe(false);

    toggleArchived();
    expect(useInboxStore.getState().showArchived).toBe(true);

    toggleArchived();
    expect(useInboxStore.getState().showArchived).toBe(false);
  });
});
