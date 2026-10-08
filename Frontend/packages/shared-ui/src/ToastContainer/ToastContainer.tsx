import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { toastService, type Toast } from '../services/toastservice';
import './ToastContainer.css';

interface ToastContainerProps {
  position?: string;
  autoClose?: number | boolean;
  hideProgressBar?: boolean;
  newestOnTop?: boolean;
  closeOnClick?: boolean;
  rtl?: boolean;
  pauseOnFocusLoss?: boolean;
  draggable?: boolean;
  pauseOnHover?: boolean;
  [key: string]: any;
}

const ToastContainer: React.FC<ToastContainerProps> = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe(setToasts);
    return unsubscribe;
  }, []);

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <FaCheckCircle />;
      case 'error':
        return <FaExclamationCircle />;
      case 'warning':
        return <FaExclamationTriangle />;
      case 'info':
      default:
        return <FaInfoCircle />;
    }
  };

  return (
    <div className="nad-toast-container" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`nad-toast nad-toast-${toast.type}`}
          role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
        >
          <div className="nad-toast-icon" aria-hidden="true">{getIcon(toast.type)}</div>
          <div className="nad-toast-message">{toast.message}</div>
          <button
            type="button"
            className="nad-toast-close"
            onClick={() => toastService.remove(toast.id)}
            aria-label="Dismiss notification"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;