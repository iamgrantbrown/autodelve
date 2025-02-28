# AutoDelve
A simple AI-powered Discord bot that answers questions based on a set of documents.

**View the demo here: [Twitter/X Demo](https://x.com/0xSamHogan/status/1894937763717550272)**

## Overview

AutoDelve is a Discord bot that helps users find information from documentation without having to search through it manually. The bot:

1. Crawls and indexes websites, converting HTML to Markdown
2. Uses OpenAI's GPT models to answer questions based on the indexed content
3. Provides helpful responses with references to the relevant documentation
4. Gives feedback when it cannot answer a question

## Setup

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0.0 or higher)
- OpenAI API key
- Discord bot token and related credentials

```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash
source ~/.bash_profile  # or ~/.zshrc depending on your shell

# Install dependencies
bun install
```

### Create a `.env` file

```bash
cp .env.example .env
```

Edit the `.env` file with your own values:

```
OPENAI_API_KEY=your_openai_api_key
DISCORD_PERMISSIONS=your_discord_permissions
DISCORD_APP_ID=your_discord_app_id
DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_BOT_TOKEN=your_discord_bot_token
```

## Usage

### Index a website

```bash
bun run index.ts download https://your-documentation-site.com
```

This command will:
1. Download the website content
2. Convert the HTML to Markdown
3. Save the content to the `content/website_content.json` file

### Ask questions via command line

Once a website has been indexed, you can ask questions to the AI by running:

```bash
bun run index.ts ask "Your question about the documentation?"
```

The response will be streamed to the console.

### Run as a Discord bot

1. Create a Discord bot on the [Discord Developer Portal](https://discord.com/developers/applications)
   - Enable the "Message Content Intent" under the Bot tab
   - Generate a bot token and add it to your `.env` file

2. Invite the bot to your server using the OAuth2 URL generator:
   - Select "bot" scope
   - Select permissions: "Read Messages/View Channels", "Send Messages", "Read Message History"

3. Run the bot with:

```bash
source ~/.bash_profile  # If bun is not in your PATH
bun index.ts
```

4. In your Discord server, simply ask questions and the bot will respond if it can find relevant information in the indexed documentation.

## Deployment Options

### Option 1: Run on a VPS (Virtual Private Server)

1. Set up a VPS on DigitalOcean, AWS, etc.
2. Install Bun and clone the repository
3. Set up your `.env` file
4. Use PM2 to keep the bot running:
   ```bash
   npm install -g pm2
   pm2 start --interpreter ~/.bun/bin/bun index.ts
   pm2 startup
   pm2 save
   ```

### Option 2: Use a Container Platform

1. Create a Dockerfile:
   ```dockerfile
   FROM oven/bun:latest
   WORKDIR /app
   COPY package.json bun.lockb ./
   RUN bun install
   COPY . .
   CMD ["bun", "index.ts"]
   ```

2. Deploy to platforms like Fly.io, Heroku, or Google Cloud Run

## Troubleshooting

### Common Issues

- **"command not found: bun"**: Run `source ~/.bash_profile` or add Bun to your PATH
- **Discord connection issues**: Make sure you've enabled the Message Content Intent in the Discord Developer Portal
- **Bot not responding to questions**: Check if the question is related to the indexed documentation
- **"Port scan timeout reached, no open ports detected"**: This error occurs on some deployment platforms that require services to bind to a port. The latest version of AutoDelve includes an HTTP server that listens on the port specified by the `PORT` environment variable (defaults to 3000). Make sure you're using the latest version of the code.

### Deployment Platform-Specific Notes

#### Render, Fly.io, and similar platforms
These platforms require your application to bind to a port specified by the `PORT` environment variable. The bot now includes a simple HTTP server that listens on this port to satisfy this requirement. No additional configuration is needed.

#### Railway
For Railway deployments, make sure to set the `PORT` environment variable in your project settings.

## Security

AutoDelve includes several security features to protect your bot and users:

### Environment Variable Validation
- Validates required environment variables at startup
- Prevents the bot from running with missing credentials

### Rate Limiting
- Discord message rate limiting (5 requests per minute per user)
- HTTP server rate limiting (30 requests per minute per IP)
- Prevents abuse and excessive API costs

### Input Validation
- Sanitizes user input to remove control characters
- Limits question length to 500 characters
- Prevents potential injection attacks

### Access Control
- Optional role-based access control for Discord
- Set `REQUIRED_ROLE_ID` in your `.env` file to restrict bot usage to users with a specific role
- Set `ALLOW_DMS=true` to allow direct messages to the bot

### HTTP Security Headers
- Implements security headers on the HTTP server
- Prevents common web vulnerabilities

### Additional Environment Variables

```
# Optional security settings
REQUIRED_ROLE_ID=your_discord_role_id  # Restrict bot to users with this role
ALLOW_DMS=true                         # Allow direct messages to the bot
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

[MIT License](LICENSE)
