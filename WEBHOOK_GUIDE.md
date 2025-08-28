# 🌐 Fastify Webhook Development Guide

This guide will help you set up webhook mode using Fastify for local development and production deployment of the BrainAI Bot.

## 📋 Overview

Webhooks with Fastify provide several advantages over polling and Express:
- **Real-time updates**: Instant message processing
- **High Performance**: Fastify is up to 2x faster than Express
- **Lower server load**: No constant polling requests + optimized request handling
- **Better scaling**: Handles high message volumes efficiently with built-in rate limiting
- **Production ready**: Suitable for deployment on cloud platforms
- **Built-in validation**: JSON schema validation out of the box
- **Security plugins**: Helmet, CORS, and rate limiting included

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Install ngrok (if not already installed)
```bash
# Using npm (globally)
npm install -g ngrok

# Or using homebrew (macOS)
brew install ngrok

# Or download from https://ngrok.com/download
```

### 3. Setup Environment
```bash
cp .env.example .env
```

Edit your `.env` file with required tokens:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
OPENAI_API_KEY=your_openai_key_here
# ... other required variables
```

### 4. Start Development Server
```bash
npm run dev:webhook
```

That's it! Your bot is now running in webhook mode with ngrok tunneling.

## 🔧 Detailed Setup

### Environment Variables

#### Required for Webhook Mode:
```env
# Basic bot configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz
OPENAI_API_KEY=sk-...
OPENAI_ASSISTANT_ID=asst_...
GOAPI_API_KEY=your_goapi_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_key

# Webhook configuration
USE_WEBHOOK=true                    # Enable webhook mode
PORT=3000                          # Port for Express server
```

#### Optional for Enhanced Security:
```env
WEBHOOK_SECRET_TOKEN=your_secret_token_here    # Secure webhook endpoint
NODE_ENV=development                           # Environment mode
```

#### Production Only:
```env
WEBHOOK_URL=https://yourdomain.com/webhook    # Your production webhook URL
```

### Ngrok Configuration (Optional)

For enhanced ngrok features, you can configure:

```env
NGROK_AUTH_TOKEN=your_ngrok_token_here    # From ngrok dashboard
NGROK_REGION=us                           # Ngrok region (us, eu, ap, au, sa, jp, in)
```

Get your ngrok auth token from: https://dashboard.ngrok.com/get-started/your-authtoken

## 📱 Development Workflow

### Starting Development
```bash
# Start webhook development server
npm run dev:webhook

# Or with nodemon for auto-restart
npm run dev

# Or start regular polling mode
npm start
```

### What Happens When You Start:
1. **Fastify server** starts on specified port (default: 3000) with plugins loaded
2. **Ngrok tunnel** creates public URL (e.g., `https://abc123.ngrok.io`)
3. **Webhook registration** with Telegram using the ngrok URL
4. **Bot starts receiving** updates via webhook with structured logging and validation

### Development Console Output:
```
🔧 Starting BrainAI Bot in webhook development mode...

🌐 Setting up Fastify webhook with ngrok...
✅ Fastify server running on port 3000
✅ Ngrok tunnel established: https://abc123.ngrok.io
✅ Webhook configured successfully

🎉 Development server started successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Your bot is now running in webhook mode
🔗 Ngrok URL: https://abc123.ngrok.io
📡 Webhook URL: https://abc123.ngrok.io/webhook
🔍 Health check: https://abc123.ngrok.io/health
📚 API docs: https://abc123.ngrok.io/docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🛠 Available Endpoints

### Health Check
```
GET /health
```
Returns server status, uptime, memory usage, and webhook configuration.

Example response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "webhook": "https://abc123.ngrok.io/webhook",
  "ngrok": "https://abc123.ngrok.io",
  "memory": {
    "rss": "45MB",
    "heapTotal": "25MB",
    "heapUsed": "18MB",
    "external": "2MB"
  },
  "version": "1.0.0"
}
```

### Webhook Endpoint
```
POST /webhook
```
Receives Telegram updates with JSON schema validation and rate limiting (100 req/min).

### Secure Webhook (Optional)
```
POST /webhook/:token
```
Secured webhook endpoint with token validation and enhanced security.

### API Documentation
```
GET /docs
```
Simple HTML documentation page for available endpoints.

## 🔍 Testing Your Webhook

### 1. Health Check
Visit your ngrok URL in browser: `https://abc123.ngrok.io/health`

### 2. Test Bot Messages
Send messages to your bot in Telegram and watch the console logs.

### 3. Webhook Info
Check webhook status programmatically:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 4. Debug Mode
Set `NODE_ENV=development` for detailed logging of all webhook requests.

## 🚀 Production Deployment

### 1. Cloud Platform Setup

#### Heroku:
```bash
# Create app
heroku create your-brainai-bot

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set USE_WEBHOOK=true
heroku config:set WEBHOOK_URL=https://your-brainai-bot.herokuapp.com/webhook

# Deploy
git push heroku main
```

#### Railway:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

#### Vercel (Serverless):
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 2. Custom Server Setup

#### Docker:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

