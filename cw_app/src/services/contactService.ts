import { HubSpotContact, getHubSpotClient } from './hubspotClient';
import { logger } from '../utils/logger';
import { prisma } from '../index';

export class ContactService {
  // Create or update a contact from HubSpot data
  async upsertContact(hubspotContact: HubSpotContact): Promise<string> {
    const props = hubspotContact.properties;
    
    const contactData = {
      email: props.email,
      firstName: props.firstname,
      lastName: props.lastname,
      fullName: props.firstname && props.lastname 
        ? `${props.firstname} ${props.lastname}`.trim()
        : props.firstname || props.lastname || null,
      jobTitle: props.jobtitle,
      phone: props.phone,
      country: props.country,
      city: props.city,
      hubspotCreatedAt: props.createdate ? new Date(props.createdate) : null,
      hubspotUpdatedAt: props.lastmodifieddate ? new Date(props.lastmodifieddate) : null,
      lastSyncAt: new Date()
    };

    const contact = await prisma.contact.upsert({
      where: { hubspotContactId: hubspotContact.id },
      update: contactData,
      create: {
        hubspotContactId: hubspotContact.id,
        ...contactData
      }
    });

    logger.debug(`Upserted contact ${contact.id} (HubSpot: ${hubspotContact.id})`);
    return contact.id;
  }

  // Get contact by HubSpot ID
  async getContactByHubSpotId(hubspotContactId: string) {
    return prisma.contact.findUnique({
      where: { hubspotContactId }
    });
  }

  // Fetch contact details from HubSpot and upsert
  async fetchAndUpsertContact(hubspotContactId: string): Promise<string | null> {
    try {
      const hubspotClient = getHubSpotClient();
      const hubspotContact = await hubspotClient.getContact(hubspotContactId);
      
      if (!hubspotContact) {
        logger.warn(`Contact ${hubspotContactId} not found in HubSpot`);
        return null;
      }

      return await this.upsertContact(hubspotContact);
    } catch (error) {
      logger.error(`Failed to fetch contact ${hubspotContactId}:`, error);
      return null;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await prisma.$disconnect();
  }
}

// Singleton instance
let contactService: ContactService | null = null;

export function getContactService(): ContactService {
  if (!contactService) {
    contactService = new ContactService();
  }
  return contactService;
}