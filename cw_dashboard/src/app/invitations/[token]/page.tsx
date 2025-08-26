'use client';

/**
 * Accept Invitation Page
 * Allows users to accept tenant invitations
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi } from '../../../utils/auth';
import { InvitationData } from '../../../types/auth';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams();
  
  const token = params.token as string;
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation token');
      setIsLoading(false);
      return;
    }

    // Fetch invitation details
    const fetchInvitation = async () => {
      try {
        const response = await authApi.get(`/invitations/${token}`);
        if (response.data.success && response.data.data) {
          setInvitation(response.data.data);
          // Check if user needs to create a password based on invitation data
          setNeedsPassword(response.data.data.requiresPassword || false);
        } else {
          throw new Error(response.data.error || 'Invalid invitation');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load invitation');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (needsPassword) {
      // Validate passwords match
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Validate password strength
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }

    setIsAccepting(true);

    try {
      const payload: any = { token };
      if (needsPassword) {
        payload.password = password;
      }
      
      const response = await authApi.post('/invitations/accept', payload);
      if (response.data.success) {
        setSuccess(true);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        throw new Error(response.data.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthLayout
        title="Loading Invitation"
        subtitle="Please wait..."
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
        title="Invitation Accepted"
        subtitle="Welcome to the team!"
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
                You've successfully joined {invitation?.tenant.name}
              </p>
              <p className="mt-2 text-sm text-green-700">
                Redirecting to dashboard...
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!invitation) {
    return (
      <AuthLayout
        title="Invalid Invitation"
        subtitle="This invitation is not valid"
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
                {error || 'Invalid invitation'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <Link
            href="/auth/signin"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Accept Invitation"
      subtitle={`You've been invited to join ${invitation.tenant.name}`}
    >
      <form className="space-y-6" onSubmit={handleAccept}>
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Invitation Details</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>Organization: {invitation.tenant.name}</p>
                <p>Role: {invitation.role}</p>
                <p>Invited by: {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {needsPassword && (
          <>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Create Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter password"
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Confirm password"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isAccepting}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAccepting ? 'Accepting...' : 'Accept Invitation'}
          </button>
          
          <Link
            href="/auth/signin"
            className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}