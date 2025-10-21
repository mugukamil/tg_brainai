# AI Agents Documentation - TG BrainAI Bot

## 🎯 Project Overview

**TG BrainAI Bot** is a comprehensive Telegram bot that provides AI-powered services including:
- **Text Generation**: GPT-4 powered conversations with persistent threads
- **Image Generation**: Dual provider support (GoAPI/Midjourney + fal.ai/Nano Banana)
- **Video Generation**: Replicate-powered video creation
- **Payment System**: Telegram Stars integration for premium subscriptions
- **User Management**: Complete lifecycle with Supabase backend

### Tech Stack
- **Runtime**: Node.js 16+ with TypeScript
- **Framework**: Custom Telegram bot implementation using `telegramsjs`
- **Database**: PostgreSQL with Prisma ORM
- **Backend**: Supabase for user management
- **AI Services**: OpenAI, GoAPI, fal.ai, Replicate
- **Deployment**: Docker, PM2, webhook/polling modes

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot Layer                       │
├─────────────────────────────────────────────────────────────┤
│  src/tg-bot.ts → src/tg-client.ts → src/handlers/msg-handler.ts │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────┼───────────────────────────────────────────┐
│                 ▼            Flow Layer                     │
├─────────────────────────────────────────────────────────────┤
│  src/flows/                                                 │
│  ├── text.ts      (GPT-4 conversations)                     │
│  ├── image.ts     (GoAPI Midjourney)                        │
│  ├── image-fal.ts (fal.ai Nano Banana)                     │
│  ├── video.ts     (Replicate video)                        │
│  ├── video-fal.ts (fal.ai video)                           │
│  ├── voice.ts     (Whisper transcription)                  │
│  └── callbacks.ts (Inline keyboard handling)               │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────┼───────────────────────────────────────────┐
│                 ▼           Handler Layer                   │
├─────────────────────────────────────────────────────────────┤
│  src/handlers/                                              │
│  ├── openai-handler.ts    (GPT-4, Whisper, Vision)         │
│  ├── goapi-handler.ts     (Midjourney API)                 │
│  ├── fal-handler.ts       (fal.ai image generation)        │
│  ├── video-handler.ts     (Replicate video)                │
│  ├── fal-video-handler.ts (fal.ai video)                   │
│  ├── supabase-handler.ts  (User/DB operations)             │
│  ├── payment-handler.ts   (Telegram Stars)                 │
│  └── terms-handler.ts     (TOS acceptance)                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────┼───────────────────────────────────────────┐
│                 ▼         External Services                 │
├─────────────────────────────────────────────────────────────┤
│  • OpenAI (GPT-4, Whisper, Vision)                         │
│  • GoAPI (Midjourney)                                      │
│  • fal.ai (Nano Banana, Video)                            │
│  • Replicate (Video Generation)                           │
│  • Supabase (PostgreSQL + Auth)                           │
│  • Telegram (Bot API + Payments)                          │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Key File Structure

```
src/
├── index.ts                 # Main entry point with startup logic
├── tg-bot.ts               # Bot initialization and setup
├── tg-client.ts            # Telegram API client wrapper
├── findOrCreate.ts         # User creation/retrieval logic
├── webhook-server.ts       # Webhook server setup
├── dev-webhook.ts          # Development webhook with ngrok
│
├── flows/                  # Business logic flows
│   ├── text.ts            # GPT-4 conversation flow
│   ├── voice.ts           # Voice message processing
│   ├── image.ts           # GoAPI image generation
│   ├── image-fal.ts       # fal.ai image generation
│   ├── video.ts           # Replicate video generation
│   ├── video-fal.ts       # fal.ai video generation
│   └── callbacks.ts       # Callback query handling
│
├── handlers/              # Service integration handlers
│   ├── msg-handler.ts     # Main message routing
│   ├── openai-handler.ts  # OpenAI API integration
│   ├── goapi-handler.ts   # GoAPI/Midjourney integration
│   ├── fal-handler.ts     # fal.ai integration
│   ├── video-handler.ts   # Replicate video handler
│   ├── supabase-handler.ts # Database operations
│   ├── payment-handler.ts # Telegram Stars payments
│   ├── terms-handler.ts   # Terms of service flow
│   └── webhook-handler.ts # Webhook processing
│
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── replies/              # Message templates and responses
└── tasks/               # Cron jobs and scheduled tasks
```

## 🎮 User Interaction Patterns

### Command Structure
```typescript
// Basic commands
/start         # Initialize bot, show main keyboard
/help          # Show help message
/terms         # Show terms of service
/provider      # Switch image generation provider
/premium       # Show premium subscription options
/status        # Show user usage statistics

// Mode switching (via custom keyboard)
📝 Text Mode   # Switch to GPT-4 conversation mode
🎨 Photo Mode  # Switch to image generation mode
🎬 Video Mode  # Switch to video generation mode
```

### Message Flow Examples

**Text Mode Flow:**
```
User: "Hello" → GPT-4 Assistant → Response with conversation context
User: [Voice Message] → Whisper Transcription → GPT-4 → Response
User: [Image] → GPT-4 Vision → Image analysis in Russian
```

**Photo Mode Flow:**
```
User: "A cat in space" → Check provider → Generate image → Progress updates → Final image
User: "cat --ar 16:9 --fast" → Parse parameters → GoAPI with aspect ratio
```

**Video Mode Flow:**
```
User: "Flying bird" → Replicate API → Progress tracking → Video file
User: "sunset --res 720p --dur 10" → Parse parameters → Custom resolution/duration
```

## 🔧 Core Components Deep Dive

### 1. Message Handler (`src/handlers/msg-handler.ts`)
**Purpose**: Central routing for all incoming messages
```typescript
// Key functions to understand:
handleTextMessage()     // Routes text based on user mode
handleVoiceMessage()    // Processes voice with Whisper
handlePhotoMessage()    // Handles image uploads for analysis
handleCallbackQuery()   // Processes inline keyboard callbacks
handlePayments()        // Manages Telegram Stars payments
```

### 2. User Management (`src/findOrCreate.ts` + `src/handlers/supabase-handler.ts`)
**Purpose**: User lifecycle management with quota tracking
```typescript
// Key concepts:
interface TgUser {
  telegram_id: string;
  mode: 'text' | 'photo' | video';
  is_premium: boolean;
  text_requests_used: number;
  image_requests_used: number;
  video_requests_used: number;
  // ... more fields
}

// Usage patterns:
const user = await findOrCreateUser(telegramId);
await updateUserRequests(user.id, 'text', 1);
await checkUserLimits(user);
```

### 3. Flow System (`src/flows/`)
**Purpose**: Modular business logic for different AI services

Each flow follows a similar pattern:
```typescript
export async function processTextRequest(user: TgUser, message: string, bot: TgBotAdapter) {
  // 1. Validate user limits
  // 2. Process request with AI service
  // 3. Update usage counters
  // 4. Send response to user
  // 5. Handle errors gracefully
}
```

### 4. AI Service Handlers (`src/handlers/`)
**Purpose**: Abstracted interfaces to external AI APIs

Common patterns:
```typescript
// OpenAI Handler - GPT-4 conversations
export async function createChatCompletion(messages: Message[], userId: string)

// GoAPI Handler - Midjourney images  
export async function generateGoAPIImage(prompt: string, params?: ImageParams)

// fal.ai Handler - Fast image generation
export async function generateFalImage(prompt: string, params?: FalImageParams)

// Video Handlers - Video generation
export async function generateVideo(prompt: string, params?: VideoParams)
```

## 💾 Database Schema

