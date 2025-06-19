import whois from 'whois';
import { promises as dns } from 'dns';
import { logger } from '../utils/logger.js';

export class DomainResearcher {
  async research(domain, tracker = null) {
    logger.info(`Researching domain: ${domain}`);
    
    if (tracker) {
      tracker.addThinking(`Researching domain registration data for ${domain}`, {
        checks: ['WHOIS lookup', 'DNS records', 'availability check'],
        purpose: 'Determine domain age, ownership history, and availability'
      });
    }
    
    const [whoisData, dnsData, availability] = await Promise.all([
      this.getWhoisData(domain),
      this.getDnsData(domain),
      this.checkAvailability(domain)
    ]);

    const registrationAge = this.calculateAge(whoisData);
    
    if (tracker) {
      tracker.addThinking(`Domain research complete for ${domain}`, {
        availability: availability ? 'Available for registration' : 'Already registered',
        ageInYears: registrationAge ? Math.round(registrationAge * 10) / 10 : 'Unknown',
        dnsConfigured: dnsData?.ipv4?.length > 0,
        mxRecords: dnsData?.mx?.length || 0
      });
    }

    return {
      domain,
      whois: whoisData,
      dns: dnsData,
      availability,
      registrationAge,
      previousOwners: this.extractPreviousOwners(whoisData)
    };
  }

  async getWhoisData(domain) {
    try {
      logger.info(`Starting WHOIS lookup for ${domain}`);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WHOIS timeout')), 10000)
      );
      
      const whoisPromise = new Promise((resolve, reject) => {
        whois.lookup(domain, (err, data) => {
          if (err) {
            logger.warn(`WHOIS lookup failed for ${domain}:`, err.message);
            reject(err);
          } else {
            logger.info(`WHOIS lookup successful for ${domain}`);
            resolve(this.parseWhoisData(data));
          }
        });
      });
      
      return await Promise.race([whoisPromise, timeoutPromise]);
    } catch (error) {
      logger.error(`WHOIS lookup failed for ${domain}:`, error);
      return null;
    }
  }

  async getDnsData(domain) {
    try {
      logger.info(`Starting DNS lookup for ${domain}`);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DNS timeout')), 8000)
      );
      
      const dnsPromise = Promise.all([
        dns.resolve4(domain).catch(() => []),
        dns.resolveMx(domain).catch(() => []),
        dns.resolveTxt(domain).catch(() => [])
      ]);
      
      const records = await Promise.race([dnsPromise, timeoutPromise]);
      logger.info(`DNS lookup successful for ${domain}`);
      
      return {
        ipv4: records[0],
        mx: records[1],
        txt: records[2]
      };
    } catch (error) {
      logger.error(`DNS lookup failed for ${domain}:`, error);
      return { ipv4: [], mx: [], txt: [] };
    }
  }

  async checkAvailability(domain) {
    try {
      await dns.resolve4(domain);
      return false;
    } catch {
      return true;
    }
  }

  parseWhoisData(rawData) {
    const parsed = {};
    const lines = rawData.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        parsed[key.trim()] = value.trim();
      }
    });
    
    return parsed;
  }

  calculateAge(whoisData) {
    if (!whoisData || !whoisData['Creation Date']) return null;
    
    const creationDate = new Date(whoisData['Creation Date']);
    const now = new Date();
    const ageInYears = (now - creationDate) / (1000 * 60 * 60 * 24 * 365);
    
    return ageInYears;
  }

  extractPreviousOwners(whoisData) {
    return [];
  }
}