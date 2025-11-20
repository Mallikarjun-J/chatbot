import React, { useState } from 'react';
import { Save, Plus, Trash2, Calendar, Clock, User as UserIcon, MapPin, BookOpen } from 'lucide-react';

interface TimeSlot {
    time: string;
    subject: string;
    teacher: string;
    room: string;
}

interface DaySchedule {
    [day: string]: TimeSlot[];
}

interface VisualTimetableEditorProps {
    onSave: (data: {
        branch: string;
        section: string;
        semester: string;
        days: DaySchedule;
    }) => Promise<void>;
    onCancel: () => void;
}

const VisualTimetableEditor: React.FC<VisualTimetableEditorProps> = ({ onSave, onCancel }) => {
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [semester, setSemester] = useState('');
    const [schedule, setSchedule] = useState<DaySchedule>({
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const branches = [
        'Computer Science Engineering',
        'Information Science Engineering',
        'Electronics and Communication Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Artificial Intelligence and Machine Learning',
        'Data Science',
        'Electrical Engineering'
    ];

    const addSlot = (day: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: [...prev[day], { time: '', subject: '', teacher: '', room: '' }]
        }));
    };

    const removeSlot = (day: string, index: number) => {
        setSchedule(prev => ({
            ...prev,
            [day]: prev[day].filter((_, i) => i !== index)
        }));
    };

    const updateSlot = (day: string, index: number, field: keyof TimeSlot, value: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: prev[day].map((slot, i) => 
                i === index ? { ...slot, [field]: value } : slot
            )
        }));
    };

    const handleSave = async () => {
        // Validation
        if (!branch || !section || !semester) {
            setError('Please fill in branch, section, and semester');
            return;
        }

        // Check if at least one day has schedule
        const hasSchedule = Object.values(schedule).some(slots => slots.length > 0);
        if (!hasSchedule) {
            setError('Please add at least one class to the schedule');
            return;
        }

        // Validate all slots have required fields
        for (const [day, slots] of Object.entries(schedule)) {
            for (const slot of slots) {
                if (!slot.time || !slot.subject) {
                    setError(`Please fill in time and subject for all classes in ${day}`);
                    return;
                }
            }
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSave({ branch, section, semester, days: schedule });
        } catch (err: any) {
            setError(err.message || 'Failed to save timetable');
        } finally {
            setIsSaving(false);
        }
    };

    const copyDay = (fromDay: string, toDay: string) => {
        setSchedule(prev => ({
            ...prev,
            [toDay]: [...prev[fromDay].map(slot => ({ ...slot }))]
        }));
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-800 rounded-lg p-6 text-white">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-7 h-7" />
                    Visual Timetable Editor
                </h2>
                <p className="text-indigo-100">
                    Create class schedules using an intuitive visual interface. Add classes day by day with all details.
                </p>
            </div>

            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Class Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Branch *
                        </label>
                        <select
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Select Branch</option>
                            {branches.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Semester *
                        </label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Select Semester</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                <option key={sem} value={sem}>{sem}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Section *
                        </label>
                        <input
                            type="text"
                            value={section}
                            onChange={(e) => setSection(e.target.value.toUpperCase())}
                            placeholder="e.g., A, B, C"
                            maxLength={1}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Day-by-Day Schedule Editor */}
            <div className="space-y-4">
                {daysOfWeek.map((day) => (
                    <div
                        key={day}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                        {/* Day Header */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    {day}
                                    {schedule[day].length > 0 && (
                                        <span className="ml-2 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full">
                                            {schedule[day].length} {schedule[day].length === 1 ? 'class' : 'classes'}
                                        </span>
                                    )}
                                </h4>
                                <div className="flex gap-2">
                                    {/* Copy from dropdown */}
                                    {daysOfWeek.filter(d => d !== day && schedule[d].length > 0).length > 0 && (
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    copyDay(e.target.value, day);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                        >
                                            <option value="">Copy from...</option>
                                            {daysOfWeek.filter(d => d !== day && schedule[d].length > 0).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    )}
                                    <button
                                        onClick={() => addSlot(day)}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Class
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div className="p-4 space-y-3">
                            {schedule[day].length === 0 ? (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    No classes scheduled for this day. Click "Add Class" to start.
                                </p>
                            ) : (
                                schedule[day].map((slot, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                                    >
                                        {/* Time */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Time *
                                            </label>
                                            <input
                                                type="text"
                                                value={slot.time}
                                                onChange={(e) => updateSlot(day, index, 'time', e.target.value)}
                                                placeholder="9:00-10:00"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
                                            />
                                        </div>

                                        {/* Subject */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                <BookOpen className="w-3 h-3" />
                                                Subject *
                                            </label>
                                            <input
                                                type="text"
                                                value={slot.subject}
                                                onChange={(e) => updateSlot(day, index, 'subject', e.target.value)}
                                                placeholder="Data Structures"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
                                            />
                                        </div>

                                        {/* Teacher */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                <UserIcon className="w-3 h-3" />
                                                Teacher
                                            </label>
                                            <input
                                                type="text"
                                                value={slot.teacher}
                                                onChange={(e) => updateSlot(day, index, 'teacher', e.target.value)}
                                                placeholder="Dr. Smith"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
                                            />
                                        </div>

                                        {/* Room */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                Room
                                            </label>
                                            <input
                                                type="text"
                                                value={slot.room}
                                                onChange={(e) => updateSlot(day, index, 'room', e.target.value)}
                                                placeholder="101"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
                                            />
                                        </div>

                                        {/* Delete Button */}
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => removeSlot(day, index)}
                                                className="w-full px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span className="text-sm">Remove</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end sticky bottom-0 bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Timetable
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default VisualTimetableEditor;