### Primary Tables
```sql
-- Users table with quota tracking
gpt_tg_users (
  id: uuid PRIMARY KEY,
  telegram_id: text UNIQUE,
  username: text,
  mode: text DEFAULT 'text',
  is_premium: boolean DEFAULT false,
  premium_expires_at: timestamp,
  text_requests_used: integer DEFAULT 0,
  image_requests_used: integer DEFAULT 0,
  video_requests_used: integer DEFAULT 0,
  provider: text DEFAULT 'goapi',
  terms_accepted: boolean DEFAULT false,
  created_at: timestamp,
  updated_at: timestamp
);

-- Chat threads for conversation context
gpt_chat_threads (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES gpt_tg_users(id),
  thread_id: text,
  assistant_id: text,
  created_at: timestamp
);

-- Request tracking for analytics
gpt_requests (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES gpt_tg_users(id),
  request_type: text, -- 'text', 'image', 'video'
  provider: text,     -- 'openai', 'goapi', 'fal', 'replicate'
  prompt: text,
  success: boolean,
  error_message: text,
  processing_time: integer,
  created_at: timestamp
);

-- Payment transactions
payments (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES gpt_tg_users(id),
  amount: integer,    -- Telegram Stars amount
  currency: text DEFAULT 'XTR',
  status: text,       -- 'pending', 'completed', 'failed'
  telegram_payment_charge_id: text,
  created_at: timestamp
);
```

## 🔌 API Integrations

### OpenAI Integration
```typescript
// Located in: src/handlers/openai-handler.ts
// Features:
- GPT-4 chat completions with persistent threads
- Whisper voice transcription
- GPT-4 Vision for image analysis
- Automatic conversation context management

// Key functions:
await createChatCompletion(messages, userId);
await transcribeAudio(audioBuffer);
await analyzeImage(imageUrl, prompt);
```

### Image Generation Providers

**GoAPI (Midjourney)**
```typescript
// Located in: src/handlers/goapi-handler.ts
// Features:
- Artistic, high-quality images
- Upscaling and variations
- Parameter support: --ar, --fast, --turbo, --relax
- Batch generation capabilities

// Usage:
await generateGoAPIImage("cat in space", { aspectRatio: "16:9", mode: "fast" });
```

**fal.ai (Nano Banana)**
```typescript
// Located in: src/handlers/fal-handler.ts  
// Features:
- Fast photorealistic generation
- Excellent text understanding
- Multiple image formats
- Real-time progress tracking

// Usage:
await generateFalImage("realistic cat portrait", { num_images: 2 });
```

### Video Generation
```typescript
// Located in: src/handlers/video-handler.ts (Replicate)
// Located in: src/handlers/fal-video-handler.ts (fal.ai)
// Features:
- Multiple model support (Google Veo, etc.)
- Custom resolution, duration, FPS
- Progress tracking with webhooks
- Parameter parsing: --res, --dur, --fps, --hq

// Usage:
await generateVideo("bird flying", { resolution: "720p", duration: 10 });
```

## 💳 Payment System

### Telegram Stars Integration
```typescript
// Located in: src/handlers/payment-handler.ts
// Features:
- Native Telegram payment processing
- Pre-checkout validation
- Automatic premium upgrade
- Transaction logging

// Flow:
User clicks premium → Invoice created → Pre-checkout validation → Payment → Account upgrade

// Key functions:
await createInvoice(user, amount);
await handlePreCheckout(query);
await processSuccessfulPayment(payment);
```

## 🛠️ Development Patterns

### Error Handling
```typescript
// Standard pattern across all handlers:
try {
  const result = await externalAPICall();
  await updateUserUsage();
  await sendSuccessResponse(result);
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  await sendErrorResponse(user, error);
  await logError(error, context);
}
```

### User Limit Checking
```typescript
// Before any AI operation:
const canProceed = await checkUserLimits(user, requestType);
if (!canProceed) {
  await sendLimitExceededMessage(user);
  return;
}
```

### Progress Tracking
```typescript
// For long-running operations:
const progressMessage = await bot.sendMessage(chatId, "🔄 Processing...");
// Update progress periodically
await bot.editMessageText(chatId, progressMessage.message_id, "⏳ 50% complete...");
// Final update
await bot.editMessageText(chatId, progressMessage.message_id, "✅ Complete!");
```

