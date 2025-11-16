import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '../types';
import { BellIcon, MegaphoneIcon } from './Icons';

interface NotificationBellProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onMarkAsRead, onMarkAllAsRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const notificationRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setIsOpen(prev => !prev);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const timeSince = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  }

  return (
    <div ref={notificationRef} className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-full text-white/80 hover:text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white dark:focus:ring-offset-gray-800 transition-colors"
        aria-label={`View notifications. ${unreadCount} unread.`}
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/3 translate-x-1/3 rounded-full text-white bg-red-500 text-xs font-bold ring-2 ring-white/50">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 z-30">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">You have no new notifications.</p>
            ) : (
              <ul>
                {notifications.map(notification => (
                  <li key={notification.id} className={`border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 ${!notification.isRead ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                    <button onClick={() => onMarkAsRead(notification.id)} className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start gap-3">
                        {!notification.isRead && (
                            <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" aria-label="Unread notification"></span>
                        )}
                        <div className={`flex-1 ${notification.isRead ? 'pl-5' : ''}`}>
                            <p className="text-sm">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{timeSince(notification.timestamp)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                <button 
                  onClick={onMarkAllAsRead} 
                  disabled={unreadCount === 0}
                  className="w-full text-center text-sm py-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Mark all as read
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
