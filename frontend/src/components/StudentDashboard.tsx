import React, { useState, useEffect } from 'react';
import { User, Announcement } from '../types';
import { AcademicCapIcon, ClipboardListIcon, CalendarIcon, Spinner } from './Icons';
import AnnouncementsTicker from './AnnouncementsTicker';
import StudentTimetableView from './StudentTimetableView';

const StatCard: React.FC<{ title: string; value: string; color: string; gradient: string; icon: React.ReactNode }> = ({ title, value, color, gradient, icon }) => (
    <div className={`${gradient} p-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer group`}>
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-white/80">{title}</p>
            <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                {icon}
            </div>
        </div>
        <p className={`text-3xl font-bold text-white`}>{value}</p>
    </div>
);

const InfoCard: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode; iconBg: string }> = ({ title, children, icon, iconBg }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col h-full group">
        <div className="flex items-center space-x-3 mb-6">
            <div className={`${iconBg} p-3 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <div className="text-gray-600 dark:text-gray-300 flex-grow">
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
            {/* Recent Updates Banner */}
            {renderAnnouncementsSection()}
            
            {isLoadingData ? (
                <DashboardContentLoader message="Loading your dashboard..." />
            ) : error ? (
                <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            ) : (
             <div className="space-y-6">
                {/* Modern Stats Cards with Gradients */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard 
                        title="Attendance" 
                        value={academicData.attendance ? `${academicData.attendance.overallAttendance}%` : 'N/A'} 
                        color="text-white" 
                        gradient="bg-gradient-to-br from-green-400 to-green-600"
                        icon={<ClipboardListIcon className="w-5 h-5 text-white" />}
                    />
                    <StatCard 
                        title="Current CGPA" 
                        value={academicData.cgpa ? academicData.cgpa.cgpa.toFixed(2) : 'N/A'} 
                        color="text-white" 
                        gradient="bg-gradient-to-br from-blue-400 to-blue-600"
                        icon={<AcademicCapIcon className="w-5 h-5 text-white" />}
                    />
                    <StatCard 
                        title="Semester" 
                        value={academicData.cgpa ? `${academicData.cgpa.semester}` : 'N/A'} 
                        color="text-white" 
                        gradient="bg-gradient-to-br from-purple-400 to-purple-600"
                        icon={<CalendarIcon className="w-5 h-5 text-white" />}
                    />
                    <StatCard 
                        title="Department" 
                        value={academicData.cgpa?.department || 'N/A'} 
                        color="text-white" 
                        gradient="bg-gradient-to-br from-indigo-400 to-indigo-600"
                        icon={<AcademicCapIcon className="w-5 h-5 text-white" />}
                    />
                </div>

                {/* Info Cards with Modern Design */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <InfoCard 
                        title="Subject-wise Attendance" 
                        icon={<ClipboardListIcon className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-green-400 to-green-600"
                    >
                        {academicData.attendance?.subjectWiseAttendance ? (
                            <ul className="space-y-3">
                                {academicData.attendance.subjectWiseAttendance.map((subject, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <div>
                                            <span className="font-medium text-gray-800 dark:text-white">{subject.subject}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({subject.code})</span>
                                        </div>
                                        <span className={`font-bold px-3 py-1 rounded-full text-sm ${subject.attendance >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : subject.attendance >= 75 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {subject.attendance}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">No attendance data available</p>
                        )}
                    </InfoCard>

                    <InfoCard 
                        title="Semester-wise SGPA" 
                        icon={<AcademicCapIcon className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-blue-400 to-blue-600"
                    >
                        {academicData.cgpa?.sgpa ? (
                            <ul className="space-y-3">
                                {Object.entries(academicData.cgpa.sgpa).map(([sem, gpa]) => (
                                    <li key={sem} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <span className="font-medium text-gray-800 dark:text-white capitalize">{sem.replace('sem', 'Semester ')}</span> 
                                        <span className="font-bold text-blue-600 dark:text-blue-400 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm">
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
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-3 rounded-lg">
                            <CalendarIcon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">My Timetable</h3>
                    </div>
                    <StudentTimetableView />
                </div>
            </div>
            )}
        </div>
    );
};

export default StudentDashboard;
