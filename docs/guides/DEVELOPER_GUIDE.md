# Quick Reference: Common Patterns & Best Practices

## Table of Contents
1. [Making Supabase Calls](#making-supabase-calls)
2. [Using Auth Context](#using-auth-context)
3. [Error Handling](#error-handling)
4. [Loading States](#loading-states)
5. [Cleanup Patterns](#cleanup-patterns)

---

## Making Supabase Calls

### ✅ CORRECT - With Timeout

```typescript
import { withTimeout } from '../utils/requestUtils';

const fetchData = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('table').select('*'),
      10000, // 10 second timeout
      'Data fetch timeout'
    );
    
    if (error) throw error;
    if (!data) return [];
    
    return data;
  } catch (error) {
    console.error('[Service] Error:', error);
    throw error;
  }
};
```

### ❌ INCORRECT - No Timeout

```typescript
// DON'T DO THIS - Can hang forever
const fetchData = async () => {
  const { data } = await supabase.from('table').select('*');
  return data;
};
```

---

## Using Auth Context

### ✅ CORRECT - Check Loading State

```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user, profile, loading, isInitialized } = useAuth();
  
  if (!isInitialized || loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <div>Welcome, {profile?.name}</div>;
};
```

### ❌ INCORRECT - No Loading Check

```typescript
// DON'T DO THIS - Can cause flashing or wrong renders
const MyComponent = () => {
  const { user, profile } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  return <div>Welcome, {profile?.name}</div>; // profile might be null!
};
```

---

## Error Handling

### ✅ CORRECT - Comprehensive Try/Catch/Finally

```typescript
const updateData = async () => {
  setLoading(true);
  try {
    const result = await withTimeout(
      myApiCall(),
      10000,
      'Update timeout'
    );
    
    showSuccessToast('Updated successfully');
    return result;
  } catch (error) {
    console.error('[Component] Update failed:', error);
    
    // User-friendly error messages
    if (error.message.includes('timeout')) {
      showErrorToast('Request timed out. Please try again.');
    } else if (error.message.includes('network')) {
      showErrorToast('Network error. Please check your connection.');
    } else {
      showErrorToast('Failed to update. Please try again.');
    }
    
    throw error;
  } finally {
    setLoading(false); // ALWAYS reset loading
  }
};
```

### ❌ INCORRECT - No Finally Block

```typescript
// DON'T DO THIS - Loading state might not reset on error
const updateData = async () => {
  setLoading(true);
  try {
    const result = await myApiCall();
    setLoading(false); // Won't run if error!
    return result;
  } catch (error) {
    showErrorToast('Failed');
  }
};
```

---

## Loading States

### ✅ CORRECT - Proper State Management

```typescript
const MyComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await withTimeout(fetchMyData(), 10000);
        
        if (isMountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;
  
  return <DataDisplay data={data} />;
};
```

### ❌ INCORRECT - No Mounted Check

```typescript
// DON'T DO THIS - Can cause "setState on unmounted component" warnings
const MyComponent = () => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchMyData().then(result => {
      setData(result); // Might run after unmount!
    });
  }, []);
  
  return <div>{data}</div>;
};
```

---

## Cleanup Patterns

### ✅ CORRECT - Proper useEffect Cleanup

```typescript
useEffect(() => {
  let isMounted = true;
  const abortController = new AbortController();
  
  const fetchData = async () => {
    try {
      const response = await fetch(url, {
        signal: abortController.signal
      });
      
      if (isMounted) {
        setData(await response.json());
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch error:', error);
      }
    }
  };
  
  fetchData();
  
  return () => {
    isMounted = false;
    abortController.abort();
  };
}, [url]);
```

### ✅ CORRECT - Subscription Cleanup

```typescript
useEffect(() => {
  console.log('[Component] Setting up subscription');
  
  const subscription = supabase
    .channel('my-channel')
    .on('postgres_changes', { /* config */ }, (payload) => {
      console.log('Change received:', payload);
      // Handle update
    })
    .subscribe();
  
  return () => {
    console.log('[Component] Cleaning up subscription');
    subscription.unsubscribe();
  };
}, []);
```

### ❌ INCORRECT - No Cleanup

```typescript
// DON'T DO THIS - Memory leak, multiple subscriptions
useEffect(() => {
  const subscription = supabase
    .channel('my-channel')
    .on('postgres_changes', { /* config */ }, handleChange)
    .subscribe();
  
  // Missing cleanup!
}, []);
```

---

## Auth Operations

### ✅ CORRECT - Sign Out

```typescript
const handleSignOut = async () => {
  setLoading(true);
  try {
    await AuthService.signOut();
    // AuthService handles clearing localStorage
    showSuccessToast('Signed out successfully');
  } catch (error) {
    // Show success even on error (better UX)
    showSuccessToast('Signed out successfully');
  } finally {
    setLoading(false);
  }
};
```

### ✅ CORRECT - Protected Operation

```typescript
const performProtectedAction = async () => {
  const { user, session } = useAuth();
  
  if (!user || !session) {
    showErrorToast('Please sign in to continue');
    navigate('/login');
    return;
  }
  
  try {
    const result = await withTimeout(
      myProtectedApiCall(),
      10000
    );
    return result;
  } catch (error) {
    if (error.message.includes('JWT') || error.message.includes('expired')) {
      showErrorToast('Session expired. Please sign in again.');
      navigate('/login');
    } else {
      showErrorToast('Operation failed');
    }
  }
};
```

---

## Request Utilities Cheat Sheet

### withTimeout
```typescript
import { withTimeout } from '../utils/requestUtils';

// Default 30s timeout
const result = await withTimeout(promise);

// Custom timeout
const result = await withTimeout(promise, 5000, 'Custom error message');
```

### withRetry
```typescript
import { withRetry } from '../utils/requestUtils';

// Default: 3 attempts, 1s delay, exponential backoff
const result = await withRetry(() => fetchData());

// Custom config
const result = await withRetry(
  () => fetchData(),
  {
    maxAttempts: 5,
    delayMs: 2000,
    backoffMultiplier: 2,
    shouldRetry: (error) => error.status >= 500
  }
);
```

### withTimeoutAndRetry
```typescript
import { withTimeoutAndRetry } from '../utils/requestUtils';

// Best for critical operations
const result = await withTimeoutAndRetry(
  () => fetchData(),
  10000, // 10s timeout per attempt
  { maxAttempts: 3 } // Retry 3 times
);
```

### debounce / throttle
```typescript
import { debounce, throttle } from '../utils/requestUtils';

// Debounce - Wait for user to stop typing
const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 300);

// Throttle - Limit rate of execution
const throttledScroll = throttle(() => {
  handleScroll();
}, 100);
```

---

## Common Mistakes to Avoid

### ❌ 1. Not checking if component is mounted
```typescript
// BAD
useEffect(() => {
  fetchData().then(data => setData(data));
}, []);
```

### ❌ 2. Forgetting to unsubscribe from Supabase channels
```typescript
// BAD
useEffect(() => {
  supabase.channel('test').subscribe();
  // No cleanup!
}, []);
```

### ❌ 3. Not resetting loading state in finally block
```typescript
// BAD
const save = async () => {
  setLoading(true);
  try {
    await saveData();
    setLoading(false); // Won't run if error
  } catch (error) {
    console.error(error);
  }
};
```

### ❌ 4. Not handling timeout/network errors
```typescript
// BAD
const fetch = async () => {
  const { data } = await supabase.from('table').select();
  return data; // Can hang forever
};
```

### ❌ 5. Infinite re-renders from missing dependencies
```typescript
// BAD
useEffect(() => {
  fetchData();
}, []); // Missing dependencies

const fetchData = async () => {
  // Uses some props/state
};
```

---

## Debugging Tips

### Enable Verbose Logging
All services now have `[ServiceName]` prefixed logs:
```
[AuthContext] Initializing auth state
[AuthService] SignIn successful for user: 123
[VitalsService] Fetching vitals for patient: 456
[ChatService] Real-time message received: 789
```

### Check Common Issues
1. **Infinite Loading**: Check browser console for timeout errors
2. **Stale UI**: Check if component has proper dependencies in useEffect
3. **Auth Issues**: Check localStorage for `supabase.auth.token`
4. **Realtime Not Working**: Check Supabase project settings for realtime enabled

### Useful Console Commands
```javascript
// Check current auth state
localStorage.getItem('supabase.auth.token')

// Clear auth state (for testing)
localStorage.removeItem('supabase.auth.token')
sessionStorage.clear()

// Check if component unmount cleanup is working
window.addEventListener('beforeunload', () => console.log('Unmounting'))
```

---

## Testing Patterns

### Mock Supabase in Tests
```typescript
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));
```

### Test Async Components
```typescript
it('should load data', async () => {
  render(<MyComponent />);
  
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });
  
  // Check data is rendered
  expect(screen.getByText('Data loaded')).toBeInTheDocument();
});
```

---

**Need Help?** Check `FIXES_APPLIED.md` for comprehensive documentation.
