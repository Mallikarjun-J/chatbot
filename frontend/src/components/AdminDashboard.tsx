import React, { useState, useEffect } from 'react';
import { User, UserRole, Announcement, Document } from '../types';
import { UsersIcon, MegaphoneIcon, CalendarIcon, DocumentIcon, ArrowUpOnSquareIcon, ClipboardListIcon } from './Icons';
import UserManagementView from './UserManagementView';
import AnnouncementsManagementView from './AnnouncementsManagementView';
import TimetableManagementView from './TimetableManagementView';
import DocumentManagementView from './DocumentManagementView';
import WebScrapingView from './WebScrapingView';

// Stat Card component
const AdminStatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; }> = ({ icon, title, value }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
        </div>
    </div>
);

// Action Button component
const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; }> = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="w-full flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm text-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
        {icon}
        <span className="mt-2 text-sm font-semibold text-gray-800 dark:text-white">{label}</span>
    </button>
);


interface AdminDashboardProps {
    user: User;
    announcements: Announcement[];
    isLoadingAnnouncements: boolean;
    errorAnnouncements: string | null;
    onCreateAnnouncement: (announcement: Omit<Announcement, 'id' | 'date'>) => Promise<void>;
    onUpdateAnnouncement: (announcement: Announcement) => Promise<void>;
    onDeleteAnnouncement: (id: string) => Promise<void>;
}

type AdminView = 'dashboard' | 'users' | 'announcements' | 'timetable' | 'documents' | 'web_scrape';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    user, 
    announcements, 
    onCreateAnnouncement, 
    onUpdateAnnouncement, 
    onDeleteAnnouncement 
}) => {
    const [view, setView] = useState<AdminView>('dashboard');
    const [users, setUsers] = useState<User[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    const fetchData = async () => {
        setIsLoadingStats(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("No auth token");

            const [usersRes, docsRes] = await Promise.all([
                fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(usersData);
            }
            if (docsRes.ok) {
                const docsData = await docsRes.json();
                setDocuments(docsData);
            }
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        if (view === 'dashboard') {
            fetchData();
        }
    }, [view]);

    const handleCreateUser = async (newUser: Omit<User, 'id'>) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newUser)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to create user.');
            }
            await fetchData(); // Refresh users list
        } catch (error: any) {
            alert(`Error: ${error.message}`);
            throw error;
        }
    };

    const handleEditUserRole = async (userId: string, newRole: UserRole) => {
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: newRole })
            });
            await fetchData();
        } catch (error) {
            console.error("Failed to edit user role", error);
            alert('Error: Could not update user role.');
        }
    };
    
    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                const token = localStorage.getItem('authToken');
                await fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await fetchData();
            } catch (error) {
                console.error("Failed to delete user", error);
                alert('Error: Could not delete user.');
            }
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'users':
                return <UserManagementView 
                    users={users.filter(u => u.id !== user.id)} // Admin can't edit themselves
                    onCreateUser={handleCreateUser}
                    onEditUserRole={handleEditUserRole}
                    onDeleteUser={handleDeleteUser}
                    onBack={() => setView('dashboard')} 
                />;
            case 'announcements':
                return <AnnouncementsManagementView 
                    announcements={announcements}
                    onCreate={onCreateAnnouncement}
                    onUpdate={onUpdateAnnouncement}
                    onDelete={onDeleteAnnouncement}
                    onBack={() => setView('dashboard')} 
                />;
            case 'timetable':
                 return <TimetableManagementView onBack={() => setView('dashboard')} user={user} />;
            case 'documents':
                 return <DocumentManagementView onBack={() => setView('dashboard')} />;
            case 'web_scrape':
                 return <WebScrapingView onBack={() => setView('dashboard')} />;
            case 'dashboard':
            default:
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {isLoadingStats ? Array.from({length: 4}).map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>) : <>
                                <AdminStatCard icon={<UsersIcon className="w-6 h-6 text-red-500"/>} title="Total Users" value={users.length} />
                                <AdminStatCard icon={<MegaphoneIcon className="w-6 h-6 text-red-500"/>} title="Announcements" value={announcements.length} />
                                <AdminStatCard icon={<DocumentIcon className="w-6 h-6 text-red-500"/>} title="Documents" value={documents.length} />
                                <AdminStatCard icon={<ClipboardListIcon className="w-6 h-6 text-red-500"/>} title="System Status" value="Online" />
                            </>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <ActionButton icon={<UsersIcon className="w-8 h-8 text-red-500"/>} label="Manage Users" onClick={() => setView('users')} />
                            <ActionButton icon={<MegaphoneIcon className="w-8 h-8 text-red-500"/>} label="Announcements" onClick={() => setView('announcements')} />
                            <ActionButton icon={<CalendarIcon className="w-8 h-8 text-red-500"/>} label="Timetable" onClick={() => setView('timetable')} />
                            <ActionButton icon={<DocumentIcon className="w-8 h-8 text-red-500"/>} label="Documents" onClick={() => setView('documents')} />
                            <ActionButton icon={<ArrowUpOnSquareIcon className="w-8 h-8 text-red-500"/>} label="Web Scraper" onClick={() => setView('web_scrape')} />
                        </div>
                    </div>
                );
        }
    };
    
    return <>{renderContent()}</>;
};

export default AdminDashboard;
