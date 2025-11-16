import React, { useState, FormEvent } from 'react';
import { Announcement } from '../types';
import { PencilIcon, TrashIcon, MegaphoneIcon, Spinner, SparklesIcon } from './Icons';
import AnnouncementAIAssistant from './AnnouncementAIAssistant';

interface AnnouncementsManagementViewProps {
    announcements: Announcement[];
    onCreate: (announcement: Omit<Announcement, 'id' | 'date'>) => Promise<void>;
    onUpdate: (announcement: Announcement) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onBack: () => void;
    onRefresh?: () => Promise<void>;
}

interface MessageModal {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

const AnnouncementsManagementView: React.FC<AnnouncementsManagementViewProps> = ({ announcements, onCreate, onUpdate, onDelete, onBack, onRefresh }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
    const [messageModal, setMessageModal] = useState<MessageModal | null>(null);
    
    const [showEventDetails, setShowEventDetails] = useState(false);
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [location, setLocation] = useState('');

    const resetForm = () => {
        setTitle('');
        setContent('');
        setEditingId(null);
        setShowEventDetails(false);
        setEventDate('');
        setEventTime('');
        setLocation('');
    };

    const handleEditClick = (announcement: Announcement) => {
        setEditingId(announcement.id);
        setTitle(announcement.title);
        setContent(announcement.content);
        if (announcement.eventDate || announcement.eventTime || announcement.location) {
            setShowEventDetails(true);
            setEventDate(announcement.eventDate || '');
            setEventTime(announcement.eventTime || '');
            setLocation(announcement.location || '');
        } else {
            setShowEventDetails(false);
            setEventDate('');
            setEventTime('');
            setLocation('');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('Title and content cannot be empty.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Omit<Announcement, 'id' | 'date'> = {
                title,
                content,
                eventDate: showEventDetails ? (eventDate || null) : null,
                eventTime: showEventDetails ? (eventTime || null) : null,
                location: showEventDetails ? (location || null) : null,
            };

            if (editingId) {
                const existingAnnouncement = announcements.find(a => a.id === editingId);
                if (existingAnnouncement) {
                    await onUpdate({ ...existingAnnouncement, ...payload });
                }
            } else {
                await onCreate(payload);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to submit announcement", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleApplySuggestion = (improvedText: { title: string; content: string }) => {
        setTitle(improvedText.title);
        setContent(improvedText.content);
        setIsAssistantOpen(false);
    };

    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        setShowDeleteAllConfirm(false);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/announcements/all', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete announcements');
            }

            const data = await response.json();
            
            // Show success message immediately
            setMessageModal({
                type: 'success',
                title: 'Success',
                message: `Successfully deleted ${data.deletedCount} announcements`
            });
            
            // Refresh data in the background (don't wait for it)
            if (onRefresh) {
                onRefresh().catch(err => console.error('Error refreshing data:', err));
            }
        } catch (error) {
            console.error('Error deleting all announcements:', error);
            setMessageModal({
                type: 'error',
                title: 'Error',
                message: 'Failed to delete announcements. Please try again.'
            });
            
            // Still try to refresh on error to sync state
            if (onRefresh) {
                onRefresh().catch(err => console.error('Error refreshing data:', err));
            }
        } finally {
            setIsDeletingAll(false);
        }
    };

    const MessageModalComponent: React.FC<{ modal: MessageModal; onClose: () => void }> = ({ modal, onClose }) => {
        const bgColor = modal.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/30'
            : modal.type === 'error'
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-blue-100 dark:bg-blue-900/30';
        
        const iconColor = modal.type === 'success'
            ? 'text-green-600 dark:text-green-400'
            : modal.type === 'error'
            ? 'text-red-600 dark:text-red-400'
            : 'text-blue-600 dark:text-blue-400';
        
        const Icon = modal.type === 'success' 
            ? SparklesIcon
            : modal.type === 'error'
            ? TrashIcon
            : MegaphoneIcon;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-slide-in">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`${bgColor} p-3 rounded-full`}>
                            <Icon className={`w-6 h-6 ${iconColor}`} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{modal.title}</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-6">{modal.message}</p>
                    
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm space-y-6">
             {isAssistantOpen && (
                <AnnouncementAIAssistant 
                    isOpen={isAssistantOpen}
                    onClose={() => setIsAssistantOpen(false)}
                    currentTitle={title}
                    currentContent={content}
                    onApplySuggestion={handleApplySuggestion}
                />
            )}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                        <MegaphoneIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Announcements Management</h3>
                </div>
                <button onClick={onBack} className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline">
                    &larr; Back to Dashboard
                </button>
            </div>

            {/* Form for Creating/Editing */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold mb-4">{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h4>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={4}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="relative flex items-start">
                            <div className="flex h-5 items-center">
                                <input id="showEventDetails" name="showEventDetails" type="checkbox" checked={showEventDetails} onChange={(e) => setShowEventDetails(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"/>
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="showEventDetails" className="font-medium text-gray-700 dark:text-gray-300">Add Event Details</label>
                            </div>
                        </div>
                        {showEventDetails && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Date</label>
                                    <input type="date" id="eventDate" value={eventDate} onChange={e => setEventDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                                </div>
                                <div>
                                    <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Time</label>
                                    <input type="time" id="eventTime" value={eventTime} onChange={e => setEventTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                                </div>
                                <div>
                                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                                    <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., Main Auditorium" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                        <button type="button" onClick={() => setIsAssistantOpen(true)} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-2">
                           <SparklesIcon className="w-4 h-4" />
                           AI Assistant
                        </button>
                        {editingId && (
                             <button type="button" onClick={resetForm} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50">
                                Cancel Edit
                            </button>
                        )}
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center justify-center min-w-[160px] disabled:bg-red-400">
                            {isSubmitting ? <Spinner className="w-5 h-5"/> : (editingId ? 'Update Announcement' : 'Post Announcement')}
                        </button>
                    </div>
                </form>
            </div>
            
            {/* List of Announcements */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">Existing Announcements</h4>
                    {announcements.length > 0 && (
                        <button
                            onClick={() => setShowDeleteAllConfirm(true)}
                            disabled={isDeletingAll}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center gap-2 disabled:bg-red-400"
                        >
                            {isDeletingAll ? (
                                <Spinner className="w-4 h-4" />
                            ) : (
                                <TrashIcon className="w-4 h-4" />
                            )}
                            Delete All Announcements
                        </button>
                    )}
                </div>
                {announcements.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No announcements found.</p>
                ) : (
                    announcements.map(ann => (
                        <div key={ann.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex justify-between items-start">
                            <div>
                                <h5 className="font-bold">{ann.title}</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ann.content}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Posted on: {new Date(ann.date).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                                <button onClick={() => handleEditClick(ann)} className="p-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit announcement: ${ann.title}`}>
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(ann.id)} className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete announcement: ${ann.title}`}>
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete All Confirmation Modal */}
            {showDeleteAllConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                                <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Delete All Announcements?</h3>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-red-600 dark:text-red-400">all {announcements.length} announcements</span>? 
                            This action cannot be undone and will remove all scraped and manually created announcements.
                        </p>
                        
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteAllConfirm(false)}
                                disabled={isDeletingAll}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                disabled={isDeletingAll}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:bg-red-400 flex items-center gap-2"
                            >
                                {isDeletingAll ? (
                                    <>
                                        <Spinner className="w-4 h-4" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete All'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Modal */}
            {messageModal && (
                <MessageModalComponent
                    modal={messageModal}
                    onClose={() => setMessageModal(null)}
                />
            )}
        </div>
    );
};

export default AnnouncementsManagementView;