#### nginx Configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Fastify-specific optimizations
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### 3. Environment Variables for Production

```env
# Production webhook configuration
USE_WEBHOOK=true
WEBHOOK_URL=https://yourdomain.com/webhook
WEBHOOK_SECRET_TOKEN=your_secure_random_token
PORT=3000
NODE_ENV=production

# All other bot configuration...
TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
# etc.
```

## 🛡️ Security Best Practices

### 1. Use Secret Tokens
```env
WEBHOOK_SECRET_TOKEN=your_very_secure_random_string_here
```

### 2. Validate Requests
The webhook handler automatically validates requests when `WEBHOOK_SECRET_TOKEN` is set.

### 3. HTTPS Only
Always use HTTPS for production webhooks. Telegram requires HTTPS.

### 4. Rate Limiting
Fastify includes built-in rate limiting that's already configured:

```javascript
// Already included in webhook-handler.js
await this.app.register(require("@fastify/rate-limit"), {
    max: 1000,
    timeWindow: "15 minutes",
    errorResponseBuilder: (req, context) => ({
        code: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded, retry in ${context.ttl}ms`,
    }),
});
```

### 5. IP Whitelisting
Optionally restrict webhook access to Telegram's IP ranges:
```
149.154.167.197-233
91.108.4.0-255
```

## 🔄 Switching Between Modes

### From Polling to Webhook:
```bash
# Stop polling bot (Ctrl+C if running)
# Then start webhook
npm run dev:webhook
```

### From Webhook to Polling:
```bash
# Stop webhook server (Ctrl+C)
# Start polling mode
npm start
```

### Programmatically:
```javascript
const { WebhookHandler } = require('./webhook-handler');

// Switch to polling
await webhookHandler.switchToPolling();
```

## 🐛 Troubleshooting

### Common Issues:

#### 1. "Port already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev:webhook
```

#### 2. "Ngrok not found"
```bash
# Install ngrok globally
npm install -g ngrok

# Or add to local PATH
export PATH=$PATH:./node_modules/.bin
```

#### 3. "Webhook setup failed"
- Check your bot token is valid
- Ensure bot has webhook permissions
- Verify ngrok tunnel is active

#### 4. "No updates received"
- Check webhook info: `/getWebhookInfo`
- Verify ngrok URL is accessible
- Check Telegram bot settings

### Debug Steps:

1. **Check webhook status:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

2. **Test endpoint manually:**
```bash
curl https://your-ngrok-url.ngrok.io/health
```

3. **Check logs:**
Look for webhook registration confirmation and incoming request logs.

4. **Verify bot permissions:**
Ensure your bot has necessary permissions in Telegram.

## 📊 Monitoring and Logging

### Development Logging:
Fastify provides structured logging with request/response details:
```json
{
  "level": 30,
  "time": 1642248600000,
  "pid": 12345,
  "hostname": "localhost",
  "update": {
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {...},
      "chat": {...},
      "text": "Hello bot!"
    }
  },
  "msg": "Webhook received"
}
```

### Production Monitoring:
Consider integrating with monitoring services:
- **Sentry** for error tracking
- **DataDog** for metrics
- **LogRocket** for session replay
- **New Relic** for APM

### Custom Metrics:
```javascript
// Track webhook requests with Fastify hooks
this.app.addHook('onRequest', async (request, reply) => {
  request.log.info({ ip: request.ip }, 'Webhook request received');
  // Send to metrics service
});

this.app.addHook('onResponse', async (request, reply) => {
  const responseTime = reply.getResponseTime();
  request.log.info({ responseTime }, 'Webhook request completed');
});
```

## 🚀 Performance Tips

### 1. Use Fastify Webhooks Over Polling
Fastify webhooks are significantly more efficient for high-traffic bots.

### 2. Leverage Built-in Features
- JSON schema validation reduces processing overhead
- Built-in serialization is optimized for performance
- Request/response lifecycle hooks for monitoring

### 3. Implement Caching
Cache frequently accessed data (user settings, etc.).

### 4. Queue Long Operations
Use job queues for time-consuming tasks:
```javascript
// Example with Bull queue
const Queue = require('bull');
const imageQueue = new Queue('image processing');

// In webhook handler
imageQueue.add('generate', { prompt, userId });
```

### 5. Database Connection Pooling
Use connection pooling for database operations.

### 6. CDN for Static Assets
Serve images and static content via CDN.

### 7. Fastify-specific Optimizations
- Use `@fastify/compress` for response compression
- Enable `@fastify/static` for serving static files efficiently
- Use `@fastify/redis` for session management

## 📚 Additional Resources

- [Telegram Bot API Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [ngrok Documentation](https://ngrok.com/docs)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Fastify Security Best Practices](https://www.fastify.io/docs/latest/Guides/Security/)
- [Fastify Performance Tips](https://www.fastify.io/docs/latest/Guides/Performance/)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

## 🤝 Contributing

If you find issues with webhook setup or have improvements:

1. Check existing issues first
2. Create detailed bug reports
3. Include environment details
4. Test with minimal reproduction cases
5. Submit pull requests with tests

---

**Happy coding! 🚀**