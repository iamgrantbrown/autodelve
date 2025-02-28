import { download, readMarkdownFiles } from './lib/download';
import { ask } from './lib/ask';
import { connect } from './lib/discord';
import * as fs from 'fs';
import * as path from 'path';

// Validate required environment variables
function validateEnvironment() {
  const requiredVars = [
    'OPENAI_API_KEY',
    'DISCORD_BOT_TOKEN'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Validate environment variables before starting
validateEnvironment();

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const input = args[1];

// Check if content exists, if not and we're starting the bot, download it
const contentPath = path.join('content', 'website_content.json');
const contentExists = fs.existsSync(contentPath);

// Create a simple HTTP server to keep the process alive and satisfy deployment requirements
function startHttpServer() {
  const port = process.env.PORT || 3000;
  
  // Simple IP-based rate limiting
  const ipRateLimits = new Map<string, { count: number, lastReset: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 30;
  
  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const rateData = ipRateLimits.get(ip) || { count: 0, lastReset: now };
    
    // Reset counter if window has passed
    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
      rateData.count = 1;
      rateData.lastReset = now;
      ipRateLimits.set(ip, rateData);
      return false;
    }
    
    // Check if over limit
    if (rateData.count >= MAX_REQUESTS_PER_WINDOW) {
      return true;
    }
    
    // Increment counter
    rateData.count++;
    ipRateLimits.set(ip, rateData);
    return false;
  }
  
  const server = Bun.serve({
    port: port,
    fetch(req) {
      try {
        // Get client IP for rate limiting
        const ip = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown-ip';
        
        // Check rate limit
        if (isRateLimited(ip)) {
          return new Response('Rate limit exceeded. Please try again later.', { 
            status: 429,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        const url = new URL(req.url);
        
        // Health check endpoint for monitoring
        if (url.pathname === '/health') {
          return new Response(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString() 
          }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Main endpoint with minimal information
        return new Response('AutoDelve Bot is running!', { 
          status: 200,
          headers: { 
            'Content-Type': 'text/plain',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "default-src 'none'"
          }
        });
      } catch (error) {
        console.error('HTTP server error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    },
    error(error) {
      console.error('Server error:', error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });
  
  console.log(`HTTP server listening on port ${port}`);
  return server;
}

if (command === 'download' && input) {
  download(input);
} else if (command === 'ask' && input) {
  const answer = await ask(input);
  console.log(answer);
} else {
  console.log('Starting Discord bot...');
  
  // If content doesn't exist, download it first
  if (!contentExists) {
    console.log('Content file not found. Downloading Private AI documentation...');
    await download('https://docs.private-ai.com/');
    console.log('Download complete. Starting bot...');
  }
  
  // Start the Discord bot
  connect();
  
  // Start HTTP server to satisfy deployment requirements
  startHttpServer();
}
