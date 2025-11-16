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
    
    // Document metadata form
    const [documentType, setDocumentType] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [semester, setSemester] = useState<string>('');
    const [branch, setBranch] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    
    // Filters
    const [filterType, setFilterType] = useState<string>('all');
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterSemester, setFilterSemester] = useState<string>('all');
    const [showAnalysisModal, setShowAnalysisModal] = useState<Document | null>(null);
    
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
        if (!uploadFile) {
            setUploadError('Please select a file to upload.');
            return;
        }
        
        if (!documentType || !subject || !semester) {
            setUploadError('Please fill in Document Type, Subject, and Semester before uploading.');
            return;
        }
        
        setIsUploading(true);
        setUploadError(null);
        setUploadSuccess('Uploading document with your settings...');
        
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('documentType', documentType);
        formData.append('subject', subject);
        formData.append('semester', semester);
        if (branch) formData.append('branch', branch);
        if (description) formData.append('description', description);

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
            const result = await response.json();
            setUploadSuccess(`✅ Successfully uploaded ${uploadFile.name}!\n📊 Type: ${documentType} | Subject: ${subject} | Semester: ${semester}`);
            
            // Reset form
            setUploadFile(null);
            setDocumentType('');
            setSubject('');
            setSemester('');
            setBranch('');
            setDescription('');
            
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

    // Filter documents
    const filteredDocuments = documents.filter(doc => {
        if (filterType !== 'all' && doc.documentType !== filterType) return false;
        if (filterSubject !== 'all' && doc.subject !== filterSubject) return false;
        if (filterSemester !== 'all' && doc.semester?.toString() !== filterSemester) return false;
        return true;
    });

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
                
                {/* Step 1: Document Information Form */}
                <div className="mb-6 space-y-4">
                    <h5 className="text-md font-medium text-gray-700 dark:text-gray-300">Step 1: Document Information</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Document Type <span className="text-red-500">*</span>
                            </label>
                            <select 
                                value={documentType} 
                                onChange={(e) => setDocumentType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            >
                                <option value="">Select Type</option>
                                <option value="syllabus">Syllabus</option>
                                <option value="assignment">Assignment</option>
                                <option value="notes">Notes</option>
                                <option value="question_paper">Question Paper</option>
                                <option value="tutorial">Tutorial</option>
                                <option value="project">Project</option>
                                <option value="presentation">Presentation</option>
                                <option value="notice">Notice</option>
                                <option value="general">General</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g., Mathematics, Physics"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Semester <span className="text-red-500">*</span>
                            </label>
                            <select 
                                value={semester} 
                                onChange={(e) => setSemester(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            >
                                <option value="">Select Semester</option>
                                <option value="1">Semester 1</option>
                                <option value="2">Semester 2</option>
                                <option value="3">Semester 3</option>
                                <option value="4">Semester 4</option>
                                <option value="5">Semester 5</option>
                                <option value="6">Semester 6</option>
                                <option value="7">Semester 7</option>
                                <option value="8">Semester 8</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Branch (Optional)
                            </label>
                            <select 
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="">All Branches</option>
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description (Optional)
                            </label>
                            <input 
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                </div>
                
                {/* Step 2: File Upload */}
                <div>
                    <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Step 2: Select File</h5>
                    <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={isUploading} />
                    <div onClick={() => fileInputRef.current?.click()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500'}`}>
                        <UploadIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                        {uploadFile ? (<p className="font-semibold text-gray-700 dark:text-gray-200">{uploadFile.name}</p>) : (<p className="font-semibold text-gray-700 dark:text-gray-200">Drop a file here or <span className="text-red-500">browse</span></p>)}
                        <p className="text-sm text-gray-500 dark:text-gray-400">Accepts PDF, Word, and PowerPoint files</p>
                    </div>
                </div>
                
                {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                {uploadSuccess && <p className="mt-2 text-sm text-green-600 dark:text-green-400 whitespace-pre-line">{uploadSuccess}</p>}
                <div className="mt-4 text-center">
                    <button onClick={handleUpload} disabled={!uploadFile || !documentType || !subject || !semester || isUploading} className="w-full max-w-xs mx-auto flex items-center justify-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed">
                        {isUploading ? <><Spinner className="w-5 h-5" /><span>Uploading...</span></> : <><UploadIcon className="w-5 h-5" /><span>Upload Document</span></>}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-semibold mb-3 text-gray-800 dark:text-white">Filter Documents</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Types</option>
                            <option value="syllabus">Syllabus</option>
                            <option value="assignment">Assignment</option>
                            <option value="notes">Notes</option>
                            <option value="question_paper">Question Paper</option>
                            <option value="tutorial">Tutorial</option>
                            <option value="project">Project</option>
                            <option value="presentation">Presentation</option>
                            <option value="notice">Notice</option>
                            <option value="general">General</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                        <select 
                            value={filterSubject} 
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Subjects</option>
                            {[...new Set(documents.map(d => d.subject).filter(Boolean))].map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                        <select 
                            value={filterSemester} 
                            onChange={(e) => setFilterSemester(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Semesters</option>
                            {[1,2,3,4,5,6,7,8].map(sem => (
                                <option key={sem} value={sem}>Semester {sem}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Document List */}
            <div>
                 <h4 className="text-lg font-semibold mb-4">Uploaded Documents ({filteredDocuments.length})</h4>
                 <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Filename</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sem</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th scope="col" className="relative py-3 px-4"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center p-4 text-gray-500"><Spinner /></td></tr>
                            ) : error ? (
                                <tr><td colSpan={7} className="text-center p-4 text-red-500">{error}</td></tr>
                            ) : filteredDocuments.length === 0 ? (
                                <tr><td colSpan={7} className="text-center p-4 text-gray-500">No documents match the selected filters.</td></tr>
                            ) : (
                                filteredDocuments.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={doc.originalname}>{doc.originalname}</td>
                                        <td className="py-3 px-4 text-sm">
                                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                {doc.documentType || 'general'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                                            {doc.subject || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                                            {doc.semester || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{formatBytes(doc.size)}</td>
                                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 text-right space-x-2">
                                            {doc.aiAnalyzed && (
                                                <button 
                                                    onClick={() => setShowAnalysisModal(doc)}
                                                    className="p-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" 
                                                    aria-label="View AI Analysis"
                                                    title="View AI Analysis"
                                                >
                                                    🤖
                                                </button>
                                            )}
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

            {/* AI Analysis Modal */}
            {showAnalysisModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                    🤖 AI Analysis Results
                                </h3>
                                <button
                                    onClick={() => setShowAnalysisModal(null)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Document Name</h4>
                                <p className="text-lg font-medium text-gray-900 dark:text-white">{showAnalysisModal.originalname}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Type</h4>
                                    <span className="px-3 py-1 text-sm rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                        {showAnalysisModal.documentType || 'Unknown'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Subject</h4>
                                    <p className="text-gray-900 dark:text-white">{showAnalysisModal.subject || 'Not detected'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Semester</h4>
                                    <p className="text-gray-900 dark:text-white">{showAnalysisModal.semester ? `Semester ${showAnalysisModal.semester}` : 'Not specified'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Branch</h4>
                                    <p className="text-gray-900 dark:text-white">{showAnalysisModal.branch || 'Not specified'}</p>
                                </div>
                            </div>
                            
                            {showAnalysisModal.description && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Description</h4>
                                    <p className="text-gray-700 dark:text-gray-300">{showAnalysisModal.description}</p>
                                </div>
                            )}
                            
                            {showAnalysisModal.topics && showAnalysisModal.topics.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Topics Covered</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {showAnalysisModal.topics.map((topic, idx) => (
                                            <span key={idx} className="px-3 py-1 text-sm rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                                                {topic}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {showAnalysisModal.keywords && showAnalysisModal.keywords.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Keywords</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {showAnalysisModal.keywords.map((keyword, idx) => (
                                            <span key={idx} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                #{keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentManagementView;
