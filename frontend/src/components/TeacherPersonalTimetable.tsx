import React, { useState, useEffect } from 'react';
import { CalendarIcon, Spinner, CheckCircleIcon, XCircleIcon, ClockIcon, UsersIcon } from './Icons';
import { User } from '../types';

interface TeacherPersonalTimetableProps {
    onBack: () => void;
    user: User;
}

interface TimeSlot {
    time: string;
    subject: string;
    department: string;
    semester: string;
    section: string;
    room: string;
}

interface DaySchedule {
    [day: string]: TimeSlot[];
}

interface TeacherTimetable {
    id: string;
    _id?: string;
    subject: string;
    branch?: string;
    section: string;
    semester: string;
    days: DaySchedule;
    createdAt?: string;
    updatedAt?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '9:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 1:00 PM',
    '1:00 PM - 2:00 PM',
    '2:00 PM - 3:00 PM',
    '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM'
];

const SUBJECTS = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'Data Structures',
    'Algorithms',
    'Database Management',
    'Operating Systems',
    'Computer Networks',
    'Software Engineering',
    'Web Development',
    'Machine Learning',
    'Artificial Intelligence',
    'Digital Electronics',
    'Microprocessors',
    'Signal Processing',
    'Control Systems',
    'Thermodynamics',
    'Fluid Mechanics',
    'Mechanics of Materials',
    'Engineering Graphics',
    'English',
    'Professional Ethics',
    'Other'
];

const DEPARTMENTS = [
    'Computer Science Engineering',
    'Information Science Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Artificial Intelligence and Machine Learning',
    'Data Science',
    'Electrical Engineering'
];

const TeacherPersonalTimetable: React.FC<TeacherPersonalTimetableProps> = ({ onBack, user }) => {
    const token = localStorage.getItem('authToken');
    const [myTimetables, setMyTimetables] = useState<TeacherTimetable[]>([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [viewingTimetable, setViewingTimetable] = useState<TeacherTimetable | null>(null);
    
    // Form state for new/edit timetable
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
    const [timetableName, setTimetableName] = useState('');
    const [schedule, setSchedule] = useState<DaySchedule>({});
    const [editingSlot, setEditingSlot] = useState<{ day: string; time: string } | null>(null);
    const [slotData, setSlotData] = useState({ subject: '', department: '', semester: '', section: '', room: '' });
    const [customTime, setCustomTime] = useState('');
    const [timeSlots, setTimeSlots] = useState<string[]>([...TIME_SLOTS]);
    const [editingTime, setEditingTime] = useState<string | null>(null);
    const [editingTimeValue, setEditingTimeValue] = useState('');

    // Fetch teacher's timetables
    const fetchMyTimetables = async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/timetables/teacher', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMyTimetables(data);
            }
        } catch (error) {
            console.error('Error fetching timetables:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyTimetables();
    }, []);

    // Add time slot to schedule
    const addTimeSlot = (day: string, time: string) => {
        setEditingSlot({ day, time });
        setSlotData({ subject: '', department: '', semester: '', section: '', room: '' });
        setCustomTime(time);
    };

    const addCustomTimeSlot = () => {
        if (customTime && !timeSlots.includes(customTime)) {
            const newSlots = [...timeSlots, customTime].sort();
            setTimeSlots(newSlots);
        }
    };

    const startEditingTime = (time: string) => {
        setEditingTime(time);
        setEditingTimeValue(time);
    };

    const saveEditedTime = (oldTime: string) => {
        if (editingTimeValue && editingTimeValue !== oldTime) {
            // Update timeSlots array
            const newSlots = timeSlots.map(t => t === oldTime ? editingTimeValue : t).sort();
            setTimeSlots(newSlots);

            // Update schedule if there are classes at this time
            const newSchedule = { ...schedule };
            Object.keys(newSchedule).forEach(day => {
                newSchedule[day] = newSchedule[day].map(slot => 
                    slot.time === oldTime ? { ...slot, time: editingTimeValue } : slot
                );
            });
            setSchedule(newSchedule);
        }
        setEditingTime(null);
    };

    const deleteTimeSlot = (time: string) => {
        if (!confirm(`Delete time slot "${time}" and all classes at this time?`)) return;
        
        // Remove from timeSlots
        setTimeSlots(timeSlots.filter(t => t !== time));
        
        // Remove all classes at this time
        const newSchedule = { ...schedule };
        Object.keys(newSchedule).forEach(day => {
            newSchedule[day] = newSchedule[day].filter(slot => slot.time !== time);
            if (newSchedule[day].length === 0) {
                delete newSchedule[day];
            }
        });
        setSchedule(newSchedule);
    };

    const saveTimeSlot = () => {
        if (!editingSlot || !slotData.subject || !slotData.department || !slotData.semester || !slotData.section || !customTime) return;

        const { day } = editingSlot;
        const time = customTime;
        const newSchedule = { ...schedule };
        
        if (!newSchedule[day]) {
            newSchedule[day] = [];
        }

        // Remove existing slot at this time if any
        newSchedule[day] = newSchedule[day].filter(slot => slot.time !== time);
        
        // Add new slot
        newSchedule[day].push({
            time,
            subject: slotData.subject,
            department: slotData.department,
            semester: slotData.semester,
            section: slotData.section,
            room: slotData.room
        });

        // Sort by time
        newSchedule[day].sort((a, b) => a.time.localeCompare(b.time));

        setSchedule(newSchedule);
        setEditingSlot(null);
        setSlotData({ subject: '', semester: '', section: '', room: '' });
    };

    const removeTimeSlot = (day: string, time: string) => {
        const newSchedule = { ...schedule };
        if (newSchedule[day]) {
            newSchedule[day] = newSchedule[day].filter(slot => slot.time !== time);
            if (newSchedule[day].length === 0) {
                delete newSchedule[day];
            }
        }
        setSchedule(newSchedule);
    };

    // Create new timetable
    const handleCreateTimetable = async () => {
        if (!timetableName || Object.keys(schedule).length === 0) {
            setErrorMessage('Please enter a timetable name and add at least one time slot');
            setTimeout(() => setErrorMessage(null), 3000);
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/timetables/teacher', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    branch: timetableName,
                    days: schedule
                })
            });

            if (response.ok) {
                setSuccessMessage('Teaching schedule created successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchMyTimetables();
                resetForm();
            } else {
                const error = await response.json();
                setErrorMessage(error.detail || 'Failed to create timetable');
                setTimeout(() => setErrorMessage(null), 3000);
            }
        } catch (error) {
            console.error('Error creating timetable:', error);
            setErrorMessage('Failed to create timetable');
            setTimeout(() => setErrorMessage(null), 3000);
        }
    };

    const resetForm = () => {
        setShowCreateForm(false);
        setEditingTimetableId(null);
        setTimetableName('');
        setSchedule({});
        setEditingSlot(null);
        setSlotData({ subject: '', department: '', semester: '', section: '', room: '' });
        setCustomTime('');
        setTimeSlots([...TIME_SLOTS]);
    };

    // Delete timetable
    const handleDelete = async (id: string) => {
        if (!confirm('Delete this teaching schedule?')) return;

        try {
            const response = await fetch(`http://localhost:3001/api/timetables/teacher/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setSuccessMessage('Schedule deleted successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchMyTimetables();
            } else {
                const error = await response.json();
                setErrorMessage(error.detail || 'Failed to delete schedule');
                setTimeout(() => setErrorMessage(null), 3000);
            }
        } catch (error) {
            console.error('Error deleting timetable:', error);
            setErrorMessage('Failed to delete schedule');
            setTimeout(() => setErrorMessage(null), 3000);
        }
    };

    // Edit timetable
    const handleEdit = (timetable: TeacherTimetable) => {
        setEditingTimetableId(timetable.id);
        setTimetableName(timetable.branch || '');
        setSchedule(timetable.days);
        setShowCreateForm(true);
        setViewingTimetable(null);
    };

    // Update timetable
    const handleUpdateTimetable = async () => {
        if (!editingTimetableId || !timetableName || Object.keys(schedule).length === 0) {
            setErrorMessage('Please enter a timetable name and add at least one time slot');
            setTimeout(() => setErrorMessage(null), 3000);
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/timetables/teacher/${editingTimetableId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    branch: timetableName,
                    days: schedule
                })
            });

            if (response.ok) {
                setSuccessMessage('Teaching schedule updated successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchMyTimetables();
                resetForm();
            } else {
                const error = await response.json();
                setErrorMessage(error.detail || 'Failed to update timetable');
                setTimeout(() => setErrorMessage(null), 3000);
            }
        } catch (error) {
            console.error('Error updating timetable:', error);
            setErrorMessage('Failed to update timetable');
            setTimeout(() => setErrorMessage(null), 3000);
        }
    };

    const getSlotAtTime = (day: string, time: string) => {
        return schedule[day]?.find(slot => slot.time === time);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
                            <CalendarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                My Teaching Schedule
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Your personal teaching timetable - Track which classes you teach and when
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                        &larr; Back to Dashboard
                    </button>
                </div>

                {/* Success/Error Messages */}
                {successMessage && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                            <span className="text-sm text-green-800 dark:text-green-300">{successMessage}</span>
                        </div>
                    </div>
                )}

                {errorMessage && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center">
                            <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                            <span className="text-sm text-red-800 dark:text-red-300">{errorMessage}</span>
                        </div>
                    </div>
                )}

                {/* Create New Timetable Button */}
                {!showCreateForm && (
                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg transition-colors flex items-center space-x-2"
                        >
                            <CalendarIcon className="w-5 h-5" />
                            <span>Create New Teaching Schedule</span>
                        </button>
                    </div>
                )}

                {/* Create Form */}
                {showCreateForm && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                Create Teaching Schedule
                            </h2>
                            <button
                                onClick={resetForm}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Timetable Name *
                                </label>
                                <input
                                    type="text"
                                    value={timetableName}
                                    onChange={(e) => setTimetableName(e.target.value)}
                                    placeholder="e.g., My Weekly Schedule, Fall 2024 Teaching"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    This is your personal teaching schedule - name it to identify which classes you teach
                                </p>
                            </div>
                        </div>

                        {/* Weekly Schedule Builder */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                                <ClockIcon className="w-5 h-5 mr-2 text-blue-600" />
                                My Teaching Hours
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Add the classes you teach - specify subject, semester, and section for each time slot
                            </p>

                            <div className="mb-4 flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={customTime}
                                    onChange={(e) => setCustomTime(e.target.value)}
                                    placeholder="Add custom time (e.g., 9:00 AM - 10:00 AM)"
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={addCustomTimeSlot}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                                >
                                    Add Time Slot
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border border-gray-200 dark:border-gray-700">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700">
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                                                Time
                                            </th>
                                            {DAYS.map(day => (
                                                <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                                                    {day}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSlots.map(time => (
                                            <tr key={time} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                                    {editingTime === time ? (
                                                        <div className="flex items-center space-x-1">
                                                            <input
                                                                type="text"
                                                                value={editingTimeValue}
                                                                onChange={(e) => setEditingTimeValue(e.target.value)}
                                                                className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => saveEditedTime(time)}
                                                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                                                                title="Save"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingTime(null)}
                                                                className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded"
                                                                title="Cancel"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between group">
                                                            <span>{time}</span>
                                                            <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                                                                <button
                                                                    onClick={() => startEditingTime(time)}
                                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs"
                                                                    title="Edit time"
                                                                >
                                                                    ✎
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTimeSlot(time)}
                                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 text-xs"
                                                                    title="Delete time slot"
                                                                >
                                                                    🗑
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                {DAYS.map(day => {
                                                    const slot = getSlotAtTime(day, time);
                                                    const isEditing = editingSlot?.day === day && editingSlot?.time === time;

                                                    return (
                                                        <td key={`${day}-${time}`} className="px-2 py-2 border-r border-gray-200 dark:border-gray-600">
                                                            {isEditing ? (
                                                                <div className="space-y-1">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Subject"
                                                                        value={slotData.subject}
                                                                        onChange={(e) => setSlotData({ ...slotData, subject: e.target.value })}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Department"
                                                                        value={slotData.department}
                                                                        onChange={(e) => setSlotData({ ...slotData, department: e.target.value })}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Sem+Sec (e.g., 3A)"
                                                                        value={slotData.semester ? `${slotData.semester}${slotData.section}` : ''}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value.toUpperCase();
                                                                            const sem = value.match(/^\d+/)?.[0] || '';
                                                                            const sec = value.replace(/^\d+/, '');
                                                                            setSlotData({ ...slotData, semester: sem, section: sec });
                                                                        }}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Room No"
                                                                        value={slotData.room}
                                                                        onChange={(e) => setSlotData({ ...slotData, room: e.target.value })}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <div className="flex space-x-1">
                                                                        <button
                                                                            onClick={saveTimeSlot}
                                                                            className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingSlot(null)}
                                                                            className="flex-1 px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : slot ? (
                                                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded text-xs space-y-1">
                                                                    <div className="font-semibold text-blue-900 dark:text-blue-300">{slot.subject}</div>
                                                                    {slot.department && <div className="text-blue-700 dark:text-blue-400">Dept: {slot.department}</div>}
                                                                    <div className="text-blue-700 dark:text-blue-400">Sem: {slot.semester} | Sec: {slot.section}</div>
                                                                    {slot.room && <div className="text-blue-600 dark:text-blue-500">Room: {slot.room}</div>}
                                                                    <button
                                                                        onClick={() => removeTimeSlot(day, time)}
                                                                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs mt-1"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => addTimeSlot(day, time)}
                                                                    className="w-full h-full min-h-[60px] text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
                                                                >
                                                                    + Add
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={resetForm}
                                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingTimetableId ? handleUpdateTimetable : handleCreateTimetable}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                            >
                                {editingTimetableId ? 'Update Schedule' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                )}

                {/* My Timetables List */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    {viewingTimetable ? (
                        <>
                            {/* Schedule Detail View */}
                            <div className="mb-4">
                                <button
                                    onClick={() => setViewingTimetable(null)}
                                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                                >
                                    <span>&larr;</span>
                                    <span>Back to List</span>
                                </button>
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                                {viewingTimetable.branch}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                Personal Teaching Schedule
                            </p>

                            {/* Schedule Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border border-gray-200 dark:border-gray-700">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700">
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                                                Time
                                            </th>
                                            {DAYS.map(day => (
                                                <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                                                    {day}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // Get all unique time slots from the schedule
                                            const allTimes = new Set<string>();
                                            Object.values(viewingTimetable.days).forEach(slots => {
                                                slots.forEach(slot => allTimes.add(slot.time));
                                            });
                                            const sortedTimes = Array.from(allTimes).sort();

                                            return sortedTimes.map(time => (
                                                <tr key={time} className="border-t border-gray-200 dark:border-gray-700">
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                                        {time}
                                                    </td>
                                                    {DAYS.map(day => {
                                                        const daySlots = viewingTimetable.days[day] || [];
                                                        const slot = daySlots.find(s => s.time === time);

                                                        return (
                                                            <td key={`${day}-${time}`} className="px-2 py-2 border-r border-gray-200 dark:border-gray-600">
                                                                {slot ? (
                                                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded text-sm">
                                                                        <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                                                                            {slot.subject}
                                                                        </div>
                                                                        <div className="text-xs text-blue-700 dark:text-blue-400">
                                                                            {slot.department && <div>Dept: {slot.department}</div>}
                                                                            {(slot.semester || slot.section) && (
                                                                                <div>Sem: {slot.semester} | Sec: {slot.section}</div>
                                                                            )}
                                                                        </div>
                                                                        {slot.room && (
                                                                            <div className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                                                                                Room: {slot.room}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-20 flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                                        -
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <CalendarIcon className="w-6 h-6 mr-2 text-blue-600" />
                        My Teaching Schedules ({myTimetables.length})
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Your personal teaching schedules - only visible to you
                    </p>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner className="w-10 h-10" />
                        </div>
                    ) : myTimetables.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">You haven't created your teaching schedule yet.</p>
                            <p className="text-sm mt-2">Click the button above to start tracking which classes you teach and when.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myTimetables.map(timetable => (
                                <div
                                    key={timetable.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                                    onClick={() => setViewingTimetable(timetable)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {timetable.branch}
                                            </h3>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Personal Teaching Schedule
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(timetable);
                                                }}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(timetable.id);
                                                }}
                                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {Object.keys(timetable.days).length} day(s) scheduled
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {Object.entries(timetable.days).slice(0, 2).map(([day, slots]) => (
                                                <div key={day} className="text-xs text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">{day}:</span> {slots.length} class(es)
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                            Click to view full schedule →
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherPersonalTimetable;
