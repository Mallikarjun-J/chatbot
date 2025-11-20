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

interface AcademicData {
    cgpa?: {
        cgpa: number;
        sgpa: { [key: string]: number };
        semester: number;
        department: string;
        section: string;
    };
    attendance?: {
        overallAttendance: number;
        subjectWiseAttendance: Array<{
            subject: string;
            code: string;
            attendance: number;
        }>;
    };
}

interface StudentDashboardProps {
    user: User;
    announcements: Announcement[];
    isLoadingAnnouncements: boolean;
    errorAnnouncements: string | null;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, announcements, isLoadingAnnouncements, errorAnnouncements }) => {
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [academicData, setAcademicData] = useState<AcademicData>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAcademicData = async () => {
            try {
                const token = localStorage.getItem('authToken');
                if (!token) {
                    throw new Error('No authentication token found');
                }

                // Fetch CGPA data
                const cgpaResponse = await fetch('http://localhost:3001/api/cgpa/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                // Fetch attendance data
                const attendanceResponse = await fetch('http://localhost:3001/api/attendance/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                const data: AcademicData = {};

                if (cgpaResponse.ok) {
                    data.cgpa = await cgpaResponse.json();
                }

                if (attendanceResponse.ok) {
                    data.attendance = await attendanceResponse.json();
                }

                setAcademicData(data);
            } catch (err) {
                console.error('Error fetching academic data:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch academic data');
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchAcademicData();
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
            return <AnnouncementsTicker announcements={announcements.slice(0, 3)} />;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {renderAnnouncementsSection()}
            
            {isLoadingData ? (
                <DashboardContentLoader message="Loading your dashboard..." />
            ) : error ? (
                <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            ) : (
             <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard 
                        title="Attendance" 
                        value={academicData.attendance ? `${academicData.attendance.overallAttendance}%` : 'N/A'} 
                        color="text-green-500" 
                    />
                    <StatCard 
                        title="Current CGPA" 
                        value={academicData.cgpa ? academicData.cgpa.cgpa.toFixed(2) : 'N/A'} 
                        color="text-green-500" 
                    />
                    <StatCard 
                        title="Semester" 
                        value={academicData.cgpa ? `${academicData.cgpa.semester}` : 'N/A'} 
                        color="text-gray-800 dark:text-white" 
                    />
                    <StatCard 
                        title="Department" 
                        value={academicData.cgpa?.department || 'N/A'} 
                        color="text-blue-500" 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <InfoCard title="Subject-wise Attendance" icon={<ClipboardListIcon className="w-6 h-6 text-green-500" />}>
                        {academicData.attendance?.subjectWiseAttendance ? (
                            <ul className="space-y-2 text-sm">
                                {academicData.attendance.subjectWiseAttendance.map((subject, idx) => (
                                    <li key={idx} className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                        <span>{subject.subject} ({subject.code})</span> 
                                        <span className={`font-bold ${subject.attendance >= 90 ? 'text-green-600 dark:text-green-400' : subject.attendance >= 75 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {subject.attendance}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">No attendance data available</p>
                        )}
                    </InfoCard>

                    <InfoCard title="Semester-wise SGPA" icon={<AcademicCapIcon className="w-6 h-6 text-green-500" />}>
                        {academicData.cgpa?.sgpa ? (
                            <ul className="space-y-2 text-sm">
                                {Object.entries(academicData.cgpa.sgpa).map(([sem, gpa]) => (
                                    <li key={sem} className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                        <span className="capitalize">{sem.replace('sem', 'Semester ')}</span> 
                                        <span className="font-bold text-green-600 dark:text-green-400">
                                            {gpa.toFixed(2)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">No SGPA data available</p>
                        )}
                    </InfoCard>
                </div>
                
                {/* Student Timetable */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                    <StudentTimetableView />
                </div>
            </div>
            )}
        </div>
    );
};

export default StudentDashboard;
