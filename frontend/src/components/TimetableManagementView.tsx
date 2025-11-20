import React, { useState, useEffect } from 'react';
import { CalendarIcon, Spinner, CheckCircleIcon, XCircleIcon, ClockIcon, UsersIcon } from './Icons';
import { User } from '../types';

interface TimetableManagementViewProps {
    onBack: () => void;
    user: User;
}

interface TimeSlot {
    time: string;
    subject: string;
    teacher: string;
    room: string;
}

interface DaySchedule {
    [day: string]: TimeSlot[];
}

interface Timetable {
    id: string;
    _id?: string;
    branch: string;
    section: string;
    semester: string;
    days: DaySchedule;
    uploadedAt?: string;
    uploadDate?: string;
    lastUpdated?: string;
    createdAt?: string;
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

const TimetableManagementView: React.FC<TimetableManagementViewProps> = ({ onBack, user }) => {
    const token = localStorage.getItem('authToken');
    const [timetables, setTimetables] = useState<Timetable[]>([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [viewingTimetable, setViewingTimetable] = useState<Timetable | null>(null);
    
    // Form state for new/edit timetable
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [semester, setSemester] = useState('1');
    const [schedule, setSchedule] = useState<DaySchedule>({});
    const [editingSlot, setEditingSlot] = useState<{ day: string; time: string } | null>(null);
    const [slotData, setSlotData] = useState({ subject: '', teacher: '', room: '' });
    const [customTime, setCustomTime] = useState('');
    const [timeSlots, setTimeSlots] = useState<string[]>([...TIME_SLOTS]);
    const [editingTime, setEditingTime] = useState<string | null>(null);
    const [editingTimeValue, setEditingTimeValue] = useState('');

    // Fetch timetables
    const fetchTimetables = async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/timetables/class', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📚 Fetched timetables:', data);
                if (data.length > 0) {
                    console.log('📚 First timetable structure:', Object.keys(data[0]));
                }
                setTimetables(data);
            }
        } catch (error) {
            console.error('Error fetching timetables:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimetables();
    }, []);

    // Extract time slots from schedule when editing existing timetable
    useEffect(() => {
        if (editingTimetableId && schedule && Object.keys(schedule).length > 0) {
            const allTimes = new Set<string>();
            Object.values(schedule).forEach(daySlots => {
                daySlots.forEach(slot => {
                    if (slot.time) {
                        allTimes.add(slot.time);
                    }
                });
            });
            
            if (allTimes.size > 0) {
                const sortedTimes = Array.from(allTimes).sort();
                setTimeSlots(sortedTimes);
                console.log('📝 Extracted time slots:', sortedTimes);
            }
        }
    }, [editingTimetableId, schedule]);

