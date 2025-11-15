import React from 'react';
import { Announcement } from '../types';
import { MegaphoneIcon, CalendarIcon, ClockIcon, LocationMarkerIcon } from './Icons';

interface AnnouncementsTickerProps {
    announcements: Announcement[];
}

const AnnouncementsTicker: React.FC<AnnouncementsTickerProps> = ({ announcements }) => {
    if (!announcements || announcements.length === 0) {
        return null;
    }

    // Show only the 3 most recent announcements
    const recentAnnouncements = announcements.slice(0, 3);

    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-300 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <MegaphoneIcon className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="ml-3 flex-1">
                    <p className="text-sm font-bold mb-2">Recent Updates</p>
                    <ul className="space-y-3">
                       {recentAnnouncements.map(ann => (
                           <li key={ann.id} className="text-sm">
                               <div>
                                    <span className="font-semibold">{ann.title}:</span> {ann.content}
                               </div>
                                {(ann.eventDate || ann.eventTime || ann.location) && (
                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-yellow-700 dark:text-yellow-400">
                                        {ann.eventDate && (
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <CalendarIcon className="w-4 h-4" />
                                                {new Date(ann.eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                                            </span>
                                        )}
                                        {ann.eventTime && (
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <ClockIcon className="w-4 h-4" />
                                                {ann.eventTime}
                                            </span>
                                        )}
                                        {ann.location && (
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <LocationMarkerIcon className="w-4 h-4" />
                                                {ann.location}
                                            </span>
                                        )}
                                    </div>
                                )}
                           </li>
                       ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementsTicker;