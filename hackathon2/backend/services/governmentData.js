const axios = require('axios');
const logger = require('../utils/logger');

class GovernmentDataService {
  constructor() {
    // Government API endpoints for coastal monitoring
    this.apis = {
      // Indian Meteorological Department (IMD)
      imd: {
        baseUrl: 'https://mausam.imd.gov.in/api',
        endpoints: {
          weather: '/weather',
          cyclone: '/cyclone',
          marine: '/marine',
          coastal: '/coastal'
        }
      },
      
      // Indian National Centre for Ocean Information Services (INCOIS)
      incois: {
        baseUrl: 'https://www.incois.gov.in/api',
        endpoints: {
          tide: '/tide',
          wave: '/wave',
          storm: '/storm',
          tsunami: '/tsunami'
        }
      },
      
      // Central Water Commission (CWC)
      cwc: {
        baseUrl: 'https://cwc.gov.in/api',
        endpoints: {
          flood: '/flood',
          waterLevel: '/water-level',
          rainfall: '/rainfall'
        }
      },
      
      // National Disaster Management Authority (NDMA)
      ndma: {
        baseUrl: 'https://ndma.gov.in/api',
        endpoints: {
          alerts: '/alerts',
          warnings: '/warnings',
          guidelines: '/guidelines'
        }
      },
      
      // Ministry of Earth Sciences (MoES)
      moes: {
        baseUrl: 'https://moes.gov.in/api',
        endpoints: {
          coastal: '/coastal',
          marine: '/marine',
          climate: '/climate'
        }
      },
      
      // Central Pollution Control Board (CPCB)
      cpcb: {
        baseUrl: 'https://cpcb.nic.in/api',
        endpoints: {
          waterQuality: '/water-quality',
          coastal: '/coastal',
          pollution: '/pollution'
        }
      }
    };

    // API keys and authentication (should be in environment variables)
    this.apiKeys = {
      imd: process.env.IMD_API_KEY || 'demo_key',
      incois: process.env.INCOIS_API_KEY || 'demo_key',
      cwc: process.env.CWC_API_KEY || 'demo_key',
      ndma: process.env.NDMA_API_KEY || 'demo_key',
      moes: process.env.MOES_API_KEY || 'demo_key',
      cpcb: process.env.CPCB_API_KEY || 'demo_key'
    };

    // Fallback data for when APIs are not available
    this.fallbackData = this.initializeFallbackData();
    
    // Cache for API responses
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  initializeFallbackData() {
    return {
      weather: {
        temperature: 28,
        humidity: 75,
        windSpeed: 15,
        pressure: 1013,
        visibility: 10,
        condition: 'Partly Cloudy'
      },
      tide: {
        current: 'High Tide',
        height: 2.8,
        next: 'Low Tide',
        nextTime: '18:30',
        range: 2.2
      },
      alerts: [
        {
          id: 'GOV001',
          type: 'weather',
          severity: 'MEDIUM',
          title: 'Heavy Rainfall Warning',
          description: 'Heavy rainfall expected in coastal areas of Maharashtra',
          location: 'Maharashtra Coast',
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          source: 'IMD',
          recommendations: ['Monitor weather updates', 'Avoid coastal activities', 'Stay informed']
        }
      ],
      waterQuality: {
        ph: 7.2,
        dissolvedOxygen: 8.5,
        turbidity: 2.1,
        temperature: 26,
        salinity: 35,
        status: 'Good'
      }
    };
  }

  async getLatestAlerts() {
    try {
      // Try to get alerts from NDMA first
      const ndmaAlerts = await this.getNDMAAlerts();
      if (ndmaAlerts && ndmaAlerts.length > 0) {
        return { alerts: ndmaAlerts, source: 'NDMA' };
      }

      // Fallback to IMD alerts
      const imdAlerts = await this.getIMDAlerts();
      if (imdAlerts && imdAlerts.length > 0) {
        return { alerts: imdAlerts, source: 'IMD' };
      }

      // Return fallback data if no real data available
      logger.warn('Using fallback government alert data');
      return { alerts: this.fallbackData.alerts, source: 'fallback' };
    } catch (error) {
      logger.error('Error getting latest government alerts:', error);
      return { alerts: this.fallbackData.alerts, source: 'fallback' };
    }
  }

  async getNDMAAlerts() {
    try {
      const cacheKey = 'ndma_alerts';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.apis.ndma.baseUrl}${this.apis.ndma.endpoints.alerts}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.ndma}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        const alerts = this.processNDMAAlerts(response.data.data);
        this.setCachedData(cacheKey, alerts);
        return alerts;
      }

