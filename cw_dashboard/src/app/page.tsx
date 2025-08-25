'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, CurrencyDollarIcon, DocumentTextIcon, ExclamationTriangleIcon, ClockIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface DashboardData {
  totals: {
    invoices: number;
    payments: number;
    pendingSyncs: number;
    recentErrors: number;
  };
  invoicesByStatus: Record<string, number>;
  paymentsByStatus: Record<string, number>;
}

interface InvoiceQueueItem {
  id: string;
  clientName: string;        // Company name (primary)
  contactName?: string;      // Contact name (secondary)
  clientEmail?: string;      // Contact email
  totalAmount: number;
  currency?: string;
  status: string;
  createdAt: string;
  hubspotInvoiceId?: string;
  quickbooksInvoiceId?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
}

interface ComprehensiveSyncStatus {
  overall: 'synced' | 'invoices_need_sync' | 'pending_review' | 'approved_pending_transfer';
  message: string;
  invoice_sync: {
    invoices_without_qb_ids: number;
    status: 'pending' | 'complete';
  };
  transfer_queue: {
    total_items: number;
    pending_review: number;
    approved: number;
    rejected: number;
    transferred: number;
    failed: number;
    by_entity: {
      invoices: number;
      line_items: number;
      contacts: number;
      companies: number;
    };
  };
}

