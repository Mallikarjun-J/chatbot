import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';

interface TimeSlot {
  time: string;
  subject: string;
  teacher?: string;
  room?: string;
}

interface DaySchedule {
  [day: string]: TimeSlot[];
}

interface Timetable {
  id: string;
  branch: string;
  section: string;
  semester?: string;
  days: DaySchedule;
  uploadedAt?: string;
}

const StudentTimetableView: React.FC = () => {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('');

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

      const response = await fetch('http://localhost:3001/api/timetables/my-timetable', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        // Check if it's a profile incomplete error
        if (response.status === 400 && data.detail && data.detail.includes('branch')) {
          throw new Error('Your profile is incomplete. Please contact admin to update your branch and section.');
        }
        throw new Error(data.detail || 'Failed to fetch timetable');
      }

      const data = await response.json();
      setTimetable(data);
    } catch (err: any) {
      console.error('Error fetching timetable:', err);
      setError(err.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const getTodaySchedule = () => {
    if (!timetable || !selectedDay) return [];
    return timetable.days[selectedDay] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your timetable...</p>
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
            Unable to Load Timetable
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

  if (!timetable) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
              No Timetable Available
            </h3>
            <p className="text-yellow-700 dark:text-yellow-400 mt-1">
              Your class timetable hasn't been uploaded yet. Please check back later or contact your admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const todaySchedule = getTodaySchedule();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">My Class Timetable</h2>
            <div className="flex items-center gap-4 text-blue-100">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {timetable.branch}
              </span>
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Section {timetable.section}
              </span>
              {timetable.semester && (
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Semester {timetable.semester}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={fetchMyTimetable}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {daysOfWeek.map((day) => {
          const hasClasses = timetable.days[day] && timetable.days[day].length > 0;
          const isToday = day === new Date().toLocaleDateString('en-US', { weekday: 'long' });
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedDay === day
                  ? 'bg-blue-600 text-white shadow-lg'
                  : hasClasses
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              } ${isToday && selectedDay !== day ? 'ring-2 ring-blue-400' : ''}`}
              disabled={!hasClasses}
            >
              {day}
              {isToday && <span className="ml-1 text-xs">(Today)</span>}
              {hasClasses && (
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                  {timetable.days[day].length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule Display */}
      {todaySchedule.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Classes on {selectedDay}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Enjoy your day off! 🎉
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
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                    {slot.teacher && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="w-4 h-4" />
                        <span>{slot.teacher}</span>
                      </div>
                    )}
                    {slot.room && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>Room {slot.room}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual indicator */}
                <div className="w-2 h-full bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full ml-4"></div>
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
            {Object.values(timetable.days).reduce((sum, slots) => sum + slots.length, 0)} classes
          </span>
        </div>
        {timetable.uploadedAt && (
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">
              Last updated:
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {new Date(timetable.uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to calculate duration
function calculateDuration(timeSlot: string): string {
  const match = timeSlot.match(/(\d+):(\d+)-(\d+):(\d+)/);
  if (!match) return '';

  const [, startHr, startMin, endHr, endMin] = match.map(Number);
  const startMinutes = startHr * 60 + startMin;
  const endMinutes = endHr * 60 + endMin;
  const duration = endMinutes - startMinutes;

  if (duration === 60) return '1 hour';
  if (duration < 60) return `${duration} minutes`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
}

export default StudentTimetableView;
