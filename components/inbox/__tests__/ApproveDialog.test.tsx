/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApproveDialog } from '../ApproveDialog';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { mutateSpy, errorRef } = vi.hoisted(() => ({
  mutateSpy: vi.fn(),
  errorRef: {
    current: null as { status?: number; message?: string } | null,
  },
}));

vi.mock('@/lib/queries/useInbox', () => ({
  useApproveTicket: () => ({
    mutate: mutateSpy,
    isPending: false,
    isError: errorRef.current !== null,
    error: errorRef.current,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ApproveDialog (T-019)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorRef.current = null;
  });

  it('renders password, esigSignature inputs and submit button', () => {
    render(<ApproveDialog ticketId="t-1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('approve-password')).toBeInTheDocument();
    expect(screen.getByTestId('approve-esig')).toBeInTheDocument();
    expect(screen.getByTestId('approve-submit')).toBeInTheDocument();
  });

  it('calls mutate with {ticketId, password, esigSignature} on submit (REQ-V3-UI-013)', () => {
    render(<ApproveDialog ticketId="t-1" />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByTestId('approve-password'), { target: { value: 'pw' } });
    fireEvent.change(screen.getByTestId('approve-esig'), { target: { value: '/s/ Jane' } });
    fireEvent.click(screen.getByTestId('approve-submit'));
    expect(mutateSpy).toHaveBeenCalledWith(
      { ticketId: 't-1', password: 'pw', esigSignature: '/s/ Jane' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows inline password error on 401 (REQ-V3-UI-014)', () => {
    errorRef.current = { status: 401, message: 'Invalid password' };
    render(<ApproveDialog ticketId="t-1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('approve-error-401')).toBeInTheDocument();
  });

  it('shows blocking message on 400 (REQ-V3-UI-015)', () => {
    errorRef.current = { status: 400, message: 'Cannot promote' };
    render(<ApproveDialog ticketId="t-1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('approve-error-400')).toBeInTheDocument();
  });

  it('invokes onSuccess callback when mutation succeeds (REQ-V3-UI-016)', () => {
    const onSuccess = vi.fn();
    render(<ApproveDialog ticketId="t-1" onSuccess={onSuccess} />, {
      wrapper: createWrapper(),
    });
    fireEvent.change(screen.getByTestId('approve-password'), { target: { value: 'pw' } });
    fireEvent.change(screen.getByTestId('approve-esig'), { target: { value: 'sig' } });
    fireEvent.click(screen.getByTestId('approve-submit'));
    const callOpts = mutateSpy.mock.calls[0]?.[1] as { onSuccess: () => void };
    callOpts.onSuccess();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
