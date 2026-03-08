// Toast notification utilities
import toast from 'react-hot-toast';

export const showSuccessToast = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#10B981',
      color: '#fff',
    },
    icon: '✓',
  });
};

export const showErrorToast = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#EF4444',
      color: '#fff',
    },
    icon: '✕',
  });
};

export const showInfoToast = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#3B82F6',
      color: '#fff',
    },
    icon: 'ℹ',
  });
};

export const showWarningToast = (message: string) => {
  toast(message, {
    duration: 3500,
    position: 'top-right',
    style: {
      background: '#F59E0B',
      color: '#fff',
    },
    icon: '⚠',
  });
};

export const showLoadingToast = (message: string) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

export const showPromiseToast = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    {
      position: 'top-right',
    }
  );
};
