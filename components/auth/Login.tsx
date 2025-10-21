import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginProps {
  onSwitchToChooser: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToChooser }) => {
  const { signInWithGoogle, loading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      alert('Failed to sign in with Google. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-display font-bold text-gray-900 dark:text-gray-100 mb-4">
          Welcome Back
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
          Sign in with your Google account to access<br className="hidden sm:block" /> your BeanHealth dashboard
        </p>
      </div>
      
      <div className="space-y-6">
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="group relative w-full flex items-center justify-center px-6 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm bg-white dark:bg-gray-800 text-base font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-750 hover:border-sky-400 dark:hover:border-rose-900 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-rose-900 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
        >
          <svg className="w-6 h-6 mr-3 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </>
          ) : (
            'Continue with Google'
          )}
        </button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
              Secure authentication powered by Google
            </span>
          </div>
        </div>
        
        {/* Security badges */}
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>SSL Secured</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Privacy Protected</span>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={onSwitchToChooser}
          className="inline-flex items-center text-sm font-medium text-rose-900 dark:text-rose-400 hover:text-rose-900 dark:hover:text-sky-300 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to role selection
        </button>
      </div>
    </div>
  );
};

export default Login;
