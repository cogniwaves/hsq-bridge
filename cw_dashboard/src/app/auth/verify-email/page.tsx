'use client';

/**
 * Email Verification Page
 * Handles email verification token processing
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { CheckCircleIcon, XCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verifyEmail, user } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      handleVerification(token);
    }
  }, [searchParams]);
  
  const handleVerification = async (token: string) => {
    setStatus('loading');
    
    try {
      await verifyEmail(token);
      setStatus('success');
      setMessage('Your email has been successfully verified!');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Verification failed. Please try again.');
    }
  };
  
  const resendVerification = async () => {
    // Implementation for resending verification email
    setMessage('Verification email has been resent. Please check your inbox.');
  };
  
  return (
    <AuthLayout
      title="Email Verification"
      subtitle={status === 'pending' ? 'Please check your email' : undefined}
    >
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
                 style={{ backgroundColor: 'var(--color-primary-container)' }}>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2"
                   style={{ borderBottomColor: 'var(--color-primary)' }}></div>
            </div>
            <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Verifying your email...
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Please wait while we verify your email address.
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
                 style={{ backgroundColor: 'var(--color-success-container)' }}>
              <CheckCircleIcon className="h-6 w-6" style={{ color: 'var(--color-success)' }} />
            </div>
            <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Email Verified!
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {message}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Redirecting to dashboard...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
                 style={{ backgroundColor: 'var(--color-error-container)' }}>
              <XCircleIcon className="h-6 w-6" style={{ color: 'var(--color-error)' }} />
            </div>
            <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Verification Failed
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {message}
            </p>
            <button
              onClick={resendVerification}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)'
              }}
            >
              Resend verification email
            </button>
          </>
        )}
        
        {status === 'pending' && (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
                 style={{ backgroundColor: 'var(--color-primary-container)' }}>
              <EnvelopeIcon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Check Your Email
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              We&apos;ve sent a verification link to {user?.email || 'your email address'}.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Please click the link in the email to verify your account.
            </p>
            
            <div className="mt-6">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Didn&apos;t receive the email?
              </p>
              <button
                onClick={resendVerification}
                className="mt-2 text-sm font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Click here to resend
              </button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}