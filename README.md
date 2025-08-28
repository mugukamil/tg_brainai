# TG BrainAI Bot

A comprehensive Telegram bot that provides AI-powered text generation, image creation, and video generation services. This Node.js implementation is a complete port of the original n8n workflow, featuring OpenAI GPT-4 integration, GoAPI Midjourney support, Replicate video generation, and Telegram payments.

## 🌟 Features

### 🤖 Text Mode (ChatGPT)
- **AI Conversations**: Powered by OpenAI GPT-4 with persistent conversation threads
- **Voice Processing**: Automatic transcription using Whisper API
- **Image Analysis**: Analyze uploaded images with detailed descriptions in Russian
- **Thread Management**: Maintains conversation context across sessions
- **Smart Responses**: Contextual AI responses with markdown formatting

### 🎨 Photo Mode (Image Generation)
- **AI Image Generation**: Create stunning images using Midjourney via GoAPI
- **Advanced Parameters**: Support for aspect ratios, processing modes, and quality settings
- **Batch Generation**: Generate 4 unique images in a 2x2 grid
- **Image Actions**: Upscale individual images from the grid
- **Real-time Progress**: Live status tracking with visual progress indicators
- **Parameter Support**: `--ar 16:9`, `--fast`, `--turbo`, `--relax`

### 🎬 Video Mode (Video Generation)
- **AI Video Generation**: Create videos using Replicate's advanced models
- **Flexible Parameters**: Control resolution, duration, and frame rate
- **Multiple Models**: Support for Google Veo and other video generation models
- **Progress Tracking**: Real-time status updates during generation
- **Parameter Support**: `--res 720p`, `--dur 10`, `--fps 30`, `--hq`

### 💰 Payment System
- **Telegram Stars Integration**: Native Telegram payment processing
- **Premium Subscriptions**: Monthly premium plans with increased limits
- **Automatic Upgrades**: Seamless account upgrade after payment
- **Payment Security**: Secure pre-checkout validation
- **Flexible Pricing**: Easy to configure pricing tiers

### 📋 Terms of Service
- **Legal Compliance**: Built-in terms acceptance flow
- **User Protection**: Clear usage guidelines and restrictions
- **Interactive Approval**: Inline keyboard for terms acceptance
- **Content Policies**: Automated enforcement of usage policies

### 🔧 Advanced Features
- **User Management**: Complete user lifecycle management with Supabase
- **Request Tracking**: Granular tracking of text, image, and video requests
- **Error Handling**: Comprehensive error recovery and user feedback
- **Rate Limiting**: Intelligent request management and quota enforcement
- **Keyboard UI**: Custom reply keyboards for easy mode switching
- **Multi-language**: Russian language support throughout the interface

## 🚀 Quick Start

