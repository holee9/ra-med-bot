/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// T-023 characterization: chat page is a thin server wrapper around ChatShell.
// Mock ChatShell to isolate the server-rendered empty state.
vi.mock('@/components/chat/ChatShell', () => ({
  ChatShell: () => <div data-testid="chat-shell-mock">ChatShell</div>,
}));

describe('Chat Page (T-023 characterization)', () => {
  it('renders server-side empty-state heading (REQ-CHAT-058)', async () => {
    const Page = (await import('../page')).default;
    render(<Page />);
    expect(screen.getByText('새로운 상담을 시작하세요')).toBeInTheDocument();
  });

  it('mounts ChatShell client component', async () => {
    const Page = (await import('../page')).default;
    render(<Page />);
    expect(screen.getByTestId('chat-shell-mock')).toBeInTheDocument();
  });
});
