import React, { useEffect } from 'react';

interface SnackbarProps {
  show: boolean;
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
}

const Snackbar: React.FC<SnackbarProps> = ({ show, message, type, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-primary-600';

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg`}>
        <div className="flex items-center justify-between">
          <span className="text-sm">{message}</span>
          <button onClick={onClose} className="ml-2 text-white hover:opacity-75">
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default Snackbar; 