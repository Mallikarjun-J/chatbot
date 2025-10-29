import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { Document } from '../types';
import { DocumentIcon, UploadIcon, Spinner, CheckCircleIcon, TrashIcon } from './Icons';

interface DocumentManagementViewProps {
    onBack: () => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const DocumentManagementView: React.FC<DocumentManagementViewProps> = ({ onBack }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const fetchDocuments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/documents', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to fetch documents.');
            const data: Document[] = await response.json();
            setDocuments(data.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFileSelect = (file: File | null) => {
        setUploadError(null);
        setUploadSuccess(null);
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        if (file && allowedTypes.includes(file.type)) {
            setUploadFile(file);
        } else if (file) {
            setUploadError('Invalid file type. Please upload PDF, Word, or PPT.');
            setUploadFile(null);
        }
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        setIsUploading(true);
        setUploadError(null);
        setUploadSuccess(null);
        
        const formData = new FormData();
        formData.append('file', uploadFile);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/upload/document', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed.');
            }
            setUploadSuccess(`Successfully uploaded ${uploadFile.name}!`);
            setUploadFile(null);
            await fetchDocuments(); // Refresh the list
        } catch (error: any) {
            setUploadError(error.message);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDelete = async (docId: string) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`/api/documents/${docId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) throw new Error('Failed to delete document.');
                await fetchDocuments();
            } catch (err: any) {
                alert(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                        <DocumentIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Document Management</h3>
                </div>
                <button onClick={onBack} className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline">
                    &larr; Back to Dashboard
                </button>
            </div>
            
            {/* Upload Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold mb-4">Upload New Document</h4>
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={isUploading} />
                <div onClick={() => fileInputRef.current?.click()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500'}`}>
                    <UploadIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                    {uploadFile ? (<p className="font-semibold text-gray-700 dark:text-gray-200">{uploadFile.name}</p>) : (<p className="font-semibold text-gray-700 dark:text-gray-200">Drop a file here or <span className="text-red-500">browse</span></p>)}
                    <p className="text-sm text-gray-500 dark:text-gray-400">Accepts PDF, Word, and PowerPoint files</p>
                </div>
                 {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                 {uploadSuccess && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{uploadSuccess}</p>}
                <div className="mt-4 text-center">
                    <button onClick={handleUpload} disabled={!uploadFile || isUploading} className="w-full max-w-xs mx-auto flex items-center justify-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed">
                        {isUploading ? <><Spinner className="w-5 h-5" /><span>Uploading...</span></> : <><UploadIcon className="w-5 h-5" /><span>Upload Document</span></>}
                    </button>
                </div>
            </div>

            {/* Document List */}
            <div>
                 <h4 className="text-lg font-semibold mb-4">Uploaded Documents</h4>
                 <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Filename</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date Uploaded</th>
                                <th scope="col" className="relative py-3 px-4"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center p-4 text-gray-500"><Spinner /></td></tr>
                            ) : error ? (
                                <tr><td colSpan={4} className="text-center p-4 text-red-500">{error}</td></tr>
                            ) : documents.length === 0 ? (
                                <tr><td colSpan={4} className="text-center p-4 text-gray-500">No documents have been uploaded yet.</td></tr>
                            ) : (
                                documents.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white truncate" title={doc.originalname}>{doc.originalname}</td>
                                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{formatBytes(doc.size)}</td>
                                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{new Date(doc.uploadDate).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right">
                                            <button onClick={() => handleDelete(doc.id)} className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${doc.originalname}`}>
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                         </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

export default DocumentManagementView;
