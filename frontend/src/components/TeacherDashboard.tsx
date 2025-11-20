import React, { useState, useEffect } from 'react';
import { User, Announcement } from '../types';
import { CalendarIcon, Spinner, DocumentIcon } from './Icons';
import AnnouncementsTicker from './AnnouncementsTicker';
import TeacherPersonalTimetable from './TeacherPersonalTimetable';

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

interface TimeSlot {
    time: string;
    subject: string;
    department?: string;
    semester: string;
    section: string;
    room: string;
}

interface DaySchedule {
    [day: string]: TimeSlot[];
}

interface TeacherTimetable {
    id: string;
    branch: string;
    days: DaySchedule;
}

interface TeacherClass {
    id: string;
    subject: string;
    department: string;
    semester: string;
    section: string;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, announcements, isLoadingAnnouncements, errorAnnouncements }) => {
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [view, setView] = useState<'dashboard' | 'timetable'>('dashboard');
    const [timetables, setTimetables] = useState<TeacherTimetable[]>([]);
    const [upcomingClasses, setUpcomingClasses] = useState<TimeSlot[]>([]);
    const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
    
    // Form state for adding classes
    const [showClassForm, setShowClassForm] = useState(false);
    const [classFormData, setClassFormData] = useState({
        subject: '',
        department: '',
        semester: '',
        section: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const getCurrentDay = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date().getDay()];
    };

    const parseTime = (timeStr: string): Date => {
        // Parse "9:00 AM - 10:00 AM" format, return start time
        const startTime = timeStr.split(' - ')[0].trim();
        const [time, period] = startTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setIsLoadingData(false);
                return;
            }

            try {
                // Fetch timetables
                const timetableResponse = await fetch('http://localhost:3001/api/timetables/teacher', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (timetableResponse.ok) {
                    const data = await timetableResponse.json();
                    setTimetables(data);

                    // Get today's classes
                    const today = getCurrentDay();
                    const todayClasses: TimeSlot[] = [];

                    data.forEach((tt: TeacherTimetable) => {
                        if (tt.days[today]) {
                            todayClasses.push(...tt.days[today]);
                        }
                    });

                    // Sort by time and get upcoming classes
                    const now = new Date();
                    const upcoming = todayClasses
                        .filter(slot => parseTime(slot.time) > now)
                        .sort((a, b) => parseTime(a.time).getTime() - parseTime(b.time).getTime())
                        .slice(0, 3);

                    setUpcomingClasses(upcoming);
                }

                // Fetch teacher classes
                const classesResponse = await fetch('http://localhost:3001/api/teacher/classes', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (classesResponse.ok) {
                    const classesData = await classesResponse.json();
                    setTeacherClasses(classesData);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormMessage(null);

        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            const response = await fetch('http://localhost:3001/api/teacher/classes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(classFormData)
            });

            if (response.ok) {
                const result = await response.json();
                setTeacherClasses([...teacherClasses, { id: result.id, ...classFormData }]);
                setClassFormData({ subject: '', department: '', semester: '', section: '' });
                setShowClassForm(false);
                setFormMessage({ type: 'success', text: 'Class added successfully!' });
                setTimeout(() => setFormMessage(null), 3000);
            } else {
                const error = await response.json();
                setFormMessage({ type: 'error', text: error.detail || 'Failed to add class' });
            }
        } catch (error) {
            setFormMessage({ type: 'error', text: 'Failed to add class' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClass = async (classId: string) => {
        if (!confirm('Delete this class?')) return;

        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            const response = await fetch(`http://localhost:3001/api/teacher/classes/${classId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setTeacherClasses(teacherClasses.filter(c => c.id !== classId));
                setFormMessage({ type: 'success', text: 'Class deleted successfully!' });
                setTimeout(() => setFormMessage(null), 3000);
            }
        } catch (error) {
            setFormMessage({ type: 'error', text: 'Failed to delete class' });
        }
    };

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

    // Show timetable management view
    if (view === 'timetable') {
        return <TeacherPersonalTimetable onBack={() => setView('dashboard')} user={user} />;
    }

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
                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => setView('timetable')}
                            className="flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
                        >
                            <CalendarIcon className="w-8 h-8" />
                            <span className="text-lg font-semibold">My Teaching Schedule</span>
                        </button>
                    </div>
                    
                    <InfoCard title="Upcoming Schedule">
                        {upcomingClasses.length > 0 ? (
                            upcomingClasses.map((slot, index) => (
                                <div key={index} className="flex items-start space-x-3 py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                                    <CalendarIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-white">{slot.time}</p>
                                        <p className="text-sm">
                                            <strong>{slot.subject}</strong>
                                            {slot.department && <span> - {slot.department}</span>}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Sem: {slot.semester} | Sec: {slot.section}
                                            {slot.room && <span> | Room: {slot.room}</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                                <CalendarIcon className="w-6 h-6" />
                                <p>No upcoming classes for today</p>
                            </div>
                        )}
                    </InfoCard>
                    
                    <InfoCard title="Your Classes">
                        {formMessage && (
                            <div className={`mb-4 p-3 rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                {formMessage.text}
                            </div>
                        )}
                        
                        <button
                            onClick={() => setShowClassForm(!showClassForm)}
                            className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                        >
                            {showClassForm ? 'Cancel' : '+ Add Class'}
                        </button>

                        {showClassForm && (
                            <form onSubmit={handleAddClass} className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Subject"
                                    value={classFormData.subject}
                                    onChange={(e) => setClassFormData({ ...classFormData, subject: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                />
                                <input
                                    type="text"
                                    placeholder="Department"
                                    value={classFormData.department}
                                    onChange={(e) => setClassFormData({ ...classFormData, department: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                />
                                <input
                                    type="text"
                                    placeholder="Semester"
                                    value={classFormData.semester}
                                    onChange={(e) => setClassFormData({ ...classFormData, semester: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                />
                                <input
                                    type="text"
                                    placeholder="Section"
                                    value={classFormData.section}
                                    onChange={(e) => setClassFormData({ ...classFormData, section: e.target.value.toUpperCase() })}
                                    required
                                    maxLength={3}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-green-400"
                                >
                                    {isSubmitting ? 'Adding...' : 'Add Class'}
                                </button>
                            </form>
                        )}

                        {teacherClasses.length > 0 ? (
                            <ul className="space-y-3">
                                {teacherClasses.map((cls) => (
                                    <li key={cls.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-base text-gray-800 dark:text-white">
                                            <span className="font-semibold text-lg">{cls.subject}</span> - {cls.department} | Sem: {cls.semester} | Sec: {cls.section}
                                        </p>
                                        <button
                                            onClick={() => handleDeleteClass(cls.id)}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-base font-medium ml-4"
                                        >
                                            Delete
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">No classes added yet. Click "Add Class" to get started.</p>
                        )}
                    </InfoCard>
                </>
            )}
        </div>
    );
};

export default TeacherDashboard;
