import React, { useState, useEffect } from 'react';
import { User, Announcement } from '../types';
import { CalendarIcon, Spinner } from './Icons';
import AnnouncementsTicker from './AnnouncementsTicker';

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">{title}</h3>
        <div className="text-gray-600 dark:text-gray-400 space-y-2">
            {children}
        </div>
    </div>
);

const SkeletonLoader: React.FC = () => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
    </div>
);


interface TeacherDashboardProps {
    user: User;
    announcements: Announcement[];
    isLoadingAnnouncements: boolean;
    errorAnnouncements: string | null;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, announcements, isLoadingAnnouncements, errorAnnouncements }) => {
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        // Simulate fetching teacher-specific data
        const timer = setTimeout(() => {
            setIsLoadingData(false);
        }, 1500); // Simulate a 1.5 second network request
        return () => clearTimeout(timer);
    }, []);

    const renderAnnouncementsSection = () => {
        if (isLoadingAnnouncements) {
            return (
                <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
                    <Spinner className="w-5 h-5 mr-3" />
                    <span>Loading announcements...</span>
                </div>
            );
        }
        if (errorAnnouncements) {
            return (
                <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                    <p><strong>Error loading announcements:</strong> {errorAnnouncements}</p>
                </div>
            );
        }
        if (announcements.length > 0) {
            return <AnnouncementsTicker announcements={announcements} />;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {renderAnnouncementsSection()}

            {isLoadingData ? (
                 <>
                    <SkeletonLoader />
                    <SkeletonLoader />
                </>
            ) : (
                <>
                    <InfoCard title="Your Classes">
                        <ul className="list-disc list-inside">
                            <li>CS101: Introduction to Computer Science</li>
                            <li>MA203: Advanced Calculus</li>
                            <li>PHY301: Quantum Mechanics</li>
                        </ul>
                    </InfoCard>
                    
                    <InfoCard title="Upcoming Schedule">
                        <div className="flex items-center space-x-3">
                            <CalendarIcon className="w-6 h-6 text-blue-500" />
                            <p><strong>10:00 AM - 11:00 AM:</strong> CS101 Lecture (Room 404)</p>
                        </div>
                         <div className="flex items-center space-x-3">
                            <CalendarIcon className="w-6 h-6 text-blue-500" />
                            <p><strong>02:00 PM - 03:30 PM:</strong> PHY301 Lab Session (Lab B)</p>
                        </div>
                    </InfoCard>
                </>
            )}
        </div>
    );
};

export default TeacherDashboard;
