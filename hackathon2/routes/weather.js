const express = require('express');
const { query, validationResult } = require('express-validator');
const axios = require('axios');

const { protect, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get current weather for a location
// @route   GET /api/weather/current
// @access  Public
router.get('/current', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  query('lon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  query('units').optional().isIn(['metric', 'imperial']).withMessage('Units must be metric or imperial')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { lat, lon, units = 'metric' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Weather API key not configured'
      });
    }

    const response = await axios.get(
      `${process.env.WEATHER_API_BASE_URL}/weather`,
      {
        params: {
          lat,
          lon,
          appid: apiKey,
          units,
          lang: 'en'
        }
      }
    );

    const weatherData = {
      location: {
        name: response.data.name,
        country: response.data.sys.country,
        coordinates: { lat: response.data.coord.lat, lon: response.data.coord.lon }
      },
      current: {
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        visibility: response.data.visibility,
        windSpeed: response.data.wind.speed,
        windDirection: response.data.wind.deg,
        description: response.data.weather[0].description,
        icon: response.data.weather[0].icon,
        clouds: response.data.clouds.all
      },
      timestamp: new Date(response.data.dt * 1000)
    };

    res.json({
      success: true,
      data: weatherData
    });

  } catch (error) {
    logger.error('Get current weather failed:', error);
    
    if (error.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: 'Weather API authentication failed'
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Weather API rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get weather data. Please try again.'
    });
  }
});

// @desc    Get weather forecast for a location
// @route   GET /api/weather/forecast
// @access  Public
router.get('/forecast', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  query('lon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  query('units').optional().isIn(['metric', 'imperial']).withMessage('Units must be metric or imperial'),
  query('days').optional().isInt({ min: 1, max: 7 }).withMessage('Days must be between 1 and 7')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { lat, lon, units = 'metric', days = 5 } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Weather API key not configured'
      });
    }

    const response = await axios.get(
      `${process.env.WEATHER_API_BASE_URL}/forecast`,
      {
        params: {
          lat,
          lon,
          appid: apiKey,
          units,
          lang: 'en',
          cnt: days * 8 // 8 forecasts per day (every 3 hours)
        }
      }
    );

    // Group forecasts by day
    const dailyForecasts = {};
    response.data.list.forEach(forecast => {
      const date = new Date(forecast.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dailyForecasts[dayKey]) {
        dailyForecasts[dayKey] = {
          date: dayKey,
          forecasts: [],
          summary: {
            minTemp: Infinity,
            maxTemp: -Infinity,
            totalPrecipitation: 0,
            windSpeed: 0,
            humidity: 0,
            pressure: 0
          }
        };
      }

      dailyForecasts[dayKey].forecasts.push({
        time: date.toISOString(),
        temperature: forecast.main.temp,
        feelsLike: forecast.main.feels_like,
        humidity: forecast.main.humidity,
        pressure: forecast.main.pressure,
        windSpeed: forecast.wind.speed,
        windDirection: forecast.wind.deg,
        description: forecast.weather[0].description,
        icon: forecast.weather[0].icon,
        precipitation: forecast.rain?.['3h'] || 0,
        clouds: forecast.clouds.all
      });

      // Update summary
      const summary = dailyForecasts[dayKey].summary;
      summary.minTemp = Math.min(summary.minTemp, forecast.main.temp);
      summary.maxTemp = Math.max(summary.maxTemp, forecast.main.temp);
      summary.totalPrecipitation += forecast.rain?.['3h'] || 0;
      summary.windSpeed = Math.max(summary.windSpeed, forecast.wind.speed);
      summary.humidity = Math.max(summary.humidity, forecast.main.humidity);
      summary.pressure = forecast.main.pressure; // Use last value
    });

    // Convert to array and sort by date
    const forecastData = Object.values(dailyForecasts).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        location: {
          name: response.data.city.name,
          country: response.data.city.country,
          coordinates: { lat: response.data.city.coord.lat, lon: response.data.city.coord.lon }
        },
        forecast: forecastData
      }
    });

  } catch (error) {
    logger.error('Get weather forecast failed:', error);
    
    if (error.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: 'Weather API authentication failed'
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Weather API rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get weather forecast. Please try again.'
    });
  }
});

// @desc    Get tide information for a location
// @route   GET /api/weather/tides
// @access  Public
router.get('/tides', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  query('lon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  query('date').optional().isISO8601().withMessage('Date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { lat, lon, date = new Date().toISOString().split('T')[0] } = req.query;
    const apiKey = process.env.TIDE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Tide API key not configured'
      });
    }

    // For now, return mock tide data since we don't have a real tide API
    // In production, you would integrate with a real tide API service
    const mockTideData = generateMockTideData(lat, lon, date);

    res.json({
      success: true,
      data: mockTideData
    });

  } catch (error) {
    logger.error('Get tide information failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tide information. Please try again.'
    });
  }
});