      return [];
    } catch (error) {
      logger.error('Error fetching NDMA alerts:', error.message);
      return [];
    }
  }

  async getIMDAlerts() {
    try {
      const cacheKey = 'imd_alerts';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.apis.imd.baseUrl}${this.apis.imd.endpoints.weather}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.imd}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        const alerts = this.processIMDAlerts(response.data.data);
        this.setCachedData(cacheKey, alerts);
        return alerts;
      }

      return [];
    } catch (error) {
      logger.error('Error fetching IMD alerts:', error.message);
      return [];
    }
  }

  async getWaterQualityData(location) {
    try {
      const cacheKey = `water_quality_${location}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // Try CPCB API first
      const cpcbData = await this.getCPCBWaterQuality(location);
      if (cpcbData) {
        this.setCachedData(cacheKey, cpcbData);
        return cpcbData;
      }

      // Try MoES API as fallback
      const moesData = await this.getMoESWaterQuality(location);
      if (moesData) {
        this.setCachedData(cacheKey, moesData);
        return moesData;
      }

      // Return fallback data
      logger.warn(`Using fallback water quality data for ${location}`);
      return { ...this.fallbackData.waterQuality, location };

    } catch (error) {
      logger.error('Error getting water quality data:', error);
      return { ...this.fallbackData.waterQuality, location };
    }
  }

  async getCPCBWaterQuality(location) {
    try {
      const response = await axios.get(`${this.apis.cpcb.baseUrl}${this.apis.cpcb.endpoints.waterQuality}`, {
        params: { location },
        headers: {
          'Authorization': `Bearer ${this.apiKeys.cpcb}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        return this.processCPCBWaterQuality(response.data.data);
      }

      return null;
    } catch (error) {
      logger.error('Error fetching CPCB water quality data:', error.message);
      return null;
    }
  }

  async getMoESWaterQuality(location) {
    try {
      const response = await axios.get(`${this.apis.moes.baseUrl}${this.apis.moes.endpoints.coastal}`, {
        params: { location, type: 'water_quality' },
        headers: {
          'Authorization': `Bearer ${this.apiKeys.moes}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        return this.processMoESWaterQuality(response.data.data);
      }

      return null;
    } catch (error) {
      logger.error('Error fetching MoES water quality data:', error.message);
      return null;
    }
  }

  async getTideData(location) {
    try {
      const cacheKey = `tide_data_${location}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // Try INCOIS API first
      const incoisData = await this.getINCOISTideData(location);
      if (incoisData) {
        this.setCachedData(cacheKey, incoisData);
        return incoisData;
      }

      // Return fallback data
      logger.warn(`Using fallback tide data for ${location}`);
      return { ...this.fallbackData.tide, location };

    } catch (error) {
      logger.error('Error getting tide data:', error);
      return { ...this.fallbackData.tide, location };
    }
  }

  async getINCOISTideData(location) {
    try {
      const response = await axios.get(`${this.apis.incois.baseUrl}${this.apis.incois.endpoints.tide}`, {
        params: { location },
        headers: {
          'Authorization': `Bearer ${this.apiKeys.incois}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        return this.processINCOISTideData(response.data.data);
      }

      return null;
    } catch (error) {
      logger.error('Error fetching INCOIS tide data:', error.message);
      return null;
    }
  }

  async getFloodData(location) {
    try {
      const cacheKey = `flood_data_${location}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.apis.cwc.baseUrl}${this.apis.cwc.endpoints.flood}`, {
        params: { location },
        headers: {
          'Authorization': `Bearer ${this.apiKeys.cwc}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        const floodData = this.processCWCFloodData(response.data.data);
        this.setCachedData(cacheKey, floodData);
        return floodData;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching CWC flood data:', error.message);
      return null;
    }
  }

  async getCycloneData() {
    try {
      const cacheKey = 'cyclone_data';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.apis.imd.baseUrl}${this.apis.imd.endpoints.cyclone}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.imd}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        const cycloneData = this.processIMDCycloneData(response.data.data);
        this.setCachedData(cacheKey, cycloneData);
        return cycloneData;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching IMD cyclone data:', error.message);
      return null;
    }
  }

  // Data processing methods
  processNDMAAlerts(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(alert => ({
      id: alert.id || `NDMA_${Date.now()}`,
      type: alert.type || 'general',
      severity: this.mapSeverity(alert.severity),
      title: alert.title || 'NDMA Alert',
      description: alert.description || 'No description available',
      location: alert.location || 'Multiple locations',
      validFrom: alert.validFrom || new Date().toISOString(),
      validUntil: alert.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      source: 'NDMA',
      recommendations: alert.recommendations || ['Follow official instructions', 'Stay informed'],
      category: alert.category || 'disaster'
    }));
  }

  processIMDAlerts(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(alert => ({
      id: alert.id || `IMD_${Date.now()}`,
      type: 'weather',
      severity: this.mapSeverity(alert.severity),
      title: alert.title || 'IMD Weather Alert',
      description: alert.description || 'No description available',
      location: alert.location || 'Multiple locations',
      validFrom: alert.validFrom || new Date().toISOString(),
      validUntil: alert.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      source: 'IMD',
      recommendations: alert.recommendations || ['Monitor weather updates', 'Stay informed'],
      category: 'weather'
    }));
  }

  processCPCBWaterQuality(data) {
    return {
      ph: data.ph || 7.0,
      dissolvedOxygen: data.dissolvedOxygen || 8.0,
      turbidity: data.turbidity || 2.0,
      temperature: data.temperature || 25,
      salinity: data.salinity || 35,
      status: this.calculateWaterQualityStatus(data),
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'CPCB'
    };
  }

  processMoESWaterQuality(data) {
    return {
      ph: data.ph || 7.0,
      dissolvedOxygen: data.dissolvedOxygen || 8.0,
      turbidity: data.turbidity || 2.0,
      temperature: data.temperature || 25,
      salinity: data.salinity || 35,
      status: this.calculateWaterQualityStatus(data),
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'MoES'
    };
  }

  processINCOISTideData(data) {
    return {
      current: data.current || 'Unknown',
      height: data.height || 0,
      next: data.next || 'Unknown',
      nextTime: data.nextTime || 'Unknown',
      range: data.range || 0,
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'INCOIS'
    };
  }

  processCWCFloodData(data) {
    return {
      waterLevel: data.waterLevel || 0,
      floodStatus: data.floodStatus || 'Normal',
      warningLevel: data.warningLevel || 0,
      dangerLevel: data.dangerLevel || 0,
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'CWC'
    };
  }

  processIMDCycloneData(data) {
    return {
      activeCyclones: data.activeCyclones || [],
      warnings: data.warnings || [],
      forecast: data.forecast || [],
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'IMD'
    };
  }

  // Helper methods
  mapSeverity(severity) {
    const severityMap = {
      'low': 'LOW',
      'medium': 'MEDIUM',
      'high': 'HIGH',
      'critical': 'CRITICAL',
      'severe': 'HIGH',
      'extreme': 'CRITICAL'
    };
    
    return severityMap[severity?.toLowerCase()] || 'MEDIUM';
  }

  calculateWaterQualityStatus(data) {
    const ph = data.ph || 7.0;
    const dissolvedOxygen = data.dissolvedOxygen || 8.0;
    const turbidity = data.turbidity || 2.0;

    if (ph >= 6.5 && ph <= 8.5 && dissolvedOxygen >= 6.0 && turbidity <= 5.0) {
      return 'Excellent';
    } else if (ph >= 6.0 && ph <= 9.0 && dissolvedOxygen >= 4.0 && turbidity <= 10.0) {
      return 'Good';
    } else if (ph >= 5.5 && ph <= 9.5 && dissolvedOxygen >= 2.0 && turbidity <= 20.0) {
      return 'Fair';
    } else {
      return 'Poor';
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
    logger.info('Government data cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    const now = Date.now();
    const expiredKeys = [];
    let validEntries = 0;

    this.cache.forEach((value, key) => {
      if (now - value.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredKeys.push(key);
      }
    });

    // Clean up expired entries
    expiredKeys.forEach(key => this.cache.delete(key));

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries,
      expiredEntries: expiredKeys.length,
      cacheTimeout: this.cacheTimeout
    };
  }

  // Test API connectivity
  async testAPIConnectivity() {
    const results = {};
    
    for (const [name, api] of Object.entries(this.apis)) {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${api.baseUrl}/health`, {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${this.apiKeys[name]}`,
            'Content-Type': 'application/json'
          }
        });
        
        results[name] = {
          status: 'connected',
          responseTime: Date.now() - startTime,
          statusCode: response.status
        };
      } catch (error) {
        results[name] = {
          status: 'disconnected',
          error: error.message,
          responseTime: null
        };
      }
    }

    return results;
  }

  // Get service status
  async getServiceStatus() {
    const connectivity = await this.testAPIConnectivity();
    const cacheStats = this.getCacheStats();
    
    return {
      connectivity: connectivity,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
      status: 'operational'
    };
  }
}

module.exports = GovernmentDataService;
