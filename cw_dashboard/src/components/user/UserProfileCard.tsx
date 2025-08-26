'use client';

/**
 * User Profile Card Component
 * Displays and allows editing of user profile information with accessibility support
 */

import { useState, useRef, ChangeEvent } from 'react';
import { 
  UserIcon, 
  PencilIcon, 
  CameraIcon,
  CheckIcon,
  XMarkIcon,
  EnvelopeIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { UserProfileCardProps } from '../../types/components';

export function UserProfileCard({
  user,
  editable = true,
  onEdit,
  onChangePassword,
  onChangeAvatar,
  showMemberships = false,
  compact = false,
  testId = 'user-profile-card',
  className = '',
  ...props
}: UserProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar file selection
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onChangeAvatar) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      await onChangeAvatar(file);
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle edit save
  const handleSave = async () => {
    if (!onEdit) return;

    try {
      await onEdit({
        firstName: editedUser.firstName,
        lastName: editedUser.lastName
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Failed to update profile');
    }
  };

  // Handle edit cancel
  const handleCancel = () => {
    setEditedUser({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
    setIsEditing(false);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-4 p-4 rounded-lg transition-colors duration-200 ${className}`}
        style={{ backgroundColor: 'var(--color-surface)' }}
        data-testid={testId}
        {...props}
      >
        {/* Avatar */}
        <div className="relative">
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={`${user.firstName} ${user.lastName}`}
              className="h-12 w-12 rounded-full object-cover"
              style={{ borderColor: 'var(--color-outline)' }}
            />
          ) : (
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary-container)' }}
            >
              <UserIcon 
                className="h-6 w-6" 
                style={{ color: 'var(--color-on-primary-container)' }}
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p 
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {user.firstName} {user.lastName}
          </p>
          <p 
            className="text-xs truncate"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {user.email}
          </p>
        </div>

        {/* Verified badge */}
        {user.emailVerified && (
          <ShieldCheckIcon 
            className="h-5 w-5 flex-shrink-0"
            style={{ color: 'var(--color-success)' }}
            aria-label="Email verified"
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`rounded-lg shadow-sm transition-colors duration-200 ${className}`}
      style={{ 
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-outline)'
      }}
      data-testid={testId}
      {...props}
    >
      {/* Header with avatar */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--color-outline)' }}>
        <div className="flex items-start gap-6">
          {/* Avatar with upload */}
          <div className="relative group">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="h-24 w-24 rounded-full object-cover border-2"
                style={{ borderColor: 'var(--color-outline)' }}
              />
            ) : (
              <div 
                className="h-24 w-24 rounded-full flex items-center justify-center border-2"
                style={{ 
                  backgroundColor: 'var(--color-primary-container)',
                  borderColor: 'var(--color-outline)'
                }}
              >
                <UserIcon 
                  className="h-12 w-12" 
                  style={{ color: 'var(--color-on-primary-container)' }}
                  aria-hidden="true"
                />
              </div>
            )}
            
            {editable && onChangeAvatar && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                  aria-label="Change profile picture"
                >
                  <CameraIcon className="h-8 w-8 text-white" aria-hidden="true" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                  aria-label="Upload profile picture"
                />
              </>
            )}

            {isUploading && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>

          {/* User info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label 
                      htmlFor="edit-firstName"
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      First Name
                    </label>
                    <input
                      id="edit-firstName"
                      type="text"
                      value={editedUser.firstName}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label 
                      htmlFor="edit-lastName"
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Last Name
                    </label>
                    <input
                      id="edit-lastName"
                      type="text"
                      value={editedUser.lastName}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)'
                    }}
                  >
                    <CheckIcon className="h-4 w-4 inline mr-1" aria-hidden="true" />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-surface-variant)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <XMarkIcon className="h-4 w-4 inline mr-1" aria-hidden="true" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <h2 
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {user.firstName} {user.lastName}
                  </h2>
                  {user.emailVerified && (
                    <div className="flex items-center gap-1">
                      <ShieldCheckIcon 
                        className="h-5 w-5"
                        style={{ color: 'var(--color-success)' }}
                        aria-label="Verified account"
                      />
                      <span 
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-success)' }}
                      >
                        Verified
                      </span>
                    </div>
                  )}
                </div>
                <p 
                  className="text-sm mb-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {user.fullName || `${user.firstName} ${user.lastName}`}
                </p>
                {editable && onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-surface-variant)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <PencilIcon className="h-4 w-4 inline mr-1" aria-hidden="true" />
                    Edit Profile
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-4">
        {/* Email */}
        <div className="flex items-center gap-3">
          <EnvelopeIcon 
            className="h-5 w-5 flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          />
          <div className="flex-1">
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Email Address
            </p>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {user.email}
              {!user.emailVerified && (
                <span 
                  className="ml-2 text-xs"
                  style={{ color: 'var(--color-warning)' }}
                >
                  (Unverified)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Member since */}
        <div className="flex items-center gap-3">
          <CalendarIcon 
            className="h-5 w-5 flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          />
          <div className="flex-1">
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Member Since
            </p>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-3">
          <CalendarIcon 
            className="h-5 w-5 flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          />
          <div className="flex-1">
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Last Updated
            </p>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatDate(user.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {editable && onChangePassword && (
        <div 
          className="px-6 py-4 border-t"
          style={{ 
            backgroundColor: 'var(--color-surface-variant)',
            borderColor: 'var(--color-outline)'
          }}
        >
          <button
            onClick={onChangePassword}
            className="w-full px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            Change Password
          </button>
        </div>
      )}
    </div>
  );
}