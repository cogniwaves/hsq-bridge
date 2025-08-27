/**
 * Enhanced User Profile Hook
 * Avatar management, preferences, and advanced user profile features
 * with Userfront integration and persistent settings
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// User profile data interface
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: string;
  status?: 'online' | 'offline' | 'busy' | 'available';
  timezone?: string;
  lastSeen?: Date;
  preferences: UserPreferences;
  metadata?: Record<string, any>;
}

// User preferences interface
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  navigationMode: 'auto' | 'rail' | 'drawer';
  notifications: {
    desktop: boolean;
    email: boolean;
    push: boolean;
    sound: boolean;
    badges: boolean;
  };
  privacy: {
    showStatus: boolean;
    showActivity: boolean;
    allowDirectMessages: boolean;
  };
  accessibility: {
    reduceMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
  };
  dashboard: {
    defaultView: string;
    compactMode: boolean;
    showTips: boolean;
    refreshInterval: number;
  };
}

// Avatar upload options
export interface AvatarUploadOptions {
  maxFileSize?: number; // in bytes
  allowedFormats?: string[];
  quality?: number; // 0-1 for compression
  maxDimensions?: { width: number; height: number };
}

// Recent activity item
export interface ActivityItem {
  id: string;
  type: 'login' | 'logout' | 'action' | 'view' | 'edit' | 'create' | 'delete';
  timestamp: Date;
  description: string;
  metadata?: Record<string, any>;
}

// Hook options
export interface UseUserProfileOptions {
  /** Enable avatar upload functionality */
  enableAvatarUpload?: boolean;
  /** Avatar upload configuration */
  avatarUploadOptions?: AvatarUploadOptions;
  /** Enable activity tracking */
  trackActivity?: boolean;
  /** Maximum activity items to store */
  maxActivityItems?: number;
  /** Enable preference persistence */
  persistPreferences?: boolean;
  /** Auto-save preferences delay in ms */
  autoSaveDelay?: number;
}

// Hook return interface
export interface UseUserProfileReturn {
  /** Current user profile */
  profile: UserProfile | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Recent activity */
  recentActivity: ActivityItem[];
  
  /** Update profile data */
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Update user preferences */
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  /** Upload new avatar */
  uploadAvatar: (file: File) => Promise<string>;
  /** Remove current avatar */
  removeAvatar: () => Promise<void>;
  /** Generate avatar from initials */
  generateInitialsAvatar: () => string;
  /** Set user status */
  setStatus: (status: UserProfile['status']) => Promise<void>;
  /** Add activity item */
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  /** Clear activity history */
  clearActivity: () => void;
  /** Reset preferences to defaults */
  resetPreferences: () => Promise<void>;
  /** Export user data */
  exportUserData: () => object;
  /** Check if user has specific permission */
  hasPermission: (permission: string) => boolean;
  
  // UI helpers
  /** Get avatar URL or fallback */
  getAvatarUrl: () => string;
  /** Get display name */
  getDisplayName: () => string;
  /** Get user initials */
  getUserInitials: () => string;
  /** Get status indicator props */
  getStatusProps: () => {
    className: string;
    title: string;
    'aria-label': string;
  };
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  navigationMode: 'auto',
  notifications: {
    desktop: true,
    email: true,
    push: false,
    sound: true,
    badges: true,
  },
  privacy: {
    showStatus: true,
    showActivity: true,
    allowDirectMessages: true,
  },
  accessibility: {
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
  },
  dashboard: {
    defaultView: 'overview',
    compactMode: false,
    showTips: true,
    refreshInterval: 30000,
  },
};

// Default avatar upload options
const DEFAULT_AVATAR_OPTIONS: Required<AvatarUploadOptions> = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  quality: 0.85,
  maxDimensions: { width: 400, height: 400 },
};

/**
 * Generate initials from name
 */
function generateInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Create initials avatar SVG
 */
