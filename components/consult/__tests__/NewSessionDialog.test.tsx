/**
 * @vitest-environment jsdom
 */
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-052/053, AC-CONS-UI-002)
import '@testing-library/jest-dom';
import { NewSessionDialog } from '@/components/consult/NewSessionDialog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/navigation (router.push on create success — REQ-V3-UI-053).
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useCreateConsultSession via hoisted refs (ApproveDialog pattern).
const { mutateSessionSpy } = vi.hoisted(() => ({
  mutateSessionSpy: vi.fn(),
}));

vi.mock('@/lib/queries/useConsult', () => ({
  useCreateConsultSession: () => ({
    mutate: mutateSessionSpy,
    mutateAsync: mutateSessionSpy,
    isPending: false,
    error: null,
  }),
}));

describe('NewSessionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show new session button initially', () => {
    render(<NewSessionDialog />);
    expect(screen.getByTestId('new-session-button')).toHaveTextContent('새 세션');
  });

  it('should open dialog when button clicked (REQ-V3-UI-052)', async () => {
    render(<NewSessionDialog />);

    await userEvent.click(screen.getByTestId('new-session-button'));

    expect(screen.getByTestId('new-session-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('session-title')).toBeInTheDocument();
  });

  it('should validate title length (1-200 chars, REQ-V3-UI-052)', async () => {
    render(<NewSessionDialog />);

    await userEvent.click(screen.getByTestId('new-session-button'));

    const submitButton = screen.getByTestId('session-submit');
    expect(submitButton).toBeDisabled();

    const titleInput = screen.getByTestId('session-title');
    await userEvent.type(titleInput, 'Test Session');

    expect(submitButton).not.toBeDisabled();
  });

  it('should close dialog on cancel', async () => {
    render(<NewSessionDialog />);

    await userEvent.click(screen.getByTestId('new-session-button'));
    expect(screen.getByTestId('new-session-dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('session-cancel'));
    expect(screen.queryByTestId('new-session-dialog')).not.toBeInTheDocument();
  });
});
