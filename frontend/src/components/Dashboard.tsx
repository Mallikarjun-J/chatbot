import React, { ChangeEvent, useRef, useState } from 'react';
import { User, UserRole, Announcement, Notification } from '../types';
import ChatComponent from './ChatComponent';
import ThemeToggle from './ThemeToggle';
import { UserIcon, UploadIcon, Spinner } from './Icons';
import NotificationBell from './NotificationBell';

// Local Avatar component for reusability within this file
const Avatar: React.FC<{ user: User; className?: string; }> = ({ user, className = 'h-10 w-10' }) => {
  return (
    <div className={`${className} rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 overflow-hidden`}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
      ) : (
        <UserIcon className="h-2/3 w-2/3" />
      )}
    </div>
  );
};

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
  children: React.ReactNode;
  theme: string;
  toggleTheme: () => void;
  announcements: Announcement[];
  notifications: Notification[];
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;
}

const roleConfig = {
    [UserRole.ADMIN]: {
        bg: 'bg-red-600',
        title: 'Admin Dashboard',
    },
    [UserRole.TEACHER]: {
        bg: 'bg-blue-600',
        title: 'Teacher Dashboard',
    },
    [UserRole.STUDENT]: {
        bg: 'bg-green-600',
        title: 'Student Dashboard',
    }
};

const Dashboard: React.FC<DashboardProps> = ({ 
    user, 
    onLogout, 
    onUserUpdate, 
    children, 
    theme, 
    toggleTheme, 
    announcements,
    notifications,
    onMarkNotificationAsRead,
    onMarkAllNotificationsAsRead
}) => {
  const config = roleConfig[user.role];
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/users/avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload avatar.');
        }
        onUserUpdate(data as User);
    } catch (err: any) {
        alert(`Upload failed: ${err.message}`);
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className={`${config.bg} text-white shadow-md sticky top-0 z-20`}>
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CampusAura</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Avatar user={user} className="h-10 w-10" />
            <span className="hidden sm:block">Welcome, {user.name}</span>
            <NotificationBell
              notifications={notifications}
              onMarkAsRead={onMarkNotificationAsRead}
              onMarkAllAsRead={onMarkAllNotificationsAsRead}
            />
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <button
              onClick={onLogout}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-4 mb-6">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" disabled={isUploading} />
                    <button onClick={handleAvatarClick} disabled={isUploading} className="relative rounded-full group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800">
                        <Avatar user={user} className="h-16 w-16" />
                         <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-full transition-opacity duration-300">
                            {isUploading ? 
                                <Spinner className="h-6 w-6 text-white" /> :
                                <UploadIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                            }
                        </div>
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{config.title}</h2>
                        <p className="text-gray-500 dark:text-gray-400">Role: {user.role}</p>
                    </div>
                </div>
              
                {children}
            </div>
        </div>
        
        <div className="lg:col-span-1">
             <ChatComponent user={user} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