### Prerequisites
- **Node.js 16+** installed
- **Telegram Bot Token** from [@BotFather](https://t.me/botfather)
- **OpenAI API Key** with GPT-4 and Assistant access
- **GoAPI API Key** for Midjourney integration
- **Replicate API Token** for video generation
- **Supabase Project** for user management

### Installation

1. **Clone and setup**
```bash
git clone <your-repo-url>
cd tg-brainai
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id
GOAPI_API_KEY=your_goapi_api_key
REPLICATE_API_TOKEN=your_replicate_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

3. **Setup database**
```sql
CREATE TABLE gpt_tg_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    openai_thread_id VARCHAR(255),
    current_mode VARCHAR(20) DEFAULT 'text_req_left',
    text_req_left INTEGER DEFAULT 100,
    image_req_left INTEGER DEFAULT 10,
    video_req_left INTEGER DEFAULT 5,
    accepted_terms BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

4. **Test and start**
```bash
# Test GoAPI integration
npm run test:goapi

# Start the bot
npm start
```

### Run with Traefik (HTTPS, no ngrok)

1. Point a DNS record to your server, e.g. `A bot.example.com -> YOUR_IP`.
2. Create `.env` with:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
WEBHOOK_HOST=bot.example.com
WEBHOOK_PUBLIC_URL=https://bot.example.com
ACME_EMAIL=you@example.com
```
3. Build and run:
```bash
docker compose up -d --build
```
Traefik will fetch certificates via Let's Encrypt and expose the app at `https://$WEBHOOK_HOST`.

## 📱 Usage

### Basic Commands
- **Start**: Welcome message with mode selection keyboard
- **📝 ChatGPT**: Switch to text mode for AI conversations
- **🎨 Генерация изображений**: Switch to image generation mode
- **🎬 Генерация видео**: Switch to video generation mode
- **✨ Премиум**: View pricing and upgrade options
- **/status**: Check remaining requests and account status
- **/help**: Display detailed help information

### Text Mode Usage
```
Hello, how can I help you today?
Расскажи мне о квантовых компьютерах
```

Send voice messages for automatic transcription and AI response.
Upload images with captions for detailed analysis in Russian.

### Photo Mode Usage
```
# Basic generation
a serene lake surrounded by mountains at sunset

# With parameters
cyberpunk street scene with neon lights --ar 16:9 --fast
portrait of a cat in renaissance style --ar 3:4 --turbo
abstract geometric patterns --ar 21:9 --relax
```

**Supported Aspect Ratios:**
- `1:1` - Square (default)
- `16:9` - Widescreen
- `3:4` - Portrait
- `4:3` - Landscape
- `21:9` - Ultra-wide
- And 8 more options

**Processing Modes:**
- `--fast` - Quick generation (uses fast hours)
- `--turbo` - Fastest generation (premium speed)
- `--relax` - Slower but cost-effective

### Video Mode Usage
```
# Basic generation
a cat walking in a garden

# With parameters
space battle with starships --res 720p --dur 10 --fps 30
dancing robot in cyberpunk city --res 1080p --dur 5 --hq
ocean waves crashing on rocks --dur 15
```

**Supported Parameters:**
- `--res 480p|720p|1080p` - Resolution
- `--dur 1-30` - Duration in seconds
- `--fps 12-60` - Frames per second
- `--hq` - High quality (slower generation)

### Image Actions
After image generation:
- **1, 2, 3, 4** - Select image to upscale
- Images are automatically numbered in the 2x2 grid
- Upscaled images maintain original quality and style

## 💳 Payment System

### Free Plan
- 100 text requests/month
- 10 image generations/month
- 5 video generations/month

### Premium Plan (100 ⭐ Telegram Stars)
- 1000 text requests/month
- 100 image generations/month
- 50 video generations/month
- Priority processing
- Early access to new features

### How to Buy
1. Click **✨ Премиум** button
2. Select **⭐ Купить Премиум (100 ⭐)**
3. Complete payment with Telegram Stars
4. Account automatically upgraded

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│  Telegram Bot   │ -> │ Message      │ -> │ Handler     │
│  (tg-bot.js)    │    │ Router       │    │ Functions   │
└─────────────────┘    │ (msg-        │    │             │
                       │ handler.js)  │    └─────────────┘
                       └──────────────┘           │
                              │                   │
                    ┌─────────┼─────────┐        │
                    │         │         │        │
             ┌──────v──┐  ┌───v───┐  ┌──v──────┐ │
             │ OpenAI  │  │GoAPI  │  │Supabase │ │
             │Handler  │  │Handler│  │Handler  │ │
             └─────────┘  └───────┘  └─────────┘ │
                    │         │         │        │
               ┌────v────┐ ┌──v──┐ ┌────v───┐   │
               │ GPT-4   │ │ MJ  │ │Database│   │
               │ Whisper │ │ API │ │        │   │
               │ Vision  │ │     │ │        │   │
               └─────────┘ └─────┘ └────────┘   │
                              │                   │
        ┌─────────────────────┼───────────────────┘
        │                     │
   ┌────v────┐         ┌──────v──────┐         ┌────────────┐
   │Replicate│         │  Payment    │         │   Terms    │
   │Video API│         │  Handler    │         │  Handler   │
   └─────────┘         └─────────────┘         └────────────┘
```

## 🔧 Configuration

### Environment Variables

**Required:**
```env
TELEGRAM_BOT_TOKEN=          # Bot token from @BotFather
OPENAI_API_KEY=              # OpenAI API key
OPENAI_ASSISTANT_ID=         # OpenAI Assistant ID
GOAPI_API_KEY=               # GoAPI key for Midjourney
SUPABASE_URL=                # Supabase project URL
SUPABASE_ANON_KEY=           # Supabase anonymous key
```

**Optional:**
```env
REPLICATE_API_TOKEN=         # For video generation
DEFAULT_TEXT_REQUESTS=100    # Free plan text limit
DEFAULT_IMAGE_REQUESTS=10    # Free plan image limit
DEFAULT_VIDEO_REQUESTS=5     # Free plan video limit
ENABLE_PAYMENTS=true         # Enable payment system
LOG_LEVEL=info               # Logging level
```

### Database Schema

The bot requires a PostgreSQL database with the following structure:

```sql
-- Main users table
CREATE TABLE gpt_tg_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    openai_thread_id VARCHAR(255),
    current_mode VARCHAR(20) DEFAULT 'text_req_left',
    text_req_left INTEGER DEFAULT 100,
    image_req_left INTEGER DEFAULT 10,
    video_req_left INTEGER DEFAULT 5,
    accepted_terms BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_telegram_id ON gpt_tg_users(telegram_id);
CREATE INDEX idx_premium_status ON gpt_tg_users(is_premium);
CREATE INDEX idx_created_at ON gpt_tg_users(created_at);
```

## 🚨 Error Handling

The bot includes comprehensive error handling:

### API Timeouts
- Automatic retry for failed requests
- Graceful degradation when services are unavailable
- User-friendly timeout messages

### Rate Limiting
- Request quota enforcement
- Clear messaging about remaining requests
- Automatic request count updates

### Payment Errors
- Pre-checkout validation
- Payment failure recovery
- Clear error messages for users

### Content Filtering
- Terms of service enforcement
- Automatic content policy checks
- Safe prompt validation

## 🧪 Testing

### Test GoAPI Integration
```bash
npm run test:goapi
```

This will test:
- API connectivity
- Image generation
- Status polling
- Upscale functionality

### Manual Testing Checklist
- [ ] Bot starts without errors
- [ ] Text mode responds to messages
- [ ] Voice messages are transcribed
- [ ] Image analysis works
- [ ] Photo mode generates images
- [ ] Image upscaling works
- [ ] Video mode generates videos (if enabled)
- [ ] Payment flow works
- [ ] Terms acceptance works
- [ ] Mode switching works
- [ ] Keyboard buttons work

## 📊 Monitoring

### Logs
The bot logs all major events:
- User registrations
- Mode switches
- Generation requests
- Payment events
- Errors and warnings

### Metrics to Track
- Daily active users
- Request distribution (text/image/video)
- Payment conversion rate
- Error rates by feature
- Response times

## 🛠 Development

### Adding New Features
1. Create handler in appropriate file
2. Update message router
3. Add database migrations if needed
4. Update tests
5. Update documentation

### Code Structure
```
tg-brainai/
├── goapi-handler.js      # Midjourney image generation
├── video-handler.js      # Replicate video generation
├── openai-handler.js     # OpenAI integration
├── supabase-handler.js   # Database operations
├── payment-handler.js    # Telegram payments
├── terms-handler.js      # Terms of service
├── msg-handler.js        # Main message routing
├── tg-bot.js            # Telegram bot setup
├── index.js             # Application entry point
└── test-goapi.js        # API testing
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Update documentation
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

### Common Issues

**Bot not responding:**
- Check bot token validity
- Verify bot is started with `npm start`
- Check console for error messages

**Image generation fails:**
- Verify GoAPI key is valid and has credits
- Check if prompt violates content policies
- Try simpler prompts or different parameters

**Video generation not working:**
- Ensure Replicate API token is set
- Check if video generation is enabled
- Verify model availability

**Payment issues:**
- Confirm Telegram Stars are available
- Check bot has payment permissions
- Verify webhook configuration

**Database errors:**
- Check Supabase connection settings
- Ensure required tables exist
- Verify database permissions

### Getting Help
- Check the troubleshooting section
- Review error logs in console
- Test individual components
- Contact support with specific error messages

## 🔮 Roadmap

### Planned Features
- [ ] Group chat support
- [ ] Image editing capabilities
- [ ] Video editing features
- [ ] Custom AI model fine-tuning
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] API webhooks
- [ ] Admin panel

### Performance Improvements
- [ ] Request caching
- [ ] Database optimization
- [ ] CDN integration for media
- [ ] Load balancing support

---

**Made with ❤️ using Node.js, OpenAI, GoAPI, and Replicate**

*This implementation is a complete port of the original n8n workflow with additional enhancements for production use.*