    // Add time slot to schedule
    const addTimeSlot = (day: string, time: string) => {
        setEditingSlot({ day, time });
        setSlotData({ subject: '', teacher: '', room: '' });
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
        if (!editingSlot || !slotData.subject || !customTime) return;

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
            teacher: slotData.teacher,
            room: slotData.room
        });

        // Sort by time
        newSchedule[day].sort((a, b) => a.time.localeCompare(b.time));

        setSchedule(newSchedule);
        setEditingSlot(null);
        setSlotData({ subject: '', teacher: '', room: '' });
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
        if (!branch || !section || !semester || Object.keys(schedule).length === 0) {
            setErrorMessage('Please fill all required fields and add at least one time slot');
            setTimeout(() => setErrorMessage(null), 3000);
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/timetables/class/manual', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    branch,
                    section,
                    semester,
                    days: schedule
                })
            });

            if (response.ok) {
                setSuccessMessage('Class timetable created successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchTimetables();
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
        setBranch('');
        setSection('');
        setSemester('1');
        setSchedule({});
        setEditingSlot(null);
        setCustomTime('');
        setTimeSlots([...TIME_SLOTS]);
        setEditingTimetableId(null);
    };

    // Delete timetable
    const handleDelete = async (id: string) => {
        if (!confirm('Delete this timetable?')) return;

        try {
            const response = await fetch(`http://localhost:3001/api/timetables/class/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setSuccessMessage('Timetable deleted successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchTimetables();
            }
        } catch (error) {
            console.error('Error deleting timetable:', error);
        }
    };

    // Edit timetable
    const handleEdit = (timetable: Timetable) => {
        console.log('📝 Editing timetable:', timetable);
        console.log('📝 Days data:', timetable.days);
        console.log('📝 Monday slots:', timetable.days?.Monday);
        setEditingTimetableId(timetable.id);
        setBranch(timetable.branch);
        setSection(timetable.section);
        setSemester(timetable.semester);
        setSchedule(timetable.days || {});
        console.log('📝 Schedule state after setting:', schedule);
        setShowCreateForm(true);
        setViewingTimetable(null);
    };

    // Update timetable
    const handleUpdateTimetable = async () => {
        if (!editingTimetableId || !branch || !section || !semester || Object.keys(schedule).length === 0) {
            setErrorMessage('Please fill all required fields and add at least one class');
            setTimeout(() => setErrorMessage(null), 3000);
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/timetables/class/${editingTimetableId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    branch,
                    section,
                    semester,
                    days: schedule
                })
            });

            if (response.ok) {
                setSuccessMessage('Timetable updated successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchTimetables();
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
                                {user.role === 'Teacher' ? 'My Teaching Schedule' : 'Class Timetable Management'}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                {user.role === 'Teacher' 
                                    ? 'Create and manage your personal teaching timetables' 
                                    : 'Create and manage class timetables for sections'}
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
                            <span>Create New Timetable</span>
                        </button>
                    </div>
                )}

                {/* Create Form */}
                {showCreateForm && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                Create Class Timetable
                            </h2>
                            <button
                                onClick={resetForm}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Branch / Department *
                                </label>
                                <select
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Branch/Department</option>
                                    <option value="Computer Science Engineering">Computer Science Engineering (CSE)</option>
                                    <option value="Information Science Engineering">Information Science Engineering (ISE)</option>
                                    <option value="Electronics and Communication Engineering">Electronics and Communication Engineering (ECE)</option>
                                    <option value="Mechanical Engineering">Mechanical Engineering (ME)</option>
                                    <option value="Civil Engineering">Civil Engineering (CE)</option>
                                    <option value="Artificial Intelligence and Machine Learning">Artificial Intelligence and Machine Learning (AI/ML)</option>
                                    <option value="Data Science">Data Science (DS)</option>
                                    <option value="Electrical Engineering">Electrical Engineering (EE)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Section *
                                </label>
                                <input
                                    type="text"
                                    value={section}
                                    onChange={(e) => setSection(e.target.value)}
                                    placeholder="e.g., A"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Semester *
                                </label>
                                <select
                                    value={semester}
                                    onChange={(e) => setSemester(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                        <option key={sem} value={sem}>{sem}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Weekly Schedule Builder */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                <ClockIcon className="w-5 h-5 mr-2 text-blue-600" />
                                Weekly Schedule
                            </h3>

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
                                                                        placeholder="Time (e.g., 9:00 AM - 10:00 AM)"
                                                                        value={customTime}
                                                                        onChange={(e) => setCustomTime(e.target.value)}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 font-semibold"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Subject"
                                                                        value={slotData.subject}
                                                                        onChange={(e) => setSlotData({ ...slotData, subject: e.target.value })}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Teacher"
                                                                        value={slotData.teacher}
                                                                        onChange={(e) => setSlotData({ ...slotData, teacher: e.target.value })}
                                                                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Room"
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
                                                                    <div className="text-blue-700 dark:text-blue-400">Teacher: {slot.teacher}</div>
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
                                {editingTimetableId ? 'Update Timetable' : 'Create Timetable'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Timetables List */}
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
                            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                                <div className="flex items-center space-x-1">
                                    <UsersIcon className="w-4 h-4" />
                                    <span>Section: {viewingTimetable.section}</span>
                                </div>
                                <span>•</span>
                                <span>Semester: {viewingTimetable.semester}</span>
                            </div>

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
                                                                        {slot.teacher && (
                                                                            <div className="text-xs text-blue-700 dark:text-blue-400">
                                                                                Teacher: {slot.teacher}
                                                                            </div>
                                                                        )}
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
                        {user.role === 'Teacher' ? 'My Timetables' : 'All Class Timetables'} ({timetables.length})
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner className="w-10 h-10" />
                        </div>
                    ) : timetables.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">{user.role === 'Teacher' ? 'You have not uploaded any timetables yet.' : 'No timetables created yet.'}</p>
                            <p className="text-sm mt-2">Click the button above to create your first timetable.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {timetables.map(timetable => (
                                <div
                                    key={timetable.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {timetable.branch}
                                            </h3>
                                            <div className="flex items-center space-x-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                <UsersIcon className="w-4 h-4" />
                                                <span>Section: {timetable.section}</span>
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                Semester: {timetable.semester}
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-2">
                                            <button
                                                onClick={() => setViewingTimetable(timetable)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleEdit(timetable)}
                                                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(timetable.id)}
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

export default TimetableManagementView;
