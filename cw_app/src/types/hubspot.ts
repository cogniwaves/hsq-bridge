// Types stricts pour les APIs HubSpot

// Base interface for HubSpot API responses
export interface HubSpotApiResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// HubSpot object association
export interface HubSpotAssociation {
  id: string;
  type: string;
}

export interface HubSpotAssociations {
  contacts?: {
    results: HubSpotAssociation[];
  };
  companies?: {
    results: HubSpotAssociation[];
  };
  deals?: {
    results: HubSpotAssociation[];
  };
  line_items?: {
    results: HubSpotAssociation[];
  };
}

// HubSpot object base structure
export interface HubSpotObjectBase {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  associations?: HubSpotAssociations;
}

// Type pour les propriétés d'invoice HubSpot
export interface HubSpotInvoiceProperties {
  hs_invoice_number?: string | null;
  hs_invoice_amount?: string | null;
  hs_invoice_currency?: string | null;
  hs_invoice_status?: string | null;
  hs_invoice_date?: string | null;
  hs_invoice_due_date?: string | null;
  hs_invoice_description?: string | null;
  hs_subtotal?: string | null;
  hs_balance_due?: string | null;
  hs_total_amount?: string | null;
  createdate?: string | null;
  hs_lastmodifieddate?: string | null;
  amount?: string | null;
  total_amount?: string | null;
  subtotal?: string | null;
  net_amount?: string | null;
  gross_amount?: string | null;
  line_total?: string | null;
  invoice_total?: string | null;
  balance_due?: string | null;
}

// Type pour les propriétés de contact HubSpot
export interface HubSpotContactProperties {
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  jobtitle?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  createdate?: string | null;
  lastmodifieddate?: string | null;
}

// Type pour les propriétés de company HubSpot
export interface HubSpotCompanyProperties {
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  createdate?: string | null;
  hs_lastmodifieddate?: string | null;
}

// Type pour les propriétés de line item HubSpot
export interface HubSpotLineItemProperties {
  name?: string | null;
  hs_product_id?: string | null;
  sku?: string | null;
  quantity?: string | null;
  price?: string | null;
  amount?: string | null;
  hs_line_item_currency_code?: string | null;
  hs_discount_percentage?: string | null;
  hs_total_discount?: string | null;
  hs_tax_amount?: string | null;
  hs_tax_rate?: string | null;
  hs_tax_label?: string | null;
  hs_tax_category?: string | null;
  hs_post_tax_amount?: string | null;
  hs_pre_discount_amount?: string | null;
  hs_external_tax_rate_id?: string | null;
  createdate?: string | null;
  hs_lastmodifieddate?: string | null;
}

// Objects typés spécifiques
export interface HubSpotInvoice extends HubSpotObjectBase {
  properties: HubSpotInvoiceProperties;
}

export interface HubSpotContact extends HubSpotObjectBase {
  properties: HubSpotContactProperties;
}

export interface HubSpotCompany extends HubSpotObjectBase {
  properties: HubSpotCompanyProperties;
}

export interface HubSpotLineItem extends HubSpotObjectBase {
  properties: HubSpotLineItemProperties;
}

// Deal properties pour fallback
export interface HubSpotDealProperties {
  dealname?: string | null;
  amount?: string | null;
  closedate?: string | null;
  createdate?: string | null;
  hs_lastmodifieddate?: string | null;
  dealstage?: string | null;
  pipeline?: string | null;
  hubspot_owner_id?: string | null;
  deal_currency_code?: string | null;
  description?: string | null;
  hs_deal_stage_probability?: string | null;
}

export interface HubSpotDeal extends HubSpotObjectBase {
  properties: HubSpotDealProperties;
}

// Webhook event types
export interface HubSpotWebhookEvent {
  eventId: string;
  subscriptionId: string;
  portalId: string;
  occurredAt: number;
  subscriptionType: string;
  attemptNumber: number;
  objectId: string;
  changeSource: string;
  eventType: 'propertyChange' | 'create' | 'update' | 'delete';
  propertyName?: string;
  propertyValue?: string;
}

// Type guards pour validation des données HubSpot
export function isHubSpotInvoice(obj: unknown): obj is HubSpotInvoice {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'properties' in obj &&
    typeof (obj as any).id === 'string'
  );
}

export function isHubSpotApiResponse<T>(obj: unknown): obj is HubSpotApiResponse<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'results' in obj &&
    Array.isArray((obj as any).results)
  );
}

export function isHubSpotWebhookEvent(obj: unknown): obj is HubSpotWebhookEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'eventId' in obj &&
    'subscriptionId' in obj &&
    'objectId' in obj &&
    typeof (obj as any).eventId === 'string'
  );
}