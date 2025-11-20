import React from 'react';
import LoginComponent from './LoginComponent';
import { User } from '../types';
import { CloseIcon } from './Icons';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="relative w-full max-w-md m-4"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
          aria-label="Close login modal"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
        <LoginComponent onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
};

export default LoginModal;