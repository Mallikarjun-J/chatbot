import React, { useState, useRef } from 'react';
import { CalendarIcon, UploadIcon, Spinner, CheckCircleIcon, XCircleIcon } from './Icons';
import { User, ClassTimetable } from '../types';

interface TimetableManagementViewProps {
    onBack: () => void;
    user: User;
}

const TimetableManagementView: React.FC<TimetableManagementViewProps> = ({ onBack, user }) => {
    const [file, setFile] = useState<File | null>(null);
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = user.role === 'Admin';

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
            if (allowedTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
                setErrorMessage(null);
            } else {
                setErrorMessage('Please upload a PDF, PNG, or JPG file');
                setFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setErrorMessage('Please select a file');
            return;
        }

        if (isAdmin && (!branch || !section)) {
            setErrorMessage('Please enter branch and section');
            return;
        }

        setIsUploading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const formData = new FormData();
            formData.append('timetable', file);
            
            if (isAdmin) {
                formData.append('branch', branch);
                formData.append('section', section);
            }

            const token = localStorage.getItem('token');
            const endpoint = isAdmin ? '/api/timetables/class' : '/api/timetables/teacher';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await response.json();
            setSuccessMessage(`Timetable uploaded successfully!`);
            setFile(null);
            setBranch('');
            setSection('');
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to upload timetable');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    ← Back
                </button>
                <CalendarIcon className="w-6 h-6 text-indigo-600" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isAdmin ? 'Class Timetable Management' : 'My Timetable'}
                </h2>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Upload Timetable</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Timetable File (PDF/PNG/JPG)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            className="block w-full text-sm border rounded-lg cursor-pointer"
                        />
                        {file && <p className="mt-2 text-sm text-green-600">✓ {file.name}</p>}
                    </div>

                    {isAdmin && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Branch</label>
                                <input
                                    type="text"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    placeholder="Computer Science"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Section</label>
                                <input
                                    type="text"
                                    value={section}
                                    onChange={(e) => setSection(e.target.value)}
                                    placeholder="A"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    {successMessage && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <CheckCircleIcon className="w-5 h-5 text-green-600 inline mr-2" />
                            <span className="text-sm text-green-800">{successMessage}</span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <XCircleIcon className="w-5 h-5 text-red-600 inline mr-2" />
                            <span className="text-sm text-red-800">{errorMessage}</span>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || !file}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg"
                    >
                        {isUploading ? (
                            <>
                                <Spinner className="w-5 h-5 inline mr-2" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <UploadIcon className="w-5 h-5 inline mr-2" />
                                Upload
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimetableManagementView;