function createInitialsAvatar(initials: string, size: number = 128): string {
  const colors = [
    '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3',
    '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF', '#7B68EE', '#FF6347'
  ];
  
  const colorIndex = initials.charCodeAt(0) % colors.length;
  const backgroundColor = colors[colorIndex];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${backgroundColor}"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="system-ui, -apple-system, sans-serif" 
            font-size="${size * 0.4}" font-weight="600" fill="white">${initials}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Compress and resize image
 */
async function processImage(
  file: File,
  options: Required<AvatarUploadOptions>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        const { width, height } = options.maxDimensions;
        
        // Calculate resize dimensions maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        let newWidth = width;
        let newHeight = height;
        
        if (aspectRatio > 1) {
          newHeight = width / aspectRatio;
        } else {
          newWidth = height * aspectRatio;
        }
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Draw and compress image
        ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to process image'));
              return;
            }
            
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read processed image'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          options.quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Enhanced user profile management hook
 */
export function useUserProfile({
  enableAvatarUpload = true,
  avatarUploadOptions = {},
  trackActivity = true,
  maxActivityItems = 50,
  persistPreferences = true,
  autoSaveDelay = 1000,
}: UseUserProfileOptions = {}): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  
  const avatarOptions = { ...DEFAULT_AVATAR_OPTIONS, ...avatarUploadOptions };

  // Load initial profile and preferences
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        
        // This would typically come from Userfront or your auth system
        // For now, we'll create a mock profile
        const mockProfile: UserProfile = {
          id: 'user_123',
          email: 'user@hsqbridge.com',
          name: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Admin',
          status: 'online',
          preferences: DEFAULT_PREFERENCES,
        };
        
        // Load persisted preferences
        if (persistPreferences && typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem('hsq-bridge-user-preferences');
            if (saved) {
              const preferences = JSON.parse(saved);
              mockProfile.preferences = { ...DEFAULT_PREFERENCES, ...preferences };
            }
          } catch (err) {
            console.warn('Failed to load saved preferences:', err);
          }
        }
        
        setProfile(mockProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [persistPreferences]);

  // Load activity history
  useEffect(() => {
    if (!trackActivity || typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('hsq-bridge-user-activity');
      if (saved) {
        const activity = JSON.parse(saved).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        setRecentActivity(activity.slice(0, maxActivityItems));
      }
    } catch (err) {
      console.warn('Failed to load activity history:', err);
    }
  }, [trackActivity, maxActivityItems]);

  // Save preferences with debouncing
  const savePreferences = useCallback(
    async (preferences: UserPreferences) => {
      if (!persistPreferences || typeof window === 'undefined') return;
      
      try {
        localStorage.setItem('hsq-bridge-user-preferences', JSON.stringify(preferences));
      } catch (err) {
        console.warn('Failed to save preferences:', err);
      }
    },
    [persistPreferences]
  );

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    
    try {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      
      // Add activity
      if (trackActivity) {
        addActivity({
          type: 'edit',
          description: 'Updated profile information',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  }, [profile, trackActivity]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!profile) return;
    
    const updatedPreferences = { ...profile.preferences, ...updates };
    setProfile(prev => prev ? { ...prev, preferences: updatedPreferences } : null);
    
    // Save preferences
    await savePreferences(updatedPreferences);
    
    // Add activity
    if (trackActivity) {
      addActivity({
        type: 'edit',
        description: 'Updated preferences',
      });
    }
  }, [profile, savePreferences, trackActivity]);

  // Upload avatar
  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    if (!enableAvatarUpload || !profile) {
      throw new Error('Avatar upload not enabled');
    }
    
    // Validate file
    if (file.size > avatarOptions.maxFileSize) {
      throw new Error(`File size exceeds ${avatarOptions.maxFileSize / (1024 * 1024)}MB limit`);
    }
    
    if (!avatarOptions.allowedFormats.includes(file.type)) {
      throw new Error(`File format not supported. Allowed: ${avatarOptions.allowedFormats.join(', ')}`);
    }
    
    try {
      // Process image
      const processedImage = await processImage(file, avatarOptions);
      
      // Update profile
      setProfile(prev => prev ? { ...prev, avatar: processedImage } : null);
      
      // Add activity
      if (trackActivity) {
        addActivity({
          type: 'edit',
          description: 'Updated avatar',
        });
      }
      
      return processedImage;
    } catch (err) {
      throw new Error(`Failed to upload avatar: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [enableAvatarUpload, profile, avatarOptions, trackActivity]);

  // Remove avatar
  const removeAvatar = useCallback(async () => {
    if (!profile) return;
    
    setProfile(prev => prev ? { ...prev, avatar: undefined } : null);
    
    if (trackActivity) {
      addActivity({
        type: 'delete',
        description: 'Removed avatar',
      });
    }
  }, [profile, trackActivity]);

  // Generate initials avatar
  const generateInitialsAvatar = useCallback((): string => {
    if (!profile) return '';
    
    const initials = getUserInitials();
    return createInitialsAvatar(initials);
  }, [profile]);

  // Set user status
  const setStatus = useCallback(async (status: UserProfile['status']) => {
    if (!profile) return;
    
    setProfile(prev => prev ? { ...prev, status } : null);
    
    if (trackActivity) {
      addActivity({
        type: 'action',
        description: `Changed status to ${status}`,
      });
    }
  }, [profile, trackActivity]);

  // Add activity
  const addActivity = useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    if (!trackActivity) return;
    
    const newActivity: ActivityItem = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    setRecentActivity(prev => {
      const updated = [newActivity, ...prev].slice(0, maxActivityItems);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('hsq-bridge-user-activity', JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save activity:', err);
        }
      }
      
      return updated;
    });
  }, [trackActivity, maxActivityItems]);

  // Clear activity
  const clearActivity = useCallback(() => {
    setRecentActivity([]);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hsq-bridge-user-activity');
    }
  }, []);

  // Reset preferences
  const resetPreferences = useCallback(async () => {
    if (!profile) return;
    
    setProfile(prev => prev ? { ...prev, preferences: DEFAULT_PREFERENCES } : null);
    
    await savePreferences(DEFAULT_PREFERENCES);
    
    if (trackActivity) {
      addActivity({
        type: 'action',
        description: 'Reset preferences to defaults',
      });
    }
  }, [profile, savePreferences, trackActivity]);

  // Export user data
  const exportUserData = useCallback(() => {
    return {
      profile,
      recentActivity,
      exportedAt: new Date().toISOString(),
    };
  }, [profile, recentActivity]);

  // Check permission
  const hasPermission = useCallback((permission: string) => {
    // This would integrate with your permission system
    // For now, return true for admin users
    return profile?.role === 'Admin';
  }, [profile]);

  // UI Helpers
  const getAvatarUrl = useCallback(() => {
    if (profile?.avatar) return profile.avatar;
    return generateInitialsAvatar();
  }, [profile?.avatar, generateInitialsAvatar]);

  const getDisplayName = useCallback(() => {
    if (!profile) return '';
    return profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email;
  }, [profile]);

  const getUserInitials = useCallback(() => {
    if (!profile) return '';
    const displayName = getDisplayName();
    return generateInitials(displayName);
  }, [profile, getDisplayName]);

  const getStatusProps = useCallback(() => {
    const status = profile?.status || 'offline';
    return {
      className: `user-status user-status--${status}`,
      title: status.charAt(0).toUpperCase() + status.slice(1),
      'aria-label': `User status: ${status}`,
    };
  }, [profile?.status]);

  return {
    profile,
    isLoading,
    error,
    recentActivity,
    updateProfile,
    updatePreferences,
    uploadAvatar,
    removeAvatar,
    generateInitialsAvatar,
    setStatus,
    addActivity,
    clearActivity,
    resetPreferences,
    exportUserData,
    hasPermission,
    getAvatarUrl,
    getDisplayName,
    getUserInitials,
    getStatusProps,
  };
}

export default useUserProfile;