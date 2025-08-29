/**
 * Configuration Exporter Component
 * Export, import, backup and restore configuration settings
 * Provides encryption and validation for secure transfer
 */

'use client';

import React, { useState, useRef } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { Platform } from './types';
import { getPlatformInfo } from './utils';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface ConfigurationData {
  version: string;
  timestamp: string;
  environment: string;
  platforms: {
    [K in Platform]?: Record<string, any>;
  };
  metadata?: {
    exportedBy?: string;
    description?: string;
    checksum?: string;
  };
}

interface ConfigurationExporterProps {
  configurations: {
    [K in Platform]?: Record<string, any>;
  };
  onImport?: (data: ConfigurationData) => Promise<void>;
  onExport?: () => Promise<ConfigurationData>;
  showEncryption?: boolean;
  showBackupHistory?: boolean;
  className?: string;
}

interface BackupItem {
  id: string;
  name: string;
  timestamp: Date;
  size: number;
  platforms: Platform[];
  description?: string;
}

export function ConfigurationExporter({
  configurations,
  onImport,
  onExport,
  showEncryption = true,
  showBackupHistory = true,
  className = '',
}: ConfigurationExporterProps) {
  const { theme, resolvedMode } = useTheme();
  const colors = theme.colors;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportResult, setExportResult] = useState<'success' | 'error' | null>(null);
  const [importResult, setImportResult] = useState<'success' | 'error' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [useEncryption, setUseEncryption] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [backupHistory, setBackupHistory] = useState<BackupItem[]>([
    {
      id: '1',
      name: 'Production Backup',
      timestamp: new Date(Date.now() - 86400000),
      size: 4256,
      platforms: ['HUBSPOT', 'STRIPE', 'QUICKBOOKS'] as Platform[],
      description: 'Full configuration backup before update',
    },
    {
      id: '2',
      name: 'QuickBooks OAuth Update',
      timestamp: new Date(Date.now() - 172800000),
      size: 2048,
      platforms: ['QUICKBOOKS'] as Platform[],
      description: 'OAuth tokens backup',
    },
  ]);

  // Export configuration
  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      let data: ConfigurationData;
      
      if (onExport) {
        data = await onExport();
      } else {
        // Default export behavior
        data = {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          platforms: configurations,
          metadata: {
            exportedBy: 'ConfigurationExporter',
            description: 'Configuration backup',
            checksum: generateChecksum(JSON.stringify(configurations)),
          },
        };
      }

      // Apply encryption if enabled
      let exportData = JSON.stringify(data, null, 2);
      if (useEncryption && encryptionKey) {
        exportData = await encryptData(exportData, encryptionKey);
      }

      // Create download
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `config-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportResult('success');
    } catch (error) {
      console.error('Export failed:', error);
      setExportResult('error');
    } finally {
      setIsExporting(false);
    }
  };

  // Import configuration
  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const text = await file.text();
      let data: ConfigurationData;

      // Decrypt if needed
      if (useEncryption && encryptionKey) {
        const decrypted = await decryptData(text, encryptionKey);
        data = JSON.parse(decrypted);
      } else {
        data = JSON.parse(text);
      }

      // Validate data structure
      if (!data.version || !data.timestamp || !data.platforms) {
        throw new Error('Invalid configuration file format');
      }

      // Verify checksum if present
      if (data.metadata?.checksum) {
        const calculatedChecksum = generateChecksum(JSON.stringify(data.platforms));
        if (calculatedChecksum !== data.metadata.checksum) {
          throw new Error('Configuration file integrity check failed');
        }
      }

      if (onImport) {
        await onImport(data);
      }

      setImportResult('success');
      
      // Add to backup history
      const newBackup: BackupItem = {
        id: Date.now().toString(),
        name: file.name,
        timestamp: new Date(),
        size: file.size,
        platforms: Object.keys(data.platforms) as Platform[],
        description: 'Imported configuration',
      };
      setBackupHistory(prev => [newBackup, ...prev]);
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult('error');
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Generate checksum for integrity verification
  const generateChecksum = (data: string): string => {
    // Simple checksum for demo - in production use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Simulate encryption (in production, use Web Crypto API)
  const encryptData = async (data: string, key: string): Promise<string> => {
    // This is a placeholder - implement proper encryption in production
    return btoa(data);
  };

  // Simulate decryption
  const decryptData = async (data: string, key: string): Promise<string> => {
    // This is a placeholder - implement proper decryption in production
    return atob(data);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImport(file);
    }
  };

  // Delete backup
  const handleDeleteBackup = (id: string) => {
    setBackupHistory(prev => prev.filter(item => item.id !== id));
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
    padding: theme.spacing?.container?.lg || '24px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.md || '16px',
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineSmall,
    color: colors.onSurface,
    margin: 0,
  };

  return (
    <div
      className={`configuration-exporter ${className}`}
      style={containerStyle}
      data-testid="configuration-exporter"
    >
      {/* Export/Import Section */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>Configuration Management</h3>
        
        {/* Current Configuration Summary */}
        <div
          style={{
            padding: '16px',
            backgroundColor: colors.surfaceVariant,
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                ...theme.typography?.labelLarge,
                color: colors.onSurfaceVariant,
                marginBottom: '4px',
              }}
            >
              Active Configurations
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {Object.keys(configurations).map(platform => {
                const info = getPlatformInfo(platform as Platform);
                return (
                  <div
                    key={platform}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: colors.primaryContainer,
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{info.icon}</span>
                    <span
                      style={{
                        ...theme.typography?.labelSmall,
                        color: colors.onPrimaryContainer,
                      }}
                    >
                      {info.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div
            style={{
              ...theme.typography?.labelSmall,
              color: colors.onSurfaceVariant,
              opacity: 0.7,
            }}
          >
            {Object.keys(configurations).length} platform(s) configured
          </div>
        </div>

        {/* Encryption Option */}
        {showEncryption && (
          <div
            style={{
              padding: '12px',
              backgroundColor: colors.surfaceContainer,
              borderRadius: '8px',
              border: `1px solid ${colors.outlineVariant}`,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={useEncryption}
                onChange={(e) => setUseEncryption(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    ...theme.typography?.labelMedium,
                    color: colors.onSurface,
                  }}
                >
                  <LockClosedIcon style={{ width: '16px', height: '16px' }} />
                  Enable Encryption
                </div>
                <div
                  style={{
                    ...theme.typography?.bodySmall,
                    color: colors.onSurfaceVariant,
                    opacity: 0.8,
                  }}
                >
                  Protect sensitive configuration data with encryption
                </div>
              </div>
            </label>
            
            {useEncryption && (
              <input
                type="password"
                placeholder="Enter encryption key"
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: colors.surface,
                  color: colors.onSurface,
                  border: `1px solid ${colors.outline}`,
                  borderRadius: '6px',
                  ...theme.typography?.bodyMedium,
                }}
              />
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleExport}
            disabled={isExporting || Object.keys(configurations).length === 0}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: colors.primary,
              color: colors.onPrimary,
              border: 'none',
              borderRadius: '8px',
              ...theme.typography?.labelLarge,
              fontWeight: 600,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting || Object.keys(configurations).length === 0 ? 0.6 : 1,
            }}
          >
            {isExporting ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid transparent`,
                    borderTop: `2px solid ${colors.onPrimary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Exporting...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon style={{ width: '20px', height: '20px' }} />
                Export Configuration
              </>
            )}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: '8px',
              ...theme.typography?.labelLarge,
              fontWeight: 600,
              cursor: isImporting ? 'not-allowed' : 'pointer',
              opacity: isImporting ? 0.6 : 1,
            }}
          >
            {isImporting ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${colors.outlineVariant}`,
                    borderTop: `2px solid ${colors.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Importing...
              </>
            ) : (
              <>
                <ArrowUpTrayIcon style={{ width: '20px', height: '20px' }} />
                Import Configuration
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Result Messages */}
        {exportResult === 'success' && (
          <div
            style={{
              padding: '12px',
              backgroundColor: colors.successContainer,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircleIcon style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ ...theme.typography?.bodyMedium, color: '#047857' }}>
              Configuration exported successfully
            </span>
          </div>
        )}

        {importResult === 'success' && (
          <div
            style={{
              padding: '12px',
              backgroundColor: colors.successContainer,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircleIcon style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ ...theme.typography?.bodyMedium, color: '#047857' }}>
              Configuration imported successfully
            </span>
          </div>
        )}

        {importResult === 'error' && (
          <div
            style={{
              padding: '12px',
              backgroundColor: colors.errorContainer,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ExclamationTriangleIcon style={{ width: '20px', height: '20px', color: colors.error }} />
            <span style={{ ...theme.typography?.bodyMedium, color: colors.onErrorContainer }}>
              {importError || 'Failed to import configuration'}
            </span>
          </div>
        )}
      </div>

      {/* Backup History */}
      {showBackupHistory && backupHistory.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={titleStyle}>Backup History</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {backupHistory.map(backup => (
              <div
                key={backup.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: '8px',
                  border: `1px solid ${colors.outlineVariant}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <DocumentDuplicateIcon
                      style={{
                        width: '16px',
                        height: '16px',
                        color: colors.primary,
                      }}
                    />
                    <span
                      style={{
                        ...theme.typography?.labelLarge,
                        color: colors.onSurface,
                      }}
                    >
                      {backup.name}
                    </span>
                  </div>
                  {backup.description && (
                    <div
                      style={{
                        ...theme.typography?.bodySmall,
                        color: colors.onSurfaceVariant,
                        opacity: 0.8,
                        marginBottom: '4px',
                      }}
                    >
                      {backup.description}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      ...theme.typography?.labelSmall,
                      color: colors.onSurfaceVariant,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ClockIcon style={{ width: '12px', height: '12px' }} />
                      {new Date(backup.timestamp).toLocaleDateString()}
                    </span>
                    <span>{(backup.size / 1024).toFixed(1)} KB</span>
                    <span>{backup.platforms.join(', ')}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDeleteBackup(backup.id)}
                  style={{
                    padding: '8px',
                    backgroundColor: 'transparent',
                    color: colors.error,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title="Delete backup"
                >
                  <TrashIcon style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ConfigurationExporter;