import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import {fileURLToPath} from 'url';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.mapbox.com'
      }
    ]
  }
};

export default withNextIntl(nextConfig);