## 🚀 Common Development Tasks

### Adding a New AI Provider
1. Create handler in `src/handlers/new-provider-handler.ts`
2. Add flow logic in `src/flows/new-provider-flow.ts`
3. Update message routing in `src/handlers/msg-handler.ts`
4. Add provider selection in user preferences
5. Update database schema if needed

### Adding New Commands
1. Add command handling in `src/handlers/msg-handler.ts`
2. Create response templates in `src/replies/`
3. Add command to help text
4. Test with both webhook and polling modes

### Modifying User Limits
1. Update environment variables for defaults
2. Modify quota checking logic in handlers
3. Update database schema if adding new limit types
4. Test premium vs free tier differences

### Adding Payment Features
1. Modify `src/handlers/payment-handler.ts`
2. Update invoice creation logic
3. Add new premium features checking
4. Test with Telegram's payment sandbox

## 🧪 Testing Patterns

### Manual Testing Checklist
```bash
# Text mode
- Basic conversation
- Voice message transcription  
- Image analysis
- Thread persistence

# Image mode
- GoAPI generation with parameters
- fal.ai generation
- Provider switching
- Progress tracking

# Video mode
- Basic video generation
- Parameter parsing
- Progress updates

# Payments
- Premium purchase flow
- Limit enforcement
- Account upgrades
```

### Environment Setup
```bash
# Development
npm run dev              # Watch mode with tsx
npm run dev:webhook     # Webhook mode with ngrok
npm run pm2:dev         # PM2 development mode

# Production
npm run build           # TypeScript compilation
npm run start           # Production mode
npm run pm2:prod        # PM2 production deployment
```

## 🔍 Debugging Tips

### Common Issues and Solutions

**Bot Not Responding**
- Check `TELEGRAM_BOT_TOKEN` validity
- Verify webhook URL accessibility
- Check console logs for startup errors

**AI Service Failures**
- Validate API keys in environment
- Check service status pages
- Review rate limiting and quotas
- Examine error logs in console

**Database Issues**
- Verify `SUPABASE_URL` and `SUPABASE_KEY`
- Check database connectivity
- Run `prisma generate` after schema changes
- Monitor database logs

**Payment Problems**
- Test in Telegram's payment sandbox first
- Verify bot has payment permissions
- Check `ENABLE_PAYMENTS` environment variable
- Review pre-checkout validation logic

### Logging and Monitoring
```typescript
// Standard logging pattern:
console.log(`[${new Date().toISOString()}] Operation started`);
console.error(`[ERROR] ${error.message}`, { context, stack: error.stack });

// Performance monitoring:
const startTime = Date.now();
// ... operation ...
console.log(`Operation completed in ${Date.now() - startTime}ms`);
```

## 🔐 Security Considerations

### API Key Management
- Store all keys in environment variables
- Never commit keys to version control
- Use different keys for development/production
- Rotate keys regularly

### User Data Protection
- Minimal data collection
- Secure database connections
- Regular cleanup of old data
- GDPR compliance considerations

### Rate Limiting
- Implement per-user request limits
- Monitor for abuse patterns
- Graceful degradation under load
- External API quota management

## 🚢 Deployment Configurations

### Docker Deployment
```dockerfile
# Dockerfile present with multi-stage build
# Use with docker-compose.yml for full stack
docker-compose up -d
```

### PM2 Process Management
```bash
# Production deployment
npm run pm2:prod

# Development with auto-restart
npm run pm2:dev

# Webhook server only
npm run pm2:webhook:server
```

### Environment Variables
```env
# Required for basic operation
TELEGRAM_BOT_TOKEN=
OPENAI_API_KEY=
OPENAI_ASSISTANT_ID=
GOAPI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Optional for extended features
REPLICATE_API_TOKEN=
FAL_KEY=
WEBHOOK_URL=
ENABLE_PAYMENTS=true
```

This documentation should provide AI agents with comprehensive understanding of the TG BrainAI Bot architecture, patterns, and development practices for effective code generation and problem-solving.