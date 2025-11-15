import React, { useState, useEffect } from 'react';
import { User, Announcement } from '../types';
import { AcademicCapIcon, ClipboardListIcon, CalendarIcon, Spinner } from './Icons';
import AnnouncementsTicker from './AnnouncementsTicker';
import StudentTimetableView from './StudentTimetableView';

const StatCard: React.FC<{ title: string; value: string; color: string }> = ({ title, value, color }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shadow-sm text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
);

const InfoCard: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-4">
            {icon}
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <div className="text-gray-600 dark:text-gray-400 flex-grow">
            {children}
        </div>
    </div>
);

const DashboardContentLoader: React.FC<{ message: string }> = ({ message }) => (
    <div className="col-span-full h-96 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg shadow-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        <Spinner className="w-10 h-10 mb-4" />
        <p className="text-lg font-medium">{message}</p>
    </div>
);


interface StudentDashboardProps {
    user: User;
    announcements: Announcement[];
    isLoadingAnnouncements: boolean;
    errorAnnouncements: string | null;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, announcements, isLoadingAnnouncements, errorAnnouncements }) => {
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        // Simulate fetching student-specific data
        const timer = setTimeout(() => {
            setIsLoadingData(false);
        }, 1800); // Simulate a 1.8 second network request
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
                <DashboardContentLoader message="Loading your dashboard..." />
            ) : (
             <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Attendance" value="92%" color="text-green-500" />
                    <StatCard title="Current GPA" value="3.8" color="text-green-500" />
                    <StatCard title="Courses" value="5" color="text-gray-800 dark:text-white" />
                    <StatCard title="Assignments Due" value="2" color="text-yellow-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <InfoCard title="Your Grades" icon={<AcademicCapIcon className="w-6 h-6 text-green-500" />}>
                        <ul className="space-y-2 text-sm">
                            <li className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md"><span>Physics 101</span> <span className="font-bold text-green-600 dark:text-green-400">A</span></li>
                            <li className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md"><span>Chemistry Lab</span> <span className="font-bold text-green-600 dark:text-green-400">B+</span></li>
                            <li className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md"><span>Mathematics 202</span> <span className="font-bold text-green-600 dark:text-green-400">A-</span></li>
                            <li className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md"><span>English Literature</span> <span className="font-bold text-yellow-500">C+</span></li>
                        </ul>
                    </InfoCard>

                    <InfoCard title="Course Registration" icon={<ClipboardListIcon className="w-6 h-6 text-green-500" />}>
                        <p className="text-sm mb-3">The following courses are available for the next semester. Click to register.</p>
                         <ul className="space-y-2 text-sm">
                            <li className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                <span>Advanced AI</span>
                                <button className="px-3 py-1 text-xs font-semibold text-white bg-green-500 rounded-full hover:bg-green-600">Register</button>
                            </li>
                            <li className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                <span>Data Structures</span>
                                <button className="px-3 py-1 text-xs font-semibold text-white bg-green-500 rounded-full hover:bg-green-600">Register</button>
                            </li>
                            <li className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                <span>Modern Philosophy</span>
                                 <button className="px-3 py-1 text-xs font-semibold text-white bg-green-500 rounded-full hover:bg-green-600">Register</button>
                            </li>
                        </ul>
                    </InfoCard>
                </div>
                
                {/* Student Timetable - Replaces the hardcoded schedule */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                    <StudentTimetableView />
                </div>
            </div>
            )}
        </div>
    );
};

export default StudentDashboard;
