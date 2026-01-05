import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  User,
  UserRole,
  Announcement,
  Notification,
} from './types';

import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import PublicView from './components/PublicView';
import LoginModal from './components/LoginModal';

/* =========================
   API HELPERS
   ========================= */

const getAuthToken = () => localStorage.getItem('authToken');

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status}:${message}`);
  }

  return response.json();
}

/* =========================
   COMPONENT
   ========================= */

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevAnnouncementsRef = useRef<Announcement[]>([]);

  /* =========================
     SESSION RESTORE
     ========================= */

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const data = await apiFetch<{ user: User }>('/api/auth/verify-token', {
          method: 'POST',
        });
        setUser(data.user);
      } catch {
        localStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  /* =========================
     ANNOUNCEMENTS
     ========================= */

  const loadAnnouncements = useCallback(async (showLoader: boolean) => {
    if (showLoader) {
      setIsLoadingAnnouncements(true);
    }

    setErrorAnnouncements(null);

    try {
      const data = await apiFetch<Announcement[]>('/api/announcements');
      const sorted = data.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setAnnouncements(sorted);
    } catch (error) {
      if (error instanceof Error) {
        setErrorAnnouncements(error.message);

        if (error.message.startsWith('403')) {
          localStorage.removeItem('authToken');
          setUser(null);
        }
      }
    } finally {
      if (showLoader) {
        setIsLoadingAnnouncements(false);
      }
    }
  }, []);

  /* Initial load + polling */
  useEffect(() => {
    if (!user) return;

    loadAnnouncements(true);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAnnouncements(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadAnnouncements, user]);

  /* =========================
     NOTIFICATIONS
     ========================= */

  useEffect(() => {
    if (!user) return;

    const previous = prevAnnouncementsRef.current;

    if (previous.length === 0 && announcements.length > 0) {
      setNotifications(
        announcements.slice(0, 3).map(ann => ({
          id: `notif-${ann.id}`,
          message: `📢 ${ann.title}`,
          timestamp: ann.date,
          isRead: false,
          type: 'announcement',
        }))
      );
      prevAnnouncementsRef.current = announcements;
      return;
    }

    const previousIds = new Set(previous.map(a => a.id));
    const newAnnouncements = announcements.filter(
      a => !previousIds.has(a.id)
    );

    if (newAnnouncements.length > 0) {
      setNotifications(prev => [
        ...newAnnouncements.map(ann => ({
          id: `notif-${ann.id}`,
          message: `📢 New: ${ann.title}`,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'announcement',
        })),
        ...prev,
      ]);
    }

    prevAnnouncementsRef.current = announcements;
  }, [announcements, user]);

  /* =========================
     AUTH HANDLERS
     ========================= */

  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    setLoginModalOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setNotifications([]);
    localStorage.removeItem('authToken');
  }, []);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  /* =========================
     ANNOUNCEMENT CRUD
     ========================= */

  const handleCreateAnnouncement = async (
    announcement: Omit<Announcement, 'id' | 'date'>
  ) => {
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(announcement),
      });
      loadAnnouncements(false);
    } catch {
      alert('Failed to create announcement');
    }
  };

  const handleUpdateAnnouncement = async (announcement: Announcement) => {
    try {
      const { id, title, content, eventDate, eventTime, location } =
        announcement;

      await apiFetch(`/api/announcements/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          content,
          eventDate,
          eventTime,
          location,
        }),
      });

      loadAnnouncements(false);
    } catch {
      alert('Failed to update announcement');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;

    try {
      await apiFetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
      loadAnnouncements(false);
    } catch {
      alert('Failed to delete announcement');
    }
  };

  /* =========================
     NOTIFICATION HANDLERS
     ========================= */

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      )
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  /* =========================
     ROLE DASHBOARD
     ========================= */

  const renderRoleDashboard = () => {
    if (!user) return null;

    switch (user.role) {
      case UserRole.ADMIN:
        return (
          <AdminDashboard
            user={user}
            announcements={announcements}
            isLoadingAnnouncements={isLoadingAnnouncements}
            errorAnnouncements={errorAnnouncements}
            onCreateAnnouncement={handleCreateAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onRefreshAnnouncements={() => loadAnnouncements(false)}
          />
        );

      case UserRole.TEACHER:
        return (
          <TeacherDashboard
            user={user}
            announcements={announcements}
            isLoadingAnnouncements={isLoadingAnnouncements}
            errorAnnouncements={errorAnnouncements}
          />
        );

      case UserRole.STUDENT:
        return (
          <StudentDashboard
            user={user}
            announcements={announcements}
            isLoadingAnnouncements={isLoadingAnnouncements}
            errorAnnouncements={errorAnnouncements}
          />
        );

      default:
        return <p>Invalid user role</p>;
    }
  };

  /* =========================
     RENDER
     ========================= */

  if (authLoading) {
    return <div className="min-h-screen bg-gray-100 dark:bg-gray-900" />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {user ? (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          announcements={announcements}
          notifications={notifications}
          onMarkNotificationAsRead={markNotificationAsRead}
          onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
        >
          {renderRoleDashboard()}
        </Dashboard>
      ) : (
        <>
          <PublicView onLoginClick={() => setLoginModalOpen(true)} />
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
