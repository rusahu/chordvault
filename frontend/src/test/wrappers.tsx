import { type ReactNode } from 'react';

// Mock all context providers with minimal implementations for testing

const mockUser = { id: 1, username: 'testuser', role: 'owner', token: 'fake-token' };

// vi.mock calls must be at the top of each test file that uses this wrapper.
// This file provides the wrapper component that composes the mocked providers.

// Instead of trying to mock contexts (which is fragile), we'll mock the hooks
// directly in each test file using vi.mock. This wrapper just provides a container.

export function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export { mockUser };
