import React from 'react';
import ChatComponent from './ChatComponent';

interface PublicViewProps {
  onLoginClick: () => void;
}

const PublicView: React.FC<PublicViewProps> = ({ onLoginClick }) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            CampusAura
          </h1>

          <button
            onClick={onLoginClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition"
          >
            Member Login
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col gap-8">
        <div className="flex-grow bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <ChatComponent />
        </div>
      </main>
    </div>
  );
};

export default PublicView;
