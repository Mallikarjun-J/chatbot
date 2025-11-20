import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, BookOpen, AlertCircle, RefreshCw, Building, Plus, Edit, Save, X } from 'lucide-react';

interface TimeSlot {
  time: string;
  subject: string;
  branch?: string;
  section: string;
  semester?: string;
  room?: string;
}

interface DaySchedule {
  [day: string]: TimeSlot[];
}

interface TeacherTimetable {
  id: string;
  teacherName: string;
  department?: string;
  subject: string;
  days: DaySchedule;
  uploadedAt?: string;
}

const TeacherTimetableView: React.FC = () => {
  const [timetables, setTimetables] = useState<TeacherTimetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DaySchedule>({});

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    // Set current day on mount
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (daysOfWeek.includes(today)) {
      setSelectedDay(today);
    } else {
      setSelectedDay('Monday'); // Default to Monday if it's Sunday
    }

    fetchMyTimetable();
  }, []);

  const fetchMyTimetable = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Please login to view your timetable');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/timetables/teacher/my-timetable', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to fetch timetable');
      }

      const data = await response.json();
      // Handle both single object and array responses
      const timetableData = Array.isArray(data) ? data : [data];
      setTimetables(timetableData);
      setEditingSchedule(timetableData[0]?.days || {});
    } catch (err: any) {
      console.error('Error fetching timetable:', err);
      if (err.message.includes("hasn't been uploaded") || err.message.includes("404")) {
        // No timetable exists yet, allow creation
        setTimetables([]);
        setError(null);
      } else {
        setError(err.message || 'Failed to load timetable');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimetable = () => {
    setIsEditing(true);
    setEditingSchedule({});
  };

  const handleSaveTimetable = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      setLoading(true);
      const method = timetables.length > 0 ? 'PUT' : 'POST';
      const url = timetables.length > 0 
        ? `http://localhost:3001/api/timetables/teacher/my-timetable/${timetables[0].id}`
        : 'http://localhost:3001/api/timetables/teacher/my-timetable';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: editingSchedule }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save timetable');
      }

      setIsEditing(false);
      await fetchMyTimetable();
    } catch (err: any) {
      console.error('Error saving timetable:', err);
      alert(err.message || 'Failed to save timetable');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = (day: string) => {
    const newClass: TimeSlot = {
      time: '9:00 AM - 10:00 AM',
      subject: '',
      branch: '',
      section: '',
      semester: '',
      room: '',
    };

    setEditingSchedule(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newClass],
    }));
  };

  const handleUpdateClass = (day: string, index: number, field: keyof TimeSlot, value: string) => {
    setEditingSchedule(prev => ({
      ...prev,
      [day]: prev[day].map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const handleDeleteClass = (day: string, index: number) => {
    setEditingSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
  };

  const getTodaySchedule = () => {
    if (!selectedDay) return [];
    
    if (isEditing) {
      return editingSchedule[selectedDay] || [];
    }
    
    if (!timetables || timetables.length === 0) return [];
    
    // Aggregate all classes from all timetables for the selected day
    const allClasses: TimeSlot[] = [];
    timetables.forEach(tt => {
      if (tt.days[selectedDay]) {
        allClasses.push(...tt.days[selectedDay]);
      }
    });
    
    // Sort by time
    return allClasses.sort((a, b) => {
      const timeA = a.time.split(' - ')[0];
      const timeB = b.time.split(' - ')[0];
      return timeA.localeCompare(timeB);
    });
  };

  const getTotalWeeklyClasses = () => {
    if (!timetables || timetables.length === 0) return 0;
    
    let total = 0;
    timetables.forEach(tt => {
      Object.values(tt.days).forEach(slots => {
        total += slots.length;
      });
    });
    return total;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your teaching schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
            Unable to Load Teaching Schedule
          </h3>
        </div>
        <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchMyTimetable}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!timetables || timetables.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
                No Teaching Schedule Available
              </h3>
              <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                Create your teaching schedule to get started.
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateTimetable}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </div>
      </div>
    );
  }

  const todaySchedule = getTodaySchedule();
  const totalWeeklyClasses = getTotalWeeklyClasses();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">My Teaching Schedule</h2>
            <div className="flex items-center gap-4 text-purple-100">
              {timetables[0]?.department && (
                <span className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  {timetables[0].department}
                </span>
              )}
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {timetables.length} {timetables.length === 1 ? 'Subject' : 'Subjects'}
              </span>
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {totalWeeklyClasses} Classes/Week
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditingSchedule(timetables[0]?.days || {});
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={fetchMyTimetable}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveTimetable}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingSchedule(timetables[0]?.days || {});
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {daysOfWeek.map((day) => {
          const dayClasses = isEditing 
            ? (editingSchedule[day]?.length || 0)
            : timetables.some(tt => tt.days[day] && tt.days[day].length > 0);
          const isToday = day === new Date().toLocaleDateString('en-US', { weekday: 'long' });
          
          // Count classes for this day
          let classCount = 0;
          if (isEditing) {
            classCount = editingSchedule[day]?.length || 0;
          } else {
            timetables.forEach(tt => {
              if (tt.days[day]) {
                classCount += tt.days[day].length;
              }
            });
          }
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedDay === day
                  ? 'bg-purple-600 text-white shadow-lg'
                  : dayClasses
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              } ${isToday && selectedDay !== day ? 'ring-2 ring-purple-400' : ''}`}
              disabled={!dayClasses}
            >
              {day}
              {isToday && <span className="ml-1 text-xs">(Today)</span>}
              {classCount > 0 && (
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                  {classCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule Display */}
      {isEditing ? (
        <div className="space-y-4">
          <button
            onClick={() => handleAddClass(selectedDay)}
            className="w-full py-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Class on {selectedDay}
          </button>

          {todaySchedule.map((slot, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Time (e.g., 9:00 AM - 10:00 AM)"
                  value={slot.time}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'time', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={slot.subject}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'subject', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Branch/Department"
                  value={slot.branch || ''}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'branch', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Section"
                  value={slot.section}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'section', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Semester"
                  value={slot.semester || ''}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'semester', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Room"
                  value={slot.room || ''}
                  onChange={(e) => handleUpdateClass(selectedDay, index, 'room', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => handleDeleteClass(selectedDay, index)}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : todaySchedule.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Classes on {selectedDay}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Enjoy your free time! 🎉
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {todaySchedule.map((slot, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        {slot.time}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {calculateDuration(slot.time)}
                      </p>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {slot.subject}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {slot.branch && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Building className="w-4 h-4" />
                        <span>{slot.branch}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>
                        Section {slot.section}
                        {slot.semester && ` - Sem ${slot.semester}`}
                      </span>
                    </div>
                    {slot.room && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>Room {slot.room}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual indicator */}
                <div className="w-2 h-full bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full ml-4"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Total classes this week:
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {totalWeeklyClasses} classes
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">
            Teaching subjects:
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {timetables.map(tt => tt.subject).join(', ')}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate duration
function calculateDuration(timeSlot: string): string {
  const match = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '';

  const [, startHr, startMin, startPeriod, endHr, endMin, endPeriod] = match;
  
  let startHour = parseInt(startHr);
  let endHour = parseInt(endHr);
  
  if (startPeriod.toUpperCase() === 'PM' && startHour !== 12) startHour += 12;
  if (startPeriod.toUpperCase() === 'AM' && startHour === 12) startHour = 0;
  if (endPeriod.toUpperCase() === 'PM' && endHour !== 12) endHour += 12;
  if (endPeriod.toUpperCase() === 'AM' && endHour === 12) endHour = 0;

  const startMinutes = startHour * 60 + parseInt(startMin);
  const endMinutes = endHour * 60 + parseInt(endMin);
  const duration = endMinutes - startMinutes;

  if (duration === 60) return '1 hour';
  if (duration < 60) return `${duration} minutes`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
}

export default TeacherTimetableView;
