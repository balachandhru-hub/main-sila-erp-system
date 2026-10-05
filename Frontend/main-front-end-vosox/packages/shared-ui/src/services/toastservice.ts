export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Store for managing toasts
let toasts: Toast[] = [];
let subscribers: ((toasts: Toast[]) => void)[] = [];

export const toastService = {
  subscribe: (callback: (toasts: Toast[]) => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((sub) => sub !== callback);
    };
  },

  show: (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message, duration };

    toasts = [...toasts, toast];
    subscribers.forEach((cb) => cb(toasts));

    if (duration > 0) {
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        subscribers.forEach((cb) => cb(toasts));
      }, duration);
    }

    return id;
  },

  success: (message: string, durationOrOptions?: number | any) => {
    const duration = typeof durationOrOptions === 'number' ? durationOrOptions : (durationOrOptions?.autoClose ?? 3000);
    return toastService.show(message, 'success', duration);
  },

  error: (message: string, durationOrOptions?: number | any) => {
    const duration = typeof durationOrOptions === 'number' ? durationOrOptions : (durationOrOptions?.autoClose ?? 3000);
    return toastService.show(message, 'error', duration);
  },

  info: (message: string, durationOrOptions?: number | any) => {
    const duration = typeof durationOrOptions === 'number' ? durationOrOptions : (durationOrOptions?.autoClose ?? 3000);
    return toastService.show(message, 'info', duration);
  },

  warning: (message: string, durationOrOptions?: number | any) => {
    const duration = typeof durationOrOptions === 'number' ? durationOrOptions : (durationOrOptions?.autoClose ?? 3000);
    return toastService.show(message, 'warning', duration);
  },

  remove: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    subscribers.forEach((cb) => cb(toasts));
  },
};