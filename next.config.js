/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for offline-first deployment
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // Fix hot reload issues
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Improve development experience
  reactStrictMode: true,
  swcMinify: true,
  
  // Configure images for static export
  images: {
    unoptimized: true,
  },
  
  webpack: (config, { dev, isServer }) => {
    // Keep WebAssembly support enabled for future browser features
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Client-side configuration
    if (!isServer) {
      // Neutralize Node-only modules so browser bundle stays portable
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        assert: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        'fs': false,
        'path': false,
        'crypto': false,
      };
    }

    // Fix hot reload in development
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    return config;
  },
  
  // Headers for Chrome AI API access (only in development)
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
          ],
        },
      ];
    }
    return [];
  },
}

module.exports = nextConfig
