import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import url from 'url';

const app = express();
const port = 3000;

// Load allowed domains from YAML config
const configPath = path.resolve('./config/Procy.yml');
let allowedDomains = [];

try {
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContents);
  allowedDomains = config.allowed_domains || [];
  if (!Array.isArray(allowedDomains)) {
    throw new Error('allowed_domains must be an array');
  }
} catch (err) {
  console.error('Failed to load config:', err.message);
  process.exit(1);
}

// Serve frontend static files
app.use(express.static('public'));

// Proxy endpoint
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing "url" query parameter');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  // Check if the hostname is in allowed domains
  if (!allowedDomains.includes(parsedUrl.hostname)) {
    return res.status(403).send('Domain not allowed by proxy config');
  }

  // Proxy request to the target URL
  createProxyMiddleware({
    target: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      // Remove /proxy and also remove the base URL path (since we pass full url as query)
      // We rewrite path to the pathname + search of targetUrl
      return parsedUrl.pathname + parsedUrl.search;
    },
    logLevel: 'warn',
  })(req, res, next);
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
