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
                    <ul className="space-y-2">
                       {recentAnnouncements.map(ann => (
                           <li key={ann.id} className="text-sm">
                               <div className="line-clamp-1">
                                    <span className="font-semibold">{ann.title}</span>
                                    {(ann.eventDate || ann.eventTime) && (
                                        <span className="text-xs ml-2">
                                            {ann.eventDate && `📅 ${new Date(ann.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`}
                                            {ann.eventTime && ` ⏰ ${ann.eventTime}`}
                                        </span>
                                    )}
                               </div>
                           </li>
                       ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementsTicker;