'use client';

/**
 * Accept Invitation Page
 * Public page for users to accept tenant invitations
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi, validators } from '../../../utils/auth';
import { InvitationData } from '../../../types/auth';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requiresPassword, setRequiresPassword] = useState(false);
  
  useEffect(() => {
    if (token) {
      fetchInvitationDetails();
    }
  }, [token]);
  
  const fetchInvitationDetails = async () => {
    try {
      const response = await authApi.get(`/invitations/validate/${token}`);
      
      if (response.data.success && response.data.data) {
        setInvitation(response.data.data.invitation);
        setRequiresPassword(response.data.data.requiresPassword);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired invitation');
    } finally {
      setIsLoading(false);
    }
  };
  
  const validateForm = (): boolean => {
    if (!requiresPassword) return true;
    
    const errors: Record<string, string> = {};
    
    const passwordError = validators.password(password);
    if (passwordError) errors.password = passwordError;
    
    const confirmError = validators.confirmPassword(password, confirmPassword);
    if (confirmError) errors.confirmPassword = confirmError;
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleAcceptInvitation = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const payload: any = { token };
      if (requiresPassword) {
        payload.password = password;
      }
      
      const response = await authApi.post('/invitations/accept', payload);
      
      if (response.data.success) {
        // Redirect to dashboard after successful acceptance
        router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <AuthLayout title="Loading invitation..." subtitle="">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2"
               style={{ borderBottomColor: 'var(--color-primary)' }}></div>
        </div>
      </AuthLayout>
    );
  }
  
  if (error && !invitation) {
    return (
      <AuthLayout title="Invalid Invitation" subtitle="">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
               style={{ backgroundColor: 'var(--color-error-container)' }}>
            <svg className="h-6 w-6" style={{ color: 'var(--color-error)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {error}
          </h3>
          
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            This invitation link may be invalid or expired. Please contact the person who invited you for a new invitation.
          </p>
          
          <button
            onClick={() => router.push('/auth/signin')}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            Go to Sign In
          </button>
        </div>
      </AuthLayout>
    );
  }
  
  return (
    <AuthLayout 
      title="Join Organization"
      subtitle={`You've been invited to join ${invitation?.tenant.name}`}
    >
      <div className="space-y-6">
        {/* Invitation Details */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface-variant)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Invitation Details
          </h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Organization:
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {invitation?.tenant.name}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Role:
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {invitation?.role}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Invited by:
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {invitation?.invitedBy.firstName} {invitation?.invitedBy.lastName}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Email:
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {invitation?.email}
              </span>
            </div>
          </div>
        </div>
        
        {/* Password fields for new users */}
        {requiresPassword && (
          <>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-primary-container)' }}>
              <p className="text-sm" style={{ color: 'var(--color-on-primary-container)' }}>
                It looks like you&apos;re new here! Please create a password for your account.
              </p>
            </div>
            
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: fieldErrors.password ? 'var(--color-error)' : 'var(--color-outline)',
                    color: 'var(--color-text-primary)'
                  }}
                  placeholder="Create a password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                  ) : (
                    <EyeIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                  )}
                </button>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: fieldErrors.confirmPassword ? 'var(--color-error)' : 'var(--color-outline)',
                    color: 'var(--color-text-primary)'
                  }}
                  placeholder="Confirm your password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                  ) : (
                    <EyeIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                  )}
                </button>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Error message */}
        {error && (
          <div 
            className="rounded-md p-4 transition-colors duration-200"
            style={{ 
              backgroundColor: 'var(--color-error-container)',
              color: 'var(--color-on-error-container)'
            }}
          >
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAcceptInvitation}
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            style={{
              backgroundColor: isSubmitting ? 'var(--color-surface-variant)' : 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Accepting invitation...
              </span>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Accept Invitation
              </>
            )}
          </button>
          
          <button
            onClick={() => router.push('/auth/signin')}
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            style={{
              borderColor: 'var(--color-outline)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'transparent'
            }}
          >
            Sign in instead
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}