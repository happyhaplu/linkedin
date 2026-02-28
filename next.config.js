/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media-exp1.licdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media-exp2.licdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.licdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static-exp1.licdn.com',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle puppeteer on client side
      config.resolve.alias = {
        ...config.resolve.alias,
        'puppeteer-extra': false,
        'puppeteer-extra-plugin-stealth': false,
        'puppeteer': false,
      }
    }
    
    return config
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
      'puppeteer',
      'playwright',
      'playwright-core',
      'bullmq',
      'ioredis',
    ],
  },
}

module.exports = nextConfig
