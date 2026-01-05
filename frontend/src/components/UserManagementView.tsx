import React, { useState, FormEvent, useEffect } from 'react';
import { User, UserRole } from '../types';
import { PencilIcon, TrashIcon, UsersIcon, Spinner, CheckCircleIcon, XCircleIcon } from './Icons';

interface UserManagementViewProps {
    users: User[];
    onCreateUser: (user: Omit<User, 'id'>) => Promise<void>;
    onEditUserRole: (userId: string, newRole: UserRole) => void;
    onDeleteUser: (userId: string) => void;
    onBack: () => void;
}

interface Notification {
    type: 'success' | 'error';
    message: string;
}

interface DeleteConfirmation {
    userId: string;
    userName: string;
}

interface SuccessModal {
    userName: string;
    userRole: string;
}

const NotificationCard: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto-dismiss after 5 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = notification.type === 'success' 
        ? 'bg-green-50 border-green-500 dark:bg-green-900/30 dark:border-green-500'
        : 'bg-red-50 border-red-500 dark:bg-red-900/30 dark:border-red-500';
    
    const textColor = notification.type === 'success'
        ? 'text-green-800 dark:text-green-100'
        : 'text-red-800 dark:text-red-100';

    const Icon = notification.type === 'success' ? CheckCircleIcon : XCircleIcon;
    const iconColor = notification.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

    return (
        <div className={`${bgColor} ${textColor} border-l-4 p-4 rounded-lg shadow-md mb-4 flex items-center gap-3 animate-slide-in`}>
            <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
            <p className="flex-1 font-medium">{notification.message}</p>
            <button 
                onClick={onClose}
                className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
                aria-label="Close notification"
            >
                <XCircleIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

const DeleteConfirmationModal: React.FC<{ 
    userName: string; 
    onConfirm: () => void; 
    onCancel: () => void;
}> = ({ userName, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-slide-in">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                        <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm Deletion</h3>
                </div>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{userName}</span>? 
                    This action cannot be undone.
                </p>
                
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        Delete User
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserAddedSuccessModal: React.FC<{ 
    userName: string; 
    userRole: string;
    onClose: () => void;
}> = ({ userName, userRole, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-slide-in">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-4">
                        <CheckCircleIcon className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">User Added Successfully!</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        <span className="font-semibold text-gray-900 dark:text-white">{userName}</span> has been added as a <span className="font-semibold text-gray-900 dark:text-white">{userRole}</span>.
                    </p>
                    
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserRow: React.FC<{ 
    user: User; 
    onEdit: (id: string, role: UserRole) => void; 
    onDelete: (id: string) => void; 
    showBranchSection?: boolean;
    userRole?: 'teacher' | 'student';
    showNotification: (type: 'success' | 'error', message: string) => void;
    onRequestDelete: (userId: string, userName: string) => void;
}> = ({ user, onEdit, onDelete, showBranchSection = false, userRole, showNotification, onRequestDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState(user.role);
    const [selectedBranch, setSelectedBranch] = useState(user.branch || '');
    const [selectedSection, setSelectedSection] = useState(user.section || '');
    const [selectedSemester, setSelectedSemester] = useState((user as any).semester || '');

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    role: selectedRole,
                    branch: selectedBranch || null,
                    section: selectedSection || null,
                    semester: selectedSemester || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update user');
            }

            // Update local state
            user.role = selectedRole;
            user.branch = selectedBranch;
            user.section = selectedSection;
            (user as any).semester = selectedSemester;
            
            setIsEditing(false);
            showNotification('success', `${user.name}'s information updated successfully`);
        } catch (error) {
            showNotification('error', 'Failed to update user');
        }
    }

    const handleDelete = () => {
        onRequestDelete(user.id, user.name);
    }

    const roleBadgeColor = {
        [UserRole.ADMIN]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        [UserRole.TEACHER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [UserRole.STUDENT]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    };

    return (
        <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
            <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
            {showBranchSection && (
                <>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                        {isEditing ? (
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="text-xs p-1 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 w-full"
                            >
                                <option value="">Not set</option>
                                <option value="Computer Science Engineering">CSE</option>
                                <option value="Information Science Engineering">ISE</option>
                                <option value="Electronics and Communication Engineering">ECE</option>
                                <option value="Mechanical Engineering">ME</option>
                                <option value="Civil Engineering">CE</option>
                                <option value="Artificial Intelligence and Machine Learning">AI/ML</option>
                            </select>
                        ) : (
                            user.branch || <span className="text-gray-400 italic">Not set</span>
                        )}
                    </td>
                    {userRole === 'student' && (
                        <>
                            <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={selectedSemester}
                                        onChange={(e) => setSelectedSemester(e.target.value)}
                                        placeholder="e.g., 5"
                                        className="text-xs p-1 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 w-full"
                                    />
                                ) : (
                                    (user as any).semester || <span className="text-gray-400 italic">Not set</span>
                                )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={selectedSection}
                                        onChange={(e) => setSelectedSection(e.target.value)}
                                        placeholder="e.g., A"
                                        className="text-xs p-1 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 w-full"
                                    />
                                ) : (
                                    user.section || <span className="text-gray-400 italic">Not set</span>
                                )}
                            </td>
                        </>
                    )}
                </>
            )}
            <td className="py-3 px-4">
                {isEditing ? (
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="text-xs p-1 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 focus:ring-indigo-500"
                    >
                        <option value={UserRole.STUDENT}>Student</option>
                        <option value={UserRole.TEACHER}>Teacher</option>
                    </select>
                ) : (
                    <span className={`px-2 py-1 text-xs font-semibold leading-5 rounded-full ${roleBadgeColor[user.role]}`}>
                        {user.role}
                    </span>
                )}
            </td>
            <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end space-x-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">Save</button>
                            <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                        </>
                    ) : (
                         <>
                            <button onClick={() => setIsEditing(true)} className="p-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit role for ${user.name}`}>
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={handleDelete} className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete user ${user.name}`}>
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

const CreateUserForm: React.FC<{ 
    onCreateUser: (user: Omit<User, 'id'>) => Promise<void>; 
    showNotification: (type: 'success' | 'error', message: string) => void;
    onUserAdded: (userName: string, userRole: string) => void;
}> = ({ onCreateUser, showNotification, onUserAdded }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password] = useState('password123'); // Default password - no need to enter
    const [role, setRole] = useState<UserRole.STUDENT | UserRole.TEACHER>(UserRole.STUDENT);
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [semester, setSemester] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            showNotification('error', 'Name and email cannot be empty.');
            return;
        }
        if (role === UserRole.STUDENT && (!branch.trim() || !section.trim() || !semester.trim())) {
            showNotification('error', 'Branch, section, and semester are required for students.');
            return;
        }
        if (role === UserRole.TEACHER && !branch.trim()) {
            showNotification('error', 'Branch/Department is required for teachers.');
            return;
        }
        setIsSubmitting(true);
        try {
            const userData: any = { 
                name, 
                email,
                password,
                role,
                ...(role === UserRole.STUDENT && { branch, section, semester }),
                ...(role === UserRole.TEACHER && { branch })
            };
            await onCreateUser(userData);
            
            // Show success modal
            const userRoleDisplay = role === UserRole.STUDENT ? 'Student' : 'Teacher';
            onUserAdded(name, userRoleDisplay);
            
            // Reset form on success
            setName('');
            setEmail('');
            // password stays as default 'password123'
            setRole(UserRole.STUDENT);
            setBranch('');
            setSection('');
            setSemester('');
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to create user. Please try again.';
            showNotification('error', errorMessage);
            console.error("Failed to create user from form:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Add New User</h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        🔒 Default password: <span className="font-mono font-semibold">password123</span>
                    </p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                        <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole.STUDENT | UserRole.TEACHER)} disabled={isSubmitting} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600">
                            <option value={UserRole.STUDENT}>Student</option>
                            <option value={UserRole.TEACHER}>Teacher</option>
                        </select>
                    </div>
                </div>
                
                {/* Teacher-specific fields */}
                {role === UserRole.TEACHER && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div>
                            <label htmlFor="teacher-branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Branch/Department *</label>
                            <select 
                                id="teacher-branch" 
                                value={branch} 
                                onChange={(e) => setBranch(e.target.value)} 
                                required 
                                disabled={isSubmitting} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the department this teacher belongs to</p>
                        </div>
                    </div>
                )}
                
                {/* Student-specific fields */}
                {role === UserRole.STUDENT && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div>
                            <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Branch/Department *</label>
                            <select 
                                id="branch" 
                                value={branch} 
                                onChange={(e) => setBranch(e.target.value)} 
                                required 
                                disabled={isSubmitting} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Select Branch</option>
                                <option value="Computer Science Engineering">Computer Science Engineering (CSE)</option>
                                <option value="Information Science Engineering">Information Science Engineering (ISE)</option>
                                <option value="Electronics and Communication Engineering">Electronics and Communication Engineering (ECE)</option>
                                <option value="Mechanical Engineering">Mechanical Engineering (ME)</option>
                                <option value="Civil Engineering">Civil Engineering (CE)</option>
                                <option value="Artificial Intelligence and Machine Learning">Artificial Intelligence and Machine Learning (AI/ML)</option>

                            </select>
                        </div>
                        <div>
                            <label htmlFor="semester" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Semester *</label>
                            <select 
                                id="semester" 
                                value={semester} 
                                onChange={(e) => setSemester(e.target.value)} 
                                required 
                                disabled={isSubmitting} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Select Semester</option>
                                <option value="1">1st Semester</option>
                                <option value="2">2nd Semester</option>
                                <option value="3">3rd Semester</option>
                                <option value="4">4th Semester</option>
                                <option value="5">5th Semester</option>
                                <option value="6">6th Semester</option>
                                <option value="7">7th Semester</option>
                                <option value="8">8th Semester</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="section" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Section *</label>
                            <input 
                                type="text" 
                                id="section" 
                                value={section} 
                                onChange={(e) => setSection(e.target.value.toUpperCase())} 
                                placeholder="e.g., A, B, C" 
                                maxLength={1}
                                required 
                                disabled={isSubmitting} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400">
                        {isSubmitting ? <Spinner className="w-5 h-5"/> : 'Create User'}
                    </button>
                </div>
            </form>
        </div>
    );
}


const UserManagementView: React.FC<UserManagementViewProps> = ({ users, onCreateUser, onEditUserRole, onDeleteUser, onBack }) => {
    const [notification, setNotification] = useState<Notification | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
    const [successModal, setSuccessModal] = useState<SuccessModal | null>(null);
    
    // Search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterSemester, setFilterSemester] = useState('');
    const [filterSection, setFilterSection] = useState('');

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
    };

    const closeNotification = () => {
        setNotification(null);
    };

    const handleRequestDelete = (userId: string, userName: string) => {
        setDeleteConfirmation({ userId, userName });
    };

    const handleConfirmDelete = () => {
        if (deleteConfirmation) {
            try {
                onDeleteUser(deleteConfirmation.userId);
                showNotification('success', `User "${deleteConfirmation.userName}" deleted successfully`);
            } catch (error) {
                showNotification('error', 'Failed to delete user');
            }
            setDeleteConfirmation(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteConfirmation(null);
    };

    const handleUserAdded = (userName: string, userRole: string) => {
        setSuccessModal({ userName, userRole });
    };

    const closeSuccessModal = () => {
        setSuccessModal(null);
    };

    // Apply search and filters
    const filterUsers = (userList: User[]) => {
        return userList.filter(user => {
            // Search filter
            const matchesSearch = searchTerm === '' || 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Department/Branch filter
            const matchesDepartment = filterDepartment === '' || user.branch === filterDepartment;
            
            // Semester filter
            const matchesSemester = filterSemester === '' || user.semester === filterSemester;
            
            // Section filter
            const matchesSection = filterSection === '' || 
                user.section?.toUpperCase() === filterSection.toUpperCase();
            
            return matchesSearch && matchesDepartment && matchesSemester && matchesSection;
        });
    };

    // Separate users by role
    const teachers = filterUsers(users.filter(user => user.role === UserRole.TEACHER));
    const students = filterUsers(users.filter(user => user.role === UserRole.STUDENT));
    const admins = filterUsers(users.filter(user => user.role === UserRole.ADMIN));

    const UserTable: React.FC<{ 
        users: User[], 
        title: string, 
        emptyMessage: string, 
        bgColor: string, 
        showBranchSection?: boolean,
        userRole?: 'teacher' | 'student',
        showNotification: (type: 'success' | 'error', message: string) => void;
        onRequestDelete: (userId: string, userName: string) => void;
    }> = ({ users, title, emptyMessage, bgColor, showBranchSection = false, userRole, showNotification, onRequestDelete }) => (
        <div className="mb-6">
            <div className={`${bgColor} px-4 py-3 rounded-t-lg border-b-2`}>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <UsersIcon className="w-5 h-5" />
                    {title} ({users.length})
                </h4>
            </div>
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-b-lg shadow border border-gray-200 dark:border-gray-700">
                {users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        {emptyMessage}
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                {showBranchSection && (
                                    <>
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{userRole === 'teacher' ? 'Department' : 'Branch'}</th>
                                        {userRole === 'student' && (
                                            <>
                                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Semester</th>
                                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Section</th>
                                            </>
                                        )}
                                    </>
                                )}
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                <th scope="col" className="relative py-3 px-4"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map(user => (
                                <UserRow 
                                    key={user.id} 
                                    user={user} 
                                    onEdit={onEditUserRole} 
                                    onDelete={onDeleteUser} 
                                    showBranchSection={showBranchSection}
                                    userRole={userRole}
                                    showNotification={showNotification}
                                    onRequestDelete={onRequestDelete}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                        <UsersIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">User Management</h3>
                </div>
                <button onClick={onBack} className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline">
                    &larr; Back to Dashboard
                </button>
            </div>

            {/* Notification Card */}
            {notification && (
                <NotificationCard 
                    notification={notification} 
                    onClose={closeNotification} 
                />
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Teachers</div>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{teachers.length}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">Students</div>
                    <div className="text-3xl font-bold text-green-900 dark:text-green-100">{students.length}</div>
                </div>
            </div>

            <CreateUserForm onCreateUser={onCreateUser} showNotification={showNotification} onUserAdded={handleUserAdded} />

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">🔍 Search & Filter Users</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search Input */}
                    <div className="lg:col-span-2">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Search by Name or Email
                        </label>
                        <input
                            type="text"
                            id="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    {/* Department Filter */}
                    <div>
                        <label htmlFor="filterDepartment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Department/Branch
                        </label>
                        <select
                            id="filterDepartment"
                            value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">All Departments</option>
                            <option value="Computer Science Engineering">Computer Science Engineering (CSE)</option>
                            <option value="Information Science Engineering">Information Science Engineering (ISE)</option>
                            <option value="Electronics and Communication Engineering">Electronics and Communication Engineering (ECE)</option>
                            <option value="Mechanical Engineering">Mechanical Engineering (ME)</option>
                            <option value="Civil Engineering">Civil Engineering (CE)</option>
                            <option value="Artificial Intelligence and Machine Learning">Artificial Intelligence and Machine Learning (AI/ML)</option>
                        </select>
                    </div>

                    {/* Semester Filter */}
                    <div>
                        <label htmlFor="filterSemester" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Semester
                        </label>
                        <select
                            id="filterSemester"
                            value={filterSemester}
                            onChange={(e) => setFilterSemester(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">All Semesters</option>
                            <option value="1">1st Semester</option>
                            <option value="2">2nd Semester</option>
                            <option value="3">3rd Semester</option>
                            <option value="4">4th Semester</option>
                            <option value="5">5th Semester</option>
                            <option value="6">6th Semester</option>
                            <option value="7">7th Semester</option>
                            <option value="8">8th Semester</option>
                        </select>
                    </div>

                    {/* Section Filter */}
                    <div>
                        <label htmlFor="filterSection" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Section
                        </label>
                        <input
                            type="text"
                            id="filterSection"
                            value={filterSection}
                            onChange={(e) => setFilterSection(e.target.value.toUpperCase())}
                            placeholder="e.g., A, B, C"
                            maxLength={1}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                </div>
                
                {/* Clear Filters Button */}
                {(searchTerm || filterDepartment || filterSemester || filterSection) && (
                    <div className="mt-4">
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterDepartment('');
                                setFilterSemester('');
                                setFilterSection('');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Teachers Section */}
            <UserTable 
                users={teachers} 
                title="👨‍🏫 Teachers" 
                emptyMessage="No teachers found. Add teachers using the form above."
                bgColor="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                showBranchSection={true}
                userRole="teacher"
                showNotification={showNotification}
                onRequestDelete={handleRequestDelete}
            />

            {/* Students Section */}
            <UserTable 
                users={students} 
                title="🎓 Students" 
                emptyMessage="No students found. Add students using the form above."
                bgColor="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                showBranchSection={true}
                userRole="student"
                showNotification={showNotification}
                onRequestDelete={handleRequestDelete}
            />

            {/* Admins Section (Optional - only show if there are admins) */}
            {admins.length > 0 && (
                <UserTable 
                    users={admins} 
                    title="👑 Administrators" 
                    emptyMessage=""
                    bgColor="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    showNotification={showNotification}
                    onRequestDelete={handleRequestDelete}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <DeleteConfirmationModal
                    userName={deleteConfirmation.userName}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}

            {/* User Added Success Modal */}
            {successModal && (
                <UserAddedSuccessModal
                    userName={successModal.userName}
                    userRole={successModal.userRole}
                    onClose={closeSuccessModal}
                />
            )}
        </div>
    );
};

export default UserManagementView;