import React, { useState, FormEvent } from 'react';
import { User, UserRole } from '../types';
import { PencilIcon, TrashIcon, UsersIcon, Spinner } from './Icons';

interface UserManagementViewProps {
    users: User[];
    onCreateUser: (user: Omit<User, 'id'>) => Promise<void>;
    onEditUserRole: (userId: string, newRole: UserRole) => void;
    onDeleteUser: (userId: string) => void;
    onBack: () => void;
}

const UserRow: React.FC<{ user: User; onEdit: (id: string, role: UserRole) => void; onDelete: (id: string) => void; }> = ({ user, onEdit, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState(user.role);

    const handleSave = () => {
        onEdit(user.id, selectedRole);
        setIsEditing(false);
    }

    const roleOptions = Object.values(UserRole).map(role => (
        <option key={role} value={role}>{role}</option>
    ));

    const roleBadgeColor = {
        [UserRole.ADMIN]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        [UserRole.TEACHER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [UserRole.STUDENT]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    };

    return (
        <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
            <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
            <td className="py-3 px-4">
                {isEditing ? (
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="text-xs p-1 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 focus:ring-indigo-500"
                    >
                        {roleOptions}
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
                            <button onClick={() => onDelete(user.id)} className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete user ${user.name}`}>
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

const CreateUserForm: React.FC<{ onCreateUser: (user: Omit<User, 'id'>) => Promise<void> }> = ({ onCreateUser }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole.STUDENT | UserRole.TEACHER>(UserRole.STUDENT);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            alert('Name and email cannot be empty.');
            return;
        }
        setIsSubmitting(true);
        try {
            await onCreateUser({ name, email, role });
            // Reset form on success
            setName('');
            setEmail('');
            setRole(UserRole.STUDENT);
        } catch (error) {
            // Error is alerted in the parent component
            console.error("Failed to create user from form");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-6">
            <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Add New User</h4>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                    <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"/>
                </div>
                 <div className="md:col-span-1">
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

            <CreateUserForm onCreateUser={onCreateUser} />

            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                            <th scope="col" className="relative py-3 px-4"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map(user => (
                           <UserRow key={user.id} user={user} onEdit={onEditUserRole} onDelete={onDeleteUser} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagementView;