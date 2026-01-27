/**
 * Authentication Service Tests
 * 
 * Tests for critical auth flows: signIn, signOut, signUp, getCurrentUser
 * 
 * Run with: npm test -- authService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../services/authService';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('signIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token' };
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as any);

      const result = await AuthService.signIn('test@example.com', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error with invalid credentials', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      } as any);

      await expect(
        AuthService.signIn('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should handle timeout gracefully', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 20000))
      );

      await expect(
        AuthService.signIn('test@example.com', 'password123')
      ).rejects.toThrow('timeout');
    }, 20000);

    it('should trim email whitespace', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: { user: mockUser } },
        error: null,
      } as any);

      await AuthService.signIn('  test@example.com  ', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      } as any);

      // Set some localStorage items
      localStorage.setItem('supabase.auth.token', 'test-token');
      
      await AuthService.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(localStorage.getItem('supabase.auth.token')).toBeNull();
    });

    it('should clear local storage even if API call fails', async () => {
      vi.mocked(supabase.auth.signOut).mockRejectedValue(
        new Error('Network error')
      );

      localStorage.setItem('supabase.auth.token', 'test-token');
      sessionStorage.setItem('test-key', 'test-value');

      // Should not throw
      await AuthService.signOut();

      // Local storage should still be cleared
      expect(localStorage.getItem('supabase.auth.token')).toBeNull();
      expect(sessionStorage.length).toBe(0);
    });

    it('should handle timeout gracefully', async () => {
      vi.mocked(supabase.auth.signOut).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15000))
      );

      localStorage.setItem('supabase.auth.token', 'test-token');

      // Should not throw and should clear storage
      await AuthService.signOut();

      expect(localStorage.getItem('supabase.auth.token')).toBeNull();
    }, 15000);
  });

  describe('signUp', () => {
    it('should successfully create a new user', async () => {
      const mockUser = { id: '123', email: 'newuser@example.com' };
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '123', role: 'patient' },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      const result = await AuthService.signUp('newuser@example.com', 'password123', {
        name: 'Test User',
        role: 'patient',
      });

      expect(supabase.auth.signUp).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error if email already exists', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      } as any);

      await expect(
        AuthService.signUp('existing@example.com', 'password123', {
          name: 'Test User',
          role: 'patient',
        })
      ).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      await expect(
        AuthService.signUp('', 'password123', {
          name: 'Test User',
          role: 'patient',
        })
      ).rejects.toThrow('required');

      await expect(
        AuthService.signUp('test@example.com', '', {
          name: 'Test User',
          role: 'patient',
        })
      ).rejects.toThrow('required');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user profile when session exists', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockProfile = { id: '123', name: 'Test User', role: 'patient' };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      const result = await AuthService.getCurrentUser();

      expect(result).toEqual(mockProfile);
    });

    it('should return null when no session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null for network errors (not throw)', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(
        new Error('network error')
      );

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should clear storage and throw for expired JWT', async () => {
      localStorage.setItem('supabase.auth.token', 'expired-token');
      
      vi.mocked(supabase.auth.getSession).mockRejectedValue(
        new Error('JWT expired')
      );

      await expect(AuthService.getCurrentUser()).rejects.toThrow('JWT expired');
      expect(localStorage.getItem('supabase.auth.token')).toBeNull();
    });
  });
});
