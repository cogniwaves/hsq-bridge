'use client';

/**
 * Email Verification Page
 * Verifies user email using token from URL
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi } from '../../../utils/auth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const token = searchParams.get('token') || '';
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token');
      setIsVerifying(false);
      return;
    }

    // Auto-verify on mount
    const verify = async () => {
      try {
        const response = await authApi.post('/auth/verify-email', { token });
        if (response.data.success) {
          setSuccess(true);
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          throw new Error(response.data.error || 'Failed to verify email');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to verify email');
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [token, router]);

  if (isVerifying) {
    return (
      <AuthLayout
        title="Verifying Email"
        subtitle="Please wait while we verify your email address"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        title="Email Verified"
        subtitle="Your email has been successfully verified"
      >
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Email verification successful
              </p>
              <p className="mt-2 text-sm text-green-700">
                You will be redirected to the dashboard in a moment...
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Go to dashboard now
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verification Failed"
      subtitle="We couldn't verify your email address"
    >
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-red-800">
              {error || 'Verification failed'}
            </p>
            <p className="mt-2 text-sm text-red-700">
              The verification link may be expired or invalid. Please request a new verification email.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Link
          href="/auth/resend-verification"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Resend Verification Email
        </Link>
        
        <Link
          href="/auth/signin"
          className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}