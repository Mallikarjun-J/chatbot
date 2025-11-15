import React, { useState, FormEvent } from 'react';
import { User, UserRole } from '../types';
import { UserIcon, LockIcon, OtpIcon, Spinner, KeyIcon } from './Icons';

interface LoginComponentProps {
  onLoginSuccess: (user: User) => void;
}

type FlowState = 'login' | 'otp' | 'forgotPassword_email' | 'forgotPassword_verify' | 'forgotPassword_reset';

const RoleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; isDisabled?: boolean; }> = ({ label, isSelected, onClick, isDisabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={`w-full text-center px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            isSelected
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow'
                : 'bg-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
        } ${isDisabled ? 'cursor-not-allowed' : ''}`}
        aria-pressed={isSelected}
        aria-disabled={isDisabled}
    >
        {label}
    </button>
);


const LoginComponent: React.FC<LoginComponentProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [otp, setOtp] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAdminFlow, setIsAdminFlow] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  
  // State for password reset
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


  
  const resetFlowState = () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(false);
    setSelectedRole(UserRole.STUDENT);
    setOtp('');
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setIsAdminFlow(false);
    setPendingUser(null);
    setPendingToken(null);
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            setError(data.error || data.detail || 'Invalid email or password.');
            throw new Error(data.error || data.detail || 'Login failed.');
        }

        // Check if the user's role matches the selected role (except for potential admin)
        if (data.user.role !== UserRole.ADMIN && data.user.role !== selectedRole) {
            setError(`You're not registered as a ${selectedRole}. Please select the correct role.`);
            setIsLoading(false);
            return;
        }

        // All users require OTP verification
        const isAdmin = data.user.role === UserRole.ADMIN;
        setIsAdminFlow(isAdmin);
        setPendingUser(data.user);
        setPendingToken(data.token);
        
        // Send OTP
        try {
            const otpResponse = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const otpData = await otpResponse.json();

            if (!otpResponse.ok) {
                setError(otpData.detail || 'Failed to send OTP');
                setIsLoading(false);
                return;
            }

            setSuccessMessage('OTP sent to your email. Please check your inbox.');
            setFlowState('otp');
        } catch (otpErr) {
            setError('Failed to send OTP. Please try again.');
            console.error('OTP error:', otpErr);
        }

    } catch (err) {
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleOtpVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!pendingUser) {
        setError('Session error. Please try logging in again.');
        setFlowState('login');
        setIsLoading(false);
        return;
    }

    try {
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: pendingUser.id,
                otp_code: otp
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            setError(data.detail || 'Invalid OTP. Please try again.');
            setIsLoading(false);
            return;
        }

        // OTP verified successfully
        localStorage.setItem('authToken', data.token);
        onLoginSuccess(data.user);
    } catch (err) {
        console.error('OTP verification error:', err);
        setError('Failed to verify OTP. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleRequestResetCode = async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);
      setIsLoading(true);

      try {
          const response = await fetch('/api/auth/forgot-password', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email: resetEmail }),
          });

          const data = await response.json();

          if (response.ok) {
              setSuccessMessage(`A password reset code has been sent to ${resetEmail}. Please check your email.`);
              setFlowState('forgotPassword_verify');
          } else {
              const errorMsg = typeof data.detail === 'string' 
                  ? data.detail 
                  : Array.isArray(data.detail) 
                      ? data.detail.map((err: any) => err.msg).join(', ')
                      : 'Failed to send reset code. Please try again.';
              setError(errorMsg);
          }
      } catch (err) {
          console.error('Reset code error:', err);
          setError('Failed to send reset code. Please try again.');
      } finally {
          setIsLoading(false);
      }
  };

  const handleVerifyCode = async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);
      setIsLoading(true);

      console.log('Verifying reset code:', { email: resetEmail, code: resetCode });

      try {
          const response = await fetch('/api/auth/verify-reset-code', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  email: resetEmail,
                  reset_code: resetCode
              }),
          });

          const data = await response.json();

          if (response.ok) {
              setSuccessMessage('Code verified. You can now set a new password.');
              setFlowState('forgotPassword_reset');
          } else {
              const errorMsg = typeof data.detail === 'string' 
                  ? data.detail 
                  : Array.isArray(data.detail) 
                      ? data.detail.map((err: any) => err.msg).join(', ')
                      : 'Invalid reset code. Please try again.';
              setError(errorMsg);
          }
      } catch (err) {
          console.error('Verification error:', err);
          setError('Failed to verify code. Please try again.');
      } finally {
          setIsLoading(false);
      }
  };

  const handleResetPassword = async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long.');
        setIsLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
      }
      setIsLoading(true);

      try {
          const response = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  email: resetEmail,
                  reset_code: resetCode,
                  new_password: newPassword
              }),
          });

          const data = await response.json();

          if (response.ok) {
              setSuccessMessage('Your password has been successfully reset! You can now log in with your new password.');
              setTimeout(() => {
                  setEmail(resetEmail);
                  setPassword('');
                  resetFlowState();
                  setFlowState('login');
              }, 3000);
          } else {
              const errorMsg = typeof data.detail === 'string' 
                  ? data.detail 
                  : Array.isArray(data.detail) 
                      ? data.detail.map((err: any) => err.msg).join(', ')
                      : 'Failed to reset password. Please try again.';
              setError(errorMsg);
          }
      } catch (err) {
          console.error('Password reset error:', err);
          setError('Failed to reset password. Please try again.');
      } finally {
          setIsLoading(false);
      }
  };
  
  const getModalTitle = () => {
    if (flowState.startsWith('forgotPassword')) return 'Reset Password';
    return 'Member Login';
  };

  const renderContent = () => {
    switch (flowState) {
      case 'login':
        return (
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">I am a:</p>
              <div className="flex justify-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                  <RoleButton label="Student" isSelected={selectedRole === UserRole.STUDENT} onClick={() => setSelectedRole(UserRole.STUDENT)} isDisabled={false} />
                  <RoleButton label="Teacher" isSelected={selectedRole === UserRole.TEACHER} onClick={() => setSelectedRole(UserRole.TEACHER)} isDisabled={false} />
                  <RoleButton label="Admin" isSelected={selectedRole === UserRole.ADMIN} onClick={() => setSelectedRole(UserRole.ADMIN)} isDisabled={false} />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div><input id="email" name="email" type="email" autoComplete="email" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} /></div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon className="h-5 w-5 text-gray-400" /></div><input id="password" name="password" type="password" autoComplete="current-password" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} /></div>
            </div>
             <div className="text-right -mt-2">
              <button type="button" onClick={() => setFlowState('forgotPassword_email')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">Forgot Password?</button>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors">{isLoading ? <Spinner /> : 'Sign In'}</button></div>
          </form>
        );
      case 'otp':
        return (
          <form className="space-y-6" onSubmit={handleOtpVerify}>
            {isAdminFlow && <p className="text-center text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md">Secure channel established. Please verify your identity.</p>}
            <p className="text-center text-gray-600 dark:text-gray-300">An OTP has been sent to {email}. Please check your email.</p>
            <div>
              <label htmlFor="otp" className="sr-only">OTP</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><OtpIcon className="h-5 w-5 text-gray-400" /></div><input id="otp" name="otp" type="text" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="6-Digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={isLoading} maxLength={6} /></div>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 transition-colors">{isLoading ? <Spinner /> : 'Verify OTP'}</button></div>
          </form>
        );
       case 'forgotPassword_email':
        return (
          <form className="space-y-6" onSubmit={handleRequestResetCode}>
            <p className="text-center text-gray-600 dark:text-gray-300">Enter your account email to receive a password reset code.</p>
            <div>
              <label htmlFor="reset-email" className="sr-only">Email</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div><input id="reset-email" name="reset-email" type="email" autoComplete="email" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Email address" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} disabled={isLoading} /></div>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors">{isLoading ? <Spinner /> : 'Send Reset Code'}</button></div>
          </form>
        );
      case 'forgotPassword_verify':
        return (
          <form className="space-y-6" onSubmit={handleVerifyCode}>
             <p className="text-center text-gray-600 dark:text-gray-300">Enter the 6-digit code sent to {resetEmail}.</p>
            <div>
              <label htmlFor="reset-code" className="sr-only">Reset Code</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><OtpIcon className="h-5 w-5 text-gray-400" /></div><input id="reset-code" name="reset-code" type="text" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="6-Digit Code" value={resetCode} onChange={(e) => setResetCode(e.target.value)} disabled={isLoading} maxLength={6} /></div>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 transition-colors">{isLoading ? <Spinner /> : 'Verify Code'}</button></div>
          </form>
        );
      case 'forgotPassword_reset':
        return (
          <form className="space-y-6" onSubmit={handleResetPassword}>
            <p className="text-center text-gray-600 dark:text-gray-300">Create a new password for {resetEmail}.</p>
            <div>
              <label htmlFor="new-password" className="sr-only">New Password</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><KeyIcon className="h-5 w-5 text-gray-400" /></div><input id="new-password" name="new-password" type="password" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} /></div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">Confirm New Password</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><KeyIcon className="h-5 w-5 text-gray-400" /></div><input id="confirm-password" name="confirm-password" type="password" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} /></div>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors">{isLoading ? <Spinner /> : 'Set New Password'}</button></div>
          </form>
        );
      default:
        return (
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">I am a:</p>
              <div className="flex justify-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                  <RoleButton label="Student" isSelected={selectedRole === UserRole.STUDENT} onClick={() => setSelectedRole(UserRole.STUDENT)} isDisabled={false} />
                  <RoleButton label="Teacher" isSelected={selectedRole === UserRole.TEACHER} onClick={() => setSelectedRole(UserRole.TEACHER)} isDisabled={false} />
                  <RoleButton label="Admin" isSelected={selectedRole === UserRole.ADMIN} onClick={() => setSelectedRole(UserRole.ADMIN)} isDisabled={false} />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div><input id="email" name="email" type="email" autoComplete="email" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} /></div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon className="h-5 w-5 text-gray-400" /></div><input id="password" name="password" type="password" autoComplete="current-password" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} /></div>
            </div>
             <div className="text-right -mt-2">
              <button type="button" onClick={() => setFlowState('forgotPassword_email')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">Forgot Password?</button>
            </div>
            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors">{isLoading ? <Spinner /> : 'Sign In'}</button></div>
          </form>
        );
    }
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{getModalTitle()}</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Access your personalized dashboard
          </p>
        </div>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p>{error}</p></div>}
        {successMessage && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p>{successMessage}</p></div>}

        {renderContent()}

        {flowState !== 'login' && !successMessage && (
           <div className="text-center">
                <button onClick={() => { resetFlowState(); setFlowState('login'); }} className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    &larr; Back to Login
                </button>
            </div>
        )}
      </div>
  );
};

export default LoginComponent;