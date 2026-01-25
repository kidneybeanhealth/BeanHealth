/**
 * AuthContext Integration Tests
 * 
 * Tests for AuthContext provider behavior and auth state management
 * 
 * Run with: npm test -- AuthContext.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import React from 'react';

// Mock Supabase
vi.mock('../lib/supabase');
vi.mock('../utils/toastUtils', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

// Test component that uses auth
const TestComponent = () => {
  const { user, loading, isInitialized, needsProfileSetup } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="initialized">{isInitialized ? 'initialized' : 'not-initialized'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <div data-testid="needs-setup">{needsProfileSetup ? 'needs-setup' : 'setup-complete'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should initialize with loading state', () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('initialized')).toHaveTextContent('not-initialized');
  });

  it('should complete initialization and show no user when no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should load user and profile when session exists', async () => {
    const mockUser = { id: '123', email: 'test@example.com', user_metadata: {} };
    const mockSession = { user: mockUser, access_token: 'token' };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    // Mock AuthService.getCurrentUser
    const mockProfile = { id: '123', name: 'Test User', role: 'patient' };
    vi.doMock('../services/authService', () => ({
      AuthService: {
        getCurrentUser: vi.fn().mockResolvedValue(mockProfile),
      },
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('needs-setup')).toHaveTextContent('setup-complete');
    });
  });

  it('should set needsProfileSetup when profile is incomplete', async () => {
    const mockUser = { id: '123', email: 'test@example.com', user_metadata: {} };
    const mockSession = { user: mockUser, access_token: 'token' };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    // Mock AuthService.getCurrentUser returning null (no profile)
    vi.doMock('../services/authService', () => ({
      AuthService: {
        getCurrentUser: vi.fn().mockResolvedValue(null),
      },
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('needs-setup')).toHaveTextContent('needs-setup');
    });
  });

  it('should handle auth state change (SIGNED_OUT)', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    
    let authCallback: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any;
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
    });

    // Trigger SIGNED_OUT event
    act(() => {
      authCallback('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should cleanup subscription on unmount', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe } },
    } as any);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
    });

    unmount();

    // Small delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should handle loading timeout', async () => {
    // Make getSession hang indefinitely
    vi.mocked(supabase.auth.getSession).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should still be loading after a reasonable time
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
  });
});