interface InvoiceDetails {
  id: string;
  hubspotInvoiceId?: string;
  hubspotDealId?: string;
  totalAmount: number;
  currency: string;
  status: string;
  company?: {
    name: string;
    domain?: string;
  };
  contact?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  dueDate?: string;
  issueDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  hubspotCreatedAt?: string;
  hubspotModifiedAt?: string;
  quickbooksInvoiceId?: string;
  lastSyncAt?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  lineItems?: {
    id: string;
    hubspotLineItemId?: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    currency: string;
    taxAmount: number;
    taxRate: number;
    taxLabel?: string;
    taxCategory?: string;
    postTaxAmount: number;
    discountAmount: number;
    discountPercentage: number;
  }[];
  taxSummary?: {
    subtotalBeforeTax: number;
    totalTaxAmount: number;
    totalAfterTax: number;
    taxBreakdown?: any;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  uptime: number;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [invoiceQueue, setInvoiceQueue] = useState<InvoiceQueueItem[]>([]);
  const [comprehensiveSyncStatus, setComprehensiveSyncStatus] = useState<ComprehensiveSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState<Set<string>>(new Set());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchHealthStatus();
    fetchInvoiceQueue();
    
    // Disable automatic refresh to prevent rate limiting issues
    // Users can use the manual refresh button instead
    /* const interval = setInterval(() => {
      fetchDashboardData();
      fetchHealthStatus();
      fetchInvoiceQueue();
    }, 120000); */

    // return () => clearInterval(interval);
  }, []);

  // API URL helper
  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
  };

  // Authentication helper
  const getAuthHeaders = () => {
    return {
      'Authorization': 'Basic ' + btoa('admin:admin123'),
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/dashboard/overview`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/health`);
      if (!response.ok) throw new Error('Failed to fetch health status');
      const data = await response.json();
      setHealthStatus(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const fetchComprehensiveSyncStatus = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/invoices/sync-status/comprehensive`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.syncStatus) {
          setComprehensiveSyncStatus(data.syncStatus);
        }
      }
    } catch (err) {
      console.warn('Could not fetch comprehensive sync status:', err);
    }
  };

  const processTransferQueueChanges = async () => {
    setQueueLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/quickbooks/queue/process-changes`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Refresh the sync status after processing
        await fetchComprehensiveSyncStatus();
        console.log('Transfer queue changes processed successfully');
      } else {
        console.warn('Failed to process transfer queue changes:', response.status);
      }
    } catch (err) {
      console.error('Error processing transfer queue changes:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchInvoiceQueue = async () => {
    setQueueLoading(true);
    try {
      // Fetch both invoice queue and comprehensive sync status
      await Promise.all([
        fetchComprehensiveSyncStatus(),
        (async () => {
          try {
            // Get invoices that need QuickBooks sync
            const response = await fetch(`${getApiUrl()}/api/invoices/queue/quickbooks?limit=50`, {
              headers: getAuthHeaders()
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.invoices) {
                setInvoiceQueue(data.invoices);
              }
            } else {
              console.warn('Could not fetch invoice queue - response not ok:', response.status);
              // Fallback: show some sample data to demonstrate the interface
              setInvoiceQueue([
                {
                  id: '1',
                  clientName: 'Sample Client A',
                  totalAmount: 1250.00,
                  status: 'PAID',
                  createdAt: new Date().toISOString(),
                  hubspotInvoiceId: 'hs_inv_123'
                },
                {
                  id: '2', 
                  clientName: 'Sample Client B',
                  totalAmount: 850.50,
                  status: 'SENT',
                  createdAt: new Date(Date.now() - 86400000).toISOString(),
                  hubspotInvoiceId: 'hs_inv_124'
                }
              ]);
            }
          } catch (err) {
            console.warn('Could not fetch invoice queue:', err);
            setInvoiceQueue([]);
          }
        })()
      ]);
    } catch (err) {
      console.warn('Error during queue fetch:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'healthy': 
        return { 
          color: 'var(--color-success)', 
          backgroundColor: 'var(--color-success-container)',
          borderColor: 'var(--color-success)'
        };
      case 'degraded': 
        return { 
          color: 'var(--color-warning)', 
          backgroundColor: 'var(--color-warning-container)',
          borderColor: 'var(--color-warning)'
        };
      case 'unhealthy': 
        return { 
          color: 'var(--color-error)', 
          backgroundColor: 'var(--color-error-container)',
          borderColor: 'var(--color-error)'
        };
      default: 
        return { 
          color: 'var(--color-text-secondary)', 
          backgroundColor: 'var(--color-surface-variant)',
          borderColor: 'var(--color-outline)'
        };
    }
  };

  const fetchInvoiceDetails = async (invoiceId: string) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/invoices/${invoiceId}/details`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvoiceDetails(data.invoice);
        }
      }
    } catch (err) {
      console.warn('Could not fetch invoice details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInvoiceClick = async (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setShowModal(true);
    await fetchInvoiceDetails(invoiceId);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInvoice(null);
    setInvoiceDetails(null);
  };

  const handleSync = async (invoiceId: string) => {
    setSyncingInvoices(prev => new Set(prev).add(invoiceId));
    
    try {
      const response = await fetch(`${getApiUrl()}/api/invoices/${invoiceId}/sync`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update the invoice in the queue to mark it as synced
          setInvoiceQueue(prev => prev.map(invoice => 
            invoice.id === invoiceId 
              ? { ...invoice, syncStatus: 'synced' as const, quickbooksInvoiceId: data.quickbooksInvoiceId }
              : invoice
          ));
          
          // Show success notification
          console.log(`Invoice ${invoiceId} synced successfully`);
        }
      } else {
        // Handle sync failure
        const errorData = await response.json();
        console.error('Sync failed:', errorData.error);
        
        // Set specific error message for QuickBooks connection issues
        if (errorData.details && errorData.details.includes('QuickBooks customer')) {
          setSyncError('QuickBooks connection failed. The access token may have expired. Please reauthorize QuickBooks integration.');
        } else {
          setSyncError(`Sync failed: ${errorData.error || 'Unknown error'}`);
        }
        
        setInvoiceQueue(prev => prev.map(invoice => 
          invoice.id === invoiceId 
            ? { ...invoice, syncStatus: 'failed' as const }
            : invoice
        ));
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncError('Network error occurred during sync. Please check your connection and try again.');
      setInvoiceQueue(prev => prev.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, syncStatus: 'failed' as const }
          : invoice
      ));
    } finally {
      setSyncingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleRefreshQueue = async () => {
    setExtracting(true);
    setQueueLoading(true);
    
    try {
      // First, extract any new invoices from HubSpot
      console.log('Extracting new invoices from HubSpot...');
      const extractResponse = await fetch(`${getApiUrl()}/api/extract/hubspot-invoices-enhanced`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        console.log('Extraction completed:', extractData.data);
        
        // Show user feedback about extraction results
        if (extractData.data && extractData.data.newInvoices > 0) {
          console.log(`✅ Found ${extractData.data.newInvoices} new invoices from HubSpot`);
        }
      } else {
        console.warn('Invoice extraction failed, proceeding with database refresh');
      }
      
    } catch (error) {
      console.error('Error during extraction:', error);
    } finally {
      setExtracting(false);
    }
    
    // Then refresh the queue from database
    try {
      await fetchInvoiceQueue();
    } catch (error) {
      console.error('Error refreshing queue:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderBottomColor: 'var(--color-primary)' }}
        ></div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="border rounded-md p-4 transition-colors duration-200"
        style={{ 
          backgroundColor: 'var(--color-error-container)',
          borderColor: 'var(--color-error)',
          color: 'var(--color-on-error-container)'
        }}
      >
        <div className="flex">
          <ExclamationTriangleIcon 
            className="h-5 w-5"
            style={{ color: 'var(--color-error)' }}
          />
          <div className="ml-3">
            <h3 
              className="text-sm font-medium"
              style={{ color: 'var(--color-error)' }}
            >
              Error loading dashboard
            </h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 
            className="text-2xl font-bold leading-7 sm:text-3xl sm:truncate transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Dashboard Overview
          </h2>
          <p 
            className="mt-1 text-sm transition-colors duration-200"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Real-time synchronization status between HubSpot, Stripe, and QuickBooks
          </p>
        </div>
        {healthStatus && (
          <div className="mt-4 md:mt-0 md:ml-4">
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
              style={getStatusStyle(healthStatus.status)}
            >
              <span className="w-2 h-2 bg-current rounded-full mr-2"></span>
              {healthStatus.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* System Status */}
      {healthStatus && (
        <div 
          className="overflow-hidden shadow rounded-lg transition-colors duration-200"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 
                  className="text-lg leading-6 font-medium transition-colors duration-200"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  System Health
                </h3>
                <p 
                  className="mt-1 max-w-2xl text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {healthStatus.message}
                </p>
              </div>
              <div className="text-right">
                <p 
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Uptime
                </p>
                <p 
                  className="text-2xl font-semibold transition-colors duration-200"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatUptime(healthStatus.uptime)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {dashboardData && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentTextIcon 
                    className="h-6 w-6 transition-colors duration-200"
                    style={{ color: 'var(--color-primary)' }}
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt 
                      className="text-sm font-medium truncate transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Total Invoices
                    </dt>
                    <dd 
                      className="text-lg font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {dashboardData.totals.invoices}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon 
                    className="h-6 w-6 transition-colors duration-200"
                    style={{ color: 'var(--color-success)' }}
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt 
                      className="text-sm font-medium truncate transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Total Payments
                    </dt>
                    <dd 
                      className="text-lg font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {dashboardData.totals.payments}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon 
                    className="h-6 w-6 transition-colors duration-200"
                    style={{ color: 'var(--color-warning)' }}
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt 
                      className="text-sm font-medium truncate transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Pending Syncs
                    </dt>
                    <dd 
                      className="text-lg font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {dashboardData.totals.pendingSyncs}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon 
                    className="h-6 w-6 transition-colors duration-200"
                    style={{ color: 'var(--color-error)' }}
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt 
                      className="text-sm font-medium truncate transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Recent Errors
                    </dt>
                    <dd 
                      className="text-lg font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {dashboardData.totals.recentErrors}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Error Alert */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">QuickBooks Sync Error</h3>
              <p className="text-sm text-red-700 mt-1">{syncError}</p>
              <div className="mt-3">
                <button
                  onClick={() => setSyncError(null)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-800 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Dismiss
                </button>
                <span className="ml-2 text-xs text-red-600">
                  Contact your administrator to reauthorize QuickBooks if the issue persists.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Queue for QuickBooks */}
      <div 
        className="overflow-hidden shadow rounded-lg transition-colors duration-200"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 
              className="text-lg leading-6 font-medium transition-colors duration-200"
              style={{ color: 'var(--color-text-primary)' }}
            >
              QuickBooks Sync Queue
            </h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefreshQueue}
                disabled={extracting || queueLoading}
                className="inline-flex items-center px-3 py-1.5 border shadow-sm text-sm leading-4 font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-variant)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                }}
              >
                {extracting ? (
                  <>
                    <div 
                      className="animate-spin rounded-full h-3 w-3 border border-t-transparent mr-1"
                      style={{ borderColor: 'var(--color-text-secondary)', borderTopColor: 'transparent' }}
                    ></div>
                    Extracting...
                  </>
                ) : queueLoading ? (
                  <>
                    <div 
                      className="animate-spin rounded-full h-3 w-3 border border-t-transparent mr-1"
                      style={{ borderColor: 'var(--color-text-secondary)', borderTopColor: 'transparent' }}
                    ></div>
                    Loading...
                  </>
                ) : (
                  'Refresh'
                )}
              </button>
              <span 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200"
                style={
                  comprehensiveSyncStatus?.overall === 'synced'
                    ? { backgroundColor: 'var(--color-success-container)', color: 'var(--color-success)' }
                    : comprehensiveSyncStatus?.overall === 'pending_review'
                    ? { backgroundColor: 'var(--color-warning-container)', color: 'var(--color-warning)' }
                    : { backgroundColor: 'var(--color-error-container)', color: 'var(--color-error)' }
                }
              >
                {comprehensiveSyncStatus ? (
                  comprehensiveSyncStatus.overall === 'synced' 
                    ? 'Synced'
                    : comprehensiveSyncStatus.overall === 'pending_review'
                    ? `${comprehensiveSyncStatus.transfer_queue.pending_review} pending review`
                    : comprehensiveSyncStatus.overall === 'approved_pending_transfer'
                    ? `${comprehensiveSyncStatus.transfer_queue.approved} ready to transfer`
                    : `${comprehensiveSyncStatus.invoice_sync.invoices_without_qb_ids} need sync`
                ) : (
                  `${invoiceQueue.length} pending`
                )}
              </span>
            </div>
          </div>
          
          {queueLoading ? (
            <div className="flex items-center justify-center py-8">
              <div 
                className="animate-spin rounded-full h-6 w-6 border-b-2"
                style={{ borderBottomColor: 'var(--color-primary)' }}
              ></div>
              <span 
                className="ml-2 text-sm transition-colors duration-200"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Loading invoice queue...
              </span>
            </div>
          ) : invoiceQueue.length > 0 ? (
            <div className="space-y-3">
              <p 
                className="text-sm mb-4 transition-colors duration-200"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                The following invoices are new or updated and pending to be loaded into QuickBooks:
              </p>
              <div className="max-h-96 overflow-y-auto space-y-3">
                {invoiceQueue.slice(0, 10).map((invoice) => {
                  const isSyncing = syncingInvoices.has(invoice.id);
                  const syncStatus = invoice.syncStatus || 'pending';
                  
                  return (
                    <div 
                      key={invoice.id} 
                      className="rounded-lg p-4 transition-colors duration-200"
                      style={{ backgroundColor: 'var(--color-surface-variant)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <ClockIcon 
                              className="h-4 w-4 mr-2 flex-shrink-0 transition-colors duration-200"
                              style={{ color: 'var(--color-warning)' }}
                            />
                            <span 
                              className="font-medium truncate transition-colors duration-200"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {invoice.clientName || 'Unknown Client'}
                            </span>
                          </div>
                          <div 
                            className="mt-1 text-sm transition-colors duration-200"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Amount: {invoice.currency || '$'}{invoice.totalAmount?.toFixed(2) || '0.00'} • 
                            Status: {invoice.status}
                            {invoice.contactName && (
                              <> • Contact: {invoice.contactName}</>
                            )} • 
                            Created: {new Date(invoice.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleInvoiceClick(invoice.id)}
                            className="inline-flex items-center px-3 py-1.5 border shadow-sm text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                            style={{
                              backgroundColor: 'var(--color-surface)',
                              borderColor: 'var(--color-outline)',
                              color: 'var(--color-text-primary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                            }}
                          >
                            View Details
                          </button>
                          {syncStatus === 'synced' ? (
                            <span 
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200"
                              style={{ backgroundColor: 'var(--color-success-container)', color: 'var(--color-success)' }}
                            >
                              ✓ Synced
                            </span>
                          ) : syncStatus === 'failed' ? (
                            <span 
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200"
                              style={{ backgroundColor: 'var(--color-error-container)', color: 'var(--color-error)' }}
                            >
                              Failed
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSync(invoice.id);
                              }}
                              disabled={isSyncing}
                              className="inline-flex items-center px-3 py-1.5 border-transparent text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-on-primary)'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSyncing) {
                                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-hover)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSyncing) {
                                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                }
                              }}
                            >
                              {isSyncing ? (
                                <>
                                  <div 
                                    className="animate-spin rounded-full h-3 w-3 border border-t-transparent mr-1"
                                    style={{ borderColor: 'var(--color-on-primary)', borderTopColor: 'transparent' }}
                                  ></div>
                                  Syncing...
                                </>
                              ) : (
                                'Sync Now'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {invoiceQueue.length > 10 && (
                  <div 
                    className="text-center py-2 text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    ... and {invoiceQueue.length - 10} more invoices
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              {comprehensiveSyncStatus ? (
                <>
                  {comprehensiveSyncStatus.overall === 'synced' ? (
                    <>
                      <CheckCircleIcon 
                        className="mx-auto h-12 w-12 transition-colors duration-200"
                        style={{ color: 'var(--color-success)' }}
                      />
                      <p 
                        className="mt-2 text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {comprehensiveSyncStatus.message}
                      </p>
                    </>
                  ) : comprehensiveSyncStatus.overall === 'pending_review' ? (
                    <>
                      <ClockIcon 
                        className="mx-auto h-12 w-12 transition-colors duration-200"
                        style={{ color: 'var(--color-warning)' }}
                      />
                      <p 
                        className="mt-2 text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {comprehensiveSyncStatus.message}
                      </p>
                      <p 
                        className="text-sm mt-1 transition-colors duration-200"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {comprehensiveSyncStatus.transfer_queue.by_entity.invoices} invoices, {' '}
                        {comprehensiveSyncStatus.transfer_queue.by_entity.line_items} line items, {' '}
                        {comprehensiveSyncStatus.transfer_queue.by_entity.contacts} contacts, {' '}
                        {comprehensiveSyncStatus.transfer_queue.by_entity.companies} companies
                      </p>
                    </>
                  ) : comprehensiveSyncStatus.overall === 'approved_pending_transfer' ? (
                    <>
                      <ExclamationTriangleIcon 
                        className="mx-auto h-12 w-12 transition-colors duration-200"
                        style={{ color: 'var(--color-warning)' }}
                      />
                      <p 
                        className="mt-2 text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {comprehensiveSyncStatus.message}
                      </p>
                    </>
                  ) : (
                    <>
                      <ExclamationTriangleIcon 
                        className="mx-auto h-12 w-12 transition-colors duration-200"
                        style={{ color: 'var(--color-error)' }}
                      />
                      <p 
                        className="mt-2 text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {comprehensiveSyncStatus.message}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <CheckCircleIcon 
                    className="mx-auto h-12 w-12 transition-colors duration-200"
                    style={{ color: 'var(--color-success)' }}
                  />
                  <p 
                    className="mt-2 text-sm font-medium transition-colors duration-200"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    No invoices need synchronization
                  </p>
                  <p 
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Loading comprehensive sync status...
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QuickBooks Transfer Queue Status */}
      {comprehensiveSyncStatus && comprehensiveSyncStatus.transfer_queue.total_items > 0 && (
        <div 
          className="overflow-hidden shadow rounded-lg transition-colors duration-200"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-lg leading-6 font-medium transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                QuickBooks Transfer Queue
              </h3>
              <button
                onClick={fetchInvoiceQueue}
                disabled={queueLoading}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md transition-colors duration-200"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)'
                }}
              >
                {queueLoading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <div 
                  className="text-2xl font-bold transition-colors duration-200"
                  style={{ color: 'var(--color-warning)' }}
                >
                  {comprehensiveSyncStatus.transfer_queue.pending_review}
                </div>
                <div 
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Pending Review
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-2xl font-bold transition-colors duration-200"
                  style={{ color: 'var(--color-success)' }}
                >
                  {comprehensiveSyncStatus.transfer_queue.approved}
                </div>
                <div 
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Approved
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-2xl font-bold transition-colors duration-200"
                  style={{ color: 'var(--color-success)' }}
                >
                  {comprehensiveSyncStatus.transfer_queue.transferred}
                </div>
                <div 
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Transferred
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-2xl font-bold transition-colors duration-200"
                  style={{ color: 'var(--color-error)' }}
                >
                  {comprehensiveSyncStatus.transfer_queue.failed}
                </div>
                <div 
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Failed
                </div>
              </div>
            </div>

            {comprehensiveSyncStatus.transfer_queue.pending_review > 0 && (
              <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex space-x-3">
                  <button
                    onClick={() => processTransferQueueChanges()}
                    disabled={queueLoading}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-warning-container)',
                      color: 'var(--color-warning)'
                    }}
                  >
                    Process New Changes
                  </button>
                  <button
                    onClick={() => window.open('/api/quickbooks/queue', '_blank')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-primary)'
                    }}
                  >
                    View Queue Details
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h4 
                className="text-sm font-medium mb-3 transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Items by Type
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  ></div>
                  <span 
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {comprehensiveSyncStatus.transfer_queue.by_entity.invoices} Invoices
                  </span>
                </div>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: 'var(--color-secondary)' }}
                  ></div>
                  <span 
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {comprehensiveSyncStatus.transfer_queue.by_entity.line_items} Line Items
                  </span>
                </div>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: 'var(--color-tertiary)' }}
                  ></div>
                  <span 
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {comprehensiveSyncStatus.transfer_queue.by_entity.contacts} Contacts
                  </span>
                </div>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: 'var(--color-surface-variant)' }}
                  ></div>
                  <span 
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {comprehensiveSyncStatus.transfer_queue.by_entity.companies} Companies
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {dashboardData && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Invoice Status */}
          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 
                className="text-lg leading-6 font-medium mb-4 transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Invoice Status
              </h3>
              <div className="space-y-3">
                {Object.entries(dashboardData.invoicesByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span 
                      className="text-sm transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {status.replace('_', ' ')}
                    </span>
                    <span 
                      className="text-sm font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div 
            className="overflow-hidden shadow rounded-lg transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 
                className="text-lg leading-6 font-medium mb-4 transition-colors duration-200"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Payment Status
              </h3>
              <div className="space-y-3">
                {Object.entries(dashboardData.paymentsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span 
                      className="text-sm transition-colors duration-200"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {status.replace('_', ' ')}
                    </span>
                    <span 
                      className="text-sm font-medium transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div 
        className="text-center text-sm transition-colors duration-200"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Last updated: {new Date().toLocaleTimeString()}
      </div>

      {/* Invoice Details Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeModal}
            ></div>

            {/* Modal panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
              {/* Header */}
              <div className="bg-white px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Invoice Details
                  </h3>
                  <button
                    onClick={closeModal}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal content */}
              <div className="bg-white px-6 py-6 max-h-[70vh] overflow-y-auto">
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-lg text-gray-500">Loading invoice details...</span>
                  </div>
                ) : invoiceDetails ? (
                  <div className="space-y-6">
                    {/* Company and Contact Information */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {invoiceDetails.company && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Company</h4>
                          <p className="text-base text-gray-900 font-medium">{invoiceDetails.company.name}</p>
                          {invoiceDetails.company.domain && (
                            <p className="text-sm text-gray-500 mt-1">{invoiceDetails.company.domain}</p>
                          )}
                        </div>
                      )}
                      
                      {invoiceDetails.contact && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Contact</h4>
                          <p className="text-base text-gray-900 font-medium">
                            {invoiceDetails.contact.fullName || `${invoiceDetails.contact.firstName || ''} ${invoiceDetails.contact.lastName || ''}`.trim()}
                          </p>
                          {invoiceDetails.contact.email && (
                            <p className="text-sm text-gray-500 mt-1">{invoiceDetails.contact.email}</p>
                          )}
                          {invoiceDetails.contact.phone && (
                            <p className="text-sm text-gray-500">{invoiceDetails.contact.phone}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Line Items */}
                    {invoiceDetails.lineItems && invoiceDetails.lineItems.length > 0 && (
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Line Items</h4>
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {invoiceDetails.lineItems.map((item, index) => (
                                  <tr key={item.id || index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                      {item.productName || 'Service Item'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                                      {item.quantity || 1}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                                      {invoiceDetails.currency}${item.unitPrice.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                                      {invoiceDetails.currency}${item.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                                      {item.taxAmount > 0 ? (
                                        <div>
                                          <div className="font-medium text-gray-900">{invoiceDetails.currency}${item.taxAmount.toFixed(2)}</div>
                                          {item.taxRate > 0 && (
                                            <div className="text-xs text-gray-400">
                                              {item.taxRate.toFixed(3)}% {item.taxLabel || ''}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                                      {invoiceDetails.currency}${item.postTaxAmount.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tax Summary */}
                    {invoiceDetails.taxSummary && (
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Tax Summary</h4>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Subtotal (before tax):</span>
                              <span className="text-base font-medium text-gray-900">{invoiceDetails.currency}${invoiceDetails.taxSummary.subtotalBeforeTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Total Tax:</span>
                              <span className="text-base font-medium text-blue-600">{invoiceDetails.currency}${invoiceDetails.taxSummary.totalTaxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-blue-200 pt-3">
                              <span className="text-lg font-medium text-gray-900">Total (after tax):</span>
                              <span className="text-lg font-bold text-gray-900">{invoiceDetails.currency}${invoiceDetails.taxSummary.totalAfterTax.toFixed(2)}</span>
                            </div>
                            {invoiceDetails.taxSummary.taxBreakdown && (
                              <div className="text-sm text-gray-500 mt-3 pt-3 border-t border-blue-200">
                                <strong>Tax breakdown:</strong> {JSON.stringify(invoiceDetails.taxSummary.taxBreakdown).length > 100 ? 'Detailed breakdown available in system' : JSON.stringify(invoiceDetails.taxSummary.taxBreakdown)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Basic Invoice Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Invoice Information</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Total Amount:</span>
                          <p className="text-base font-medium text-gray-900">{invoiceDetails.currency}${invoiceDetails.totalAmount.toFixed(2)}</p>
                        </div>
                        {invoiceDetails.dueDate && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">Due Date:</span>
                            <p className="text-base text-gray-900">{new Date(invoiceDetails.dueDate).toLocaleDateString()}</p>
                          </div>
                        )}
                        {invoiceDetails.hubspotInvoiceId && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">HubSpot ID:</span>
                            <p className="text-base text-gray-900 font-mono">{invoiceDetails.hubspotInvoiceId}</p>
                          </div>
                        )}
                        {invoiceDetails.quickbooksInvoiceId && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">QuickBooks ID:</span>
                            <p className="text-base text-gray-900 font-mono">{invoiceDetails.quickbooksInvoiceId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-gray-500">Unable to load invoice details</p>
                    <button
                      onClick={closeModal}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}