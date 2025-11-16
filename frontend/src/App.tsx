import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User, UserRole, Announcement, Notification } from './types';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import PublicView from './components/PublicView';
import LoginModal from './components/LoginModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevAnnouncementsRef = useRef<Announcement[]>([]);

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Restore user session on app load
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('authToken');
      console.log('🔐 Checking for saved token...', token ? 'Token found' : 'No token');
      
      if (token) {
        try {
          console.log('📡 Verifying token with server...');
          const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Session restored:', userData.user.email, userData.user.role);
            setUser(userData.user);
          } else {
            console.log('❌ Token invalid, removing...');
            // Token is invalid, remove it
            localStorage.removeItem('authToken');
          }
        } catch (error) {
          console.error('❌ Failed to restore session:', error);
          localStorage.removeItem('authToken');
        }
      }
    };
    
    restoreSession();
  }, []);

  const fetchAnnouncements = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoadingAnnouncements(true);
    }
    setErrorAnnouncements(null);
    try {
      if (isInitialLoad) {
          await new Promise(res => setTimeout(res, 1000));
      }
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        throw new Error('Failed to fetch announcements.');
      }
      const data: Announcement[] = await response.json();
      setAnnouncements(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err: any) {
      setErrorAnnouncements(err.message);
    } finally {
      if (isInitialLoad) {
        setIsLoadingAnnouncements(false);
      }
    }
  }, []);

  // Initial and polled fetching of announcements
  useEffect(() => {
    fetchAnnouncements(true); // Initial fetch with loading state
    const interval = setInterval(() => {
      fetchAnnouncements(false); // Subsequent fetches without loading state
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  // Generate notifications when new announcements are detected
   useEffect(() => {
    // On first load, prevAnnouncementsRef is empty, so we just populate it and return.
    if (prevAnnouncementsRef.current.length === 0) {
      prevAnnouncementsRef.current = announcements;
      return;
    }
    
    const prevAnnouncementIds = new Set(prevAnnouncementsRef.current.map(a => a.id));
    const newAnnouncements = announcements.filter(a => !prevAnnouncementIds.has(a.id));

    if (newAnnouncements.length > 0 && user) { // Only create notifications if logged in
      const newNotifications: Notification[] = newAnnouncements.map(ann => ({
        id: `notif-${ann.id}`,
        message: `New Announcement: "${ann.title}"`,
        timestamp: new Date().toISOString(),
        isRead: false,
        type: 'announcement',
      }));
      setNotifications(prev => [...newNotifications, ...prev]);
    }

    prevAnnouncementsRef.current = announcements;
  }, [announcements, user]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    setLoginModalOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setNotifications([]); // Clear notifications on logout
    localStorage.removeItem('authToken');
  }, []);

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };
  
  const handleCreateAnnouncement = async (announcement: Omit<Announcement, 'id' | 'date'>) => {
      const token = localStorage.getItem('authToken');
      try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(announcement),
        });
        if (!response.ok) throw new Error('Failed to create announcement.');
        await fetchAnnouncements();
      } catch (error) {
          console.error(error);
          alert('Error: Could not create announcement.');
      }
  };

  const handleUpdateAnnouncement = async (updatedAnnouncement: Announcement) => {
      const token = localStorage.getItem('authToken');
      try {
        const { id, title, content, eventDate, eventTime, location } = updatedAnnouncement;
        const response = await fetch(`/api/announcements/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, content, eventDate, eventTime, location }),
        });
        if (!response.ok) throw new Error('Failed to update announcement.');
        await fetchAnnouncements();
      } catch (error) {
          console.error(error);
          alert('Error: Could not update announcement.');
      }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
      if (window.confirm('Are you sure you want to delete this announcement?')) {
          const token = localStorage.getItem('authToken');
          try {
            const response = await fetch(`/api/announcements/${announcementId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to delete announcement.');
            await fetchAnnouncements();
          } catch (error) {
            console.error(error);
            alert('Error: Could not delete announcement.');
          }
      }
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const renderRoleSpecificDashboard = () => {
    if (!user) return null;
    switch (user.role) {
      case UserRole.ADMIN:
        return <AdminDashboard 
          user={user} 
          announcements={announcements}
          isLoadingAnnouncements={isLoadingAnnouncements}
          errorAnnouncements={errorAnnouncements}
          onCreateAnnouncement={handleCreateAnnouncement}
          onUpdateAnnouncement={handleUpdateAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onRefreshAnnouncements={() => fetchAnnouncements(false)}
        />;
      case UserRole.TEACHER:
        return <TeacherDashboard 
          user={user} 
          announcements={announcements}
          isLoadingAnnouncements={isLoadingAnnouncements}
          errorAnnouncements={errorAnnouncements}
        />;
      case UserRole.STUDENT:
        return <StudentDashboard 
          user={user} 
          announcements={announcements}
          isLoadingAnnouncements={isLoadingAnnouncements}
          errorAnnouncements={errorAnnouncements}
        />;
      default:
        return <p>Unknown user role. Please contact support.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {user ? (
        <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            theme={theme} 
            toggleTheme={toggleTheme} 
            onUserUpdate={handleUserUpdate} 
            announcements={announcements}
            notifications={notifications}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
        >
          {renderRoleSpecificDashboard()}
        </Dashboard>
      ) : (
        <>
          <PublicView 
            onLoginClick={() => setLoginModalOpen(true)} 
            theme={theme} 
            toggleTheme={toggleTheme}
          />
          {isLoginModalOpen && (
            <LoginModal 
              onClose={() => setLoginModalOpen(false)} 
              onLoginSuccess={handleLoginSuccess} 
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;