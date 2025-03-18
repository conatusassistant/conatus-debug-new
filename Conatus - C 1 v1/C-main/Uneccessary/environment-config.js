// config/index.js
const environments = {
  development: {
    apiUrl: 'http://localhost:3001/api/v1',
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'http://localhost:8000',
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
    logLevel: 'debug',
    enableMocks: false,
    features: {
      multiLLM: true,
      socialFeatures: true,
      contextAwareness: true
    }
  },
  
  staging: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://api-staging.conatus.app/api/v1',
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
    logLevel: 'info',
    enableMocks: false,
    features: {
      multiLLM: true,
      socialFeatures: true,
      contextAwareness: true
    }
  },
  
  production: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.conatus.app/api/v1',
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
    logLevel: 'warn',
    enableMocks: false,
    features: {
      multiLLM: true,
      socialFeatures: true,
      contextAwareness: true
    }
  }
};

// Determine current environment
const getEnvironment = () => {
  // In Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'development';
  }
  
  // In browser environment
  if (typeof window !== 'undefined' && window.env) {
    return window.env.NODE_ENV || 'development';
  }
  
  // Default fallback
  return 'development';
};

// Get configuration for current environment
const getCurrentConfig = () => {
  const env = getEnvironment();
  return environments[env] || environments.development;
};

// Function to check if a feature is enabled
const isFeatureEnabled = (featureName) => {
  const config = getCurrentConfig();
  return config.features && config.features[featureName] === true;
};

// Export configuration
const config = {
  ...getCurrentConfig(),
  isFeatureEnabled
};

export default config;
