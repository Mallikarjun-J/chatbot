import React from 'react';
import ChatComponent from './ChatComponent';
import ThemeToggle from './ThemeToggle';

interface PublicViewProps {
  onLoginClick: () => void;
  theme: string;
  toggleTheme: () => void;
}

const PublicView: React.FC<PublicViewProps> = ({ onLoginClick, theme, toggleTheme }) => {

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">CampusAura</h1>
            <div className="flex items-center space-x-4">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              <button
                  onClick={onLoginClick}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
              >
                  Member Login
              </button>
            </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col gap-8">
        <div className="flex-grow">
            <ChatComponent />
        </div>
      </main>
    </div>
  );
};

export default PublicView;