// @desc    Get coastal weather summary
// @route   GET /api/weather/coastal-summary
// @access  Public
router.get('/coastal-summary', [
  query('coastalArea').isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Valid coastal area is required')
], async (req, res) => {
  try {
    const { coastalArea } = req.query;

    // Coastal area coordinates (approximate)
    const coastalCoordinates = {
      mumbai: { lat: 19.0760, lon: 72.8777 },
      goa: { lat: 15.2993, lon: 74.1240 },
      kerala: { lat: 10.8505, lon: 76.2711 },
      tamilnadu: { lat: 11.1271, lon: 78.6569 },
      andhra: { lat: 15.9129, lon: 79.7400 },
      odisha: { lat: 20.9517, lon: 85.0985 },
      westbengal: { lat: 22.9868, lon: 87.8550 },
      gujarat: { lat: 22.2587, lon: 71.1924 }
    };

    const coords = coastalCoordinates[coastalArea];
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coastal area'
      });
    }

    // Get current weather and forecast
    const [currentWeather, forecast] = await Promise.all([
      getCurrentWeather(coords.lat, coords.lon),
      getWeatherForecast(coords.lat, coords.lon, 3)
    ]);

    // Generate mock tide data
    const tideData = generateMockTideData(coords.lat, coords.lon);

    const summary = {
      coastalArea,
      coordinates: coords,
      currentWeather,
      forecast: forecast.slice(0, 3), // Next 3 days
      tideData,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Get coastal weather summary failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coastal weather summary. Please try again.'
    });
  }
});

// @desc    Get weather alerts for a location
// @route   GET /api/weather/alerts
// @access  Public
router.get('/alerts', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  query('lon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Weather API key not configured'
      });
    }

    const response = await axios.get(
      `${process.env.WEATHER_API_BASE_URL}/onecall`,
      {
        params: {
          lat,
          lon,
          appid: apiKey,
          exclude: 'current,minutely,hourly,daily',
          units: 'metric'
        }
      }
    );

    const alerts = response.data.alerts || [];

    res.json({
      success: true,
      data: {
        alerts: alerts.map(alert => ({
          event: alert.event,
          description: alert.description,
          start: new Date(alert.start * 1000),
          end: new Date(alert.end * 1000),
          tags: alert.tags || []
        }))
      }
    });

  } catch (error) {
    logger.error('Get weather alerts failed:', error);
    
    if (error.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: 'Weather API authentication failed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get weather alerts. Please try again.'
    });
  }
});

// Helper functions
async function getCurrentWeather(lat, lon) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const response = await axios.get(
      `${process.env.WEATHER_API_BASE_URL}/weather`,
      {
        params: {
          lat,
          lon,
          appid: apiKey,
          units: 'metric',
          lang: 'en'
        }
      }
    );

    return {
      temperature: response.data.main.temp,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed,
      windDirection: response.data.wind.deg,
      pressure: response.data.main.pressure,
      description: response.data.weather[0].description,
      icon: response.data.weather[0].icon
    };
  } catch (error) {
    logger.error('Failed to get current weather:', error);
    return null;
  }
}

async function getWeatherForecast(lat, lon, days) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const response = await axios.get(
      `${process.env.WEATHER_API_BASE_URL}/forecast`,
      {
        params: {
          lat,
          lon,
          appid: apiKey,
          units: 'metric',
          lang: 'en',
          cnt: days * 8
        }
      }
    );

    return response.data.list.map(forecast => ({
      time: new Date(forecast.dt * 1000),
      temperature: forecast.main.temp,
      humidity: forecast.main.humidity,
      windSpeed: forecast.wind.speed,
      description: forecast.weather[0].description,
      icon: forecast.weather[0].icon
    }));
  } catch (error) {
    logger.error('Failed to get weather forecast:', error);
    return [];
  }
}

function generateMockTideData(lat, lon, date = new Date().toISOString().split('T')[0]) {
  // Generate realistic mock tide data based on location and date
  const baseTime = new Date(date);
  const tides = [];
  
  // Generate 4 tide changes per day (2 high, 2 low)
  for (let i = 0; i < 4; i++) {
    const tideTime = new Date(baseTime);
    tideTime.setHours(6 + (i * 6), 0, 0, 0); // 6 AM, 12 PM, 6 PM, 12 AM
    
    const isHigh = i % 2 === 0;
    const baseLevel = isHigh ? 3.5 : 0.5; // High tide ~3.5m, Low tide ~0.5m
    const variation = (Math.random() - 0.5) * 0.5; // ±0.25m variation
    
    tides.push({
      time: tideTime.toISOString(),
      type: isHigh ? 'high' : 'low',
      level: Math.round((baseLevel + variation) * 100) / 100,
      height: isHigh ? 'High' : 'Low'
    });
  }
  
  // Sort by time
  tides.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  // Find current tide and next change
  const now = new Date();
  const currentTide = tides.find(tide => new Date(tide.time) > now) || tides[0];
  const nextChange = tides.find(tide => new Date(tide.time) > now) || tides[0];
  
  return {
    location: { lat, lon },
    date: date,
    tides,
    current: {
      level: Math.round((Math.random() * 2 + 1) * 100) / 100, // Random current level
      nextChange: {
        time: nextChange.time,
        type: nextChange.type,
        level: nextChange.level
      }
    }
  };
}

module.exports = router;
