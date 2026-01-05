import React, { ChangeEvent, useRef, useState } from 'react';
import { User, UserRole, Announcement, Notification } from '../types';
import ChatComponent from './ChatComponent';
import { UserIcon, UploadIcon, Spinner } from './Icons';
import NotificationBell from './NotificationBell';

/* =========================
   Avatar Component
   ========================= */
const Avatar: React.FC<{ user: User; className?: string }> = ({
  user,
  className = 'h-10 w-10',
}) => {
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 overflow-hidden`}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserIcon className="h-2/3 w-2/3" />
      )}
    </div>
  );
};

/* =========================
   Props
   ========================= */
interface DashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;

  announcements: Announcement[];
  notifications: Notification[];

  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;

  children: React.ReactNode;
}

/* =========================
   Role Config
   ========================= */
const roleConfig: Record<
  UserRole,
  { bg: string; title: string }
> = {
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
  },
};

/* =========================
   Component
   ========================= */
const Dashboard: React.FC<DashboardProps> = ({
  user,
  onLogout,
  onUserUpdate,
  announcements,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  children,
}) => {
  const config = roleConfig[user.role];
  const [isUploading, setIsUploading] = useState(false);  const [dashboardWidth, setDashboardWidth] = useState(66.666); // 2/3 of screen
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.getElementById('main-container');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const newWidth = (mouseX / containerRect.width) * 100;
      
      // Limit between 40% and 80%
      if (newWidth >= 40 && newWidth <= 80) {
        setDashboardWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Avatar upload failed');
      }

      onUserUpdate(data as User);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Upload failed');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header
        className={`${config.bg} text-white shadow-md sticky top-0 z-20`}
      >
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CampusAura</h1>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Avatar user={user} />
            <span className="hidden sm:block">
              Welcome, {user.name}
            </span>

            <NotificationBell
              notifications={notifications}
              onMarkAsRead={onMarkNotificationAsRead}
              onMarkAllAsRead={onMarkAllNotificationsAsRead}
            />

            <button
              onClick={onLogout}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-md transition"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      {/* Main Layout - Resizable */}
      <main id="main-container" className="flex-grow container mx-auto p-4 md:p-8 flex gap-0 h-[calc(100vh-120px)]">
        {/* Left - Dashboard Content */}
        <div 
          style={{ width: `${dashboardWidth}%` }} 
          className="flex flex-col min-w-0"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 border border-gray-200 dark:border-gray-700 h-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-thumb]:bg-black [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-800">
            <div className="flex items-center space-x-4 mb-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                disabled={isUploading}
              />

              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="relative rounded-full group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 flex-shrink-0"
              >
                <Avatar user={user} className="h-12 w-12 md:h-16 md:w-16" />

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-full transition">
                  {isUploading ? (
                    <Spinner className="h-6 w-6 text-white" />
                  ) : (
                    <UploadIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </button>

              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white truncate">
                  {config.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Role: {user.role}
                </p>
              </div>
            </div>

            {children}
          </div>
        </div>

        {/* Resizer Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-1 mx-2 bg-gray-300 dark:bg-gray-700 hover:bg-indigo-500 dark:hover:bg-indigo-500 cursor-col-resize transition-all flex-shrink-0 rounded-full ${
            isResizing ? 'bg-indigo-500 w-2' : ''
          }`}
          title="Drag to resize"
        />

        {/* Right - Chat */}
        <div 
          style={{ width: `${100 - dashboardWidth}%` }} 
          className="flex flex-col min-w-0"
        >
          <ChatComponent user={user} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
