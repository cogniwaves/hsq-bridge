import { HubSpotCompany, getHubSpotClient } from './hubspotClient';
import { logger } from '../utils/logger';
import { prisma } from '../index';

export class CompanyService {
  // Create or update a company from HubSpot data
  async upsertCompany(hubspotCompany: HubSpotCompany): Promise<string> {
    const props = hubspotCompany.properties;
    
    const companyData = {
      name: props.name,
      domain: props.domain,
      industry: props.industry,
      country: props.country,
      city: props.city,
      state: props.state,
      zip: props.zip,
      hubspotCreatedAt: props.createdate ? new Date(props.createdate) : null,
      hubspotUpdatedAt: props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : null,
      lastSyncAt: new Date()
    };

    const company = await prisma.company.upsert({
      where: { hubspotCompanyId: hubspotCompany.id },
      update: companyData,
      create: {
        hubspotCompanyId: hubspotCompany.id,
        ...companyData
      }
    });

    logger.debug(`Upserted company ${company.id} (HubSpot: ${hubspotCompany.id})`);
    return company.id;
  }

  // Get company by HubSpot ID
  async getCompanyByHubSpotId(hubspotCompanyId: string) {
    return prisma.company.findUnique({
      where: { hubspotCompanyId }
    });
  }

  // Fetch company details from HubSpot and upsert
  async fetchAndUpsertCompany(hubspotCompanyId: string): Promise<string | null> {
    try {
      const hubspotClient = getHubSpotClient();
      const hubspotCompany = await hubspotClient.getCompany(hubspotCompanyId);
      
      if (!hubspotCompany) {
        logger.warn(`Company ${hubspotCompanyId} not found in HubSpot`);
        return null;
      }

      return await this.upsertCompany(hubspotCompany);
    } catch (error) {
      logger.error(`Failed to fetch company ${hubspotCompanyId}:`, error);
      return null;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await prisma.$disconnect();
  }
}

// Singleton instance
let companyService: CompanyService | null = null;

export function getCompanyService(): CompanyService {
  if (!companyService) {
    companyService = new CompanyService();
  }
  return companyService;
}