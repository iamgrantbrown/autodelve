import {
  Client,
  GatewayIntentBits,
  Message,
  Partials
} from "discord.js";
import { ask } from "./ask";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

// Rate limiting implementation
const userRateLimits = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const userRequests = userRateLimits.get(userId) || 0;
  
  if (userRequests >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  userRateLimits.set(userId, userRequests + 1);
  
  // Reset rate limit after window expires
  setTimeout(() => {
    const currentRequests = userRateLimits.get(userId) || 0;
    userRateLimits.set(userId, Math.max(0, currentRequests - 1));
  }, RATE_LIMIT_WINDOW);
  
  return false;
}

/**
 * Stores a question-answer pair in a JSONL file on disk
 * @param question The user's question
 * @param answer The bot's answer
 */
function storeMessage(question: string, answer: string): void {
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "logs");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, "answers.jsonl");

  // Create a record with timestamp
  const record = {
    timestamp: new Date().toISOString(),
    question,
    answer
  };

  // Append the JSON record as a new line to the file
  appendFileSync(filePath, JSON.stringify(record) + "\n");

  console.log(`Stored Q&A pair in ${filePath}`);
}

/**
 * Checks if a user has permission to use the bot
 * @param message The Discord message
 * @returns Boolean indicating if the user has permission
 */
function hasPermission(message: Message): boolean {
  // Check if user has a specific role
  const requiredRoleId = process.env.REQUIRED_ROLE_ID;
  
  // If no required role is configured, allow all users
  if (!requiredRoleId) return true;
  
  // DMs don't have member info, so we need to handle that case
  if (!message.guild || !message.member) {
    // For DMs, check if we want to allow them based on environment variable
    return process.env.ALLOW_DMS === 'true';
  }
  
  // Check if the user has the required role
  return message.member.roles.cache.has(requiredRoleId);
}

/**
 * Splits a long message into multiple parts that fit within Discord's character limit
 * @param content The message content to split
 * @param maxLength Maximum length for each part (default: 1900 to leave room for part indicators)
 * @returns Array of message parts
 */
function splitLongMessage(content: string, maxLength: number = 1900): string[] {
  if (!content || content.length <= maxLength) {
    return [content];
  }

  const parts: string[] = [];
  let currentPart = '';
  
  // Split by paragraphs first (try to keep logical sections together)
  const paragraphs = content.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // If a single paragraph is too long, we'll need to split it
    if (paragraph.length > maxLength) {
      // If current part has content, push it to parts array
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
      
      // Split the long paragraph
      let remainingText = paragraph;
      while (remainingText.length > 0) {
        // Find a good breaking point (preferably at a sentence end)
        let breakPoint = maxLength;
        if (remainingText.length > maxLength) {
          // Try to find a sentence end (., !, ?) within the last 200 characters of the limit
          const searchArea = remainingText.substring(maxLength - 200, maxLength);
          const lastSentenceEnd = Math.max(
            searchArea.lastIndexOf('. '),
            searchArea.lastIndexOf('! '),
            searchArea.lastIndexOf('? ')
          );
          
          if (lastSentenceEnd !== -1) {
            breakPoint = maxLength - 200 + lastSentenceEnd + 2; // +2 to include the period and space
          } else {
            // If no sentence end, try to break at a space
            const lastSpace = remainingText.lastIndexOf(' ', maxLength);
            if (lastSpace !== -1) {
              breakPoint = lastSpace + 1; // +1 to include the space
            }
          }
        }
        
        parts.push(remainingText.substring(0, breakPoint));
        remainingText = remainingText.substring(breakPoint);
      }
    } else if (currentPart.length + paragraph.length + 2 > maxLength) {
      // If adding this paragraph would exceed the limit, start a new part
      parts.push(currentPart);
      currentPart = paragraph;
    } else {
      // Add paragraph to current part
      if (currentPart) {
        currentPart += '\n\n' + paragraph;
      } else {
        currentPart = paragraph;
      }
    }
  }
  
  // Add the last part if there's anything left
  if (currentPart) {
    parts.push(currentPart);
  }
  
  // Add part indicators if there are multiple parts
  if (parts.length > 1) {
    return parts.map((part, index) => `[Part ${index + 1}/${parts.length}]\n\n${part}`);
  }
  
  return parts;
}

/**
 * Connects the Discord bot to the Discord API
 * @returns The Discord client instance
 */
export async function connect(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on("ready", () => {
    console.log(`Logged in as ${client.user!.tag}!`);
  });

  client.on("debug", console.log);
  client.on("warn", console.log);
  client.on("error", console.error);

  client.on("messageCreate", async (message: Message) => {
    
    // Ignore messages from the bot itself
    if (message.author.id === client.user!.id) return;

    // Check if user is rate limited
    if (isRateLimited(message.author.id)) {
      message.reply("You're sending too many requests. Please wait a moment before asking another question.");
      return;
    }
    
    // Check if user has permission to use the bot
    if (!hasPermission(message)) {
      message.reply("You don't have permission to use this bot. Please contact an administrator if you believe this is an error.");
      return;
    }

    // console.log(message.content);
    console.log(
      `Received message: "${message.content}" from ${message.author.tag} in channel ${message.channel.id} (${message.channel.type})`,
    );
    const content = message.content;
    const answer = await ask(content);

    if (answer) {
      storeMessage(content, answer);
      
      // Split long messages to avoid Discord's character limit
      const messageParts = splitLongMessage(answer);
      
      // Send each part as a separate message
      for (const part of messageParts) {
        try {
          await message.reply(part);
        } catch (error) {
          console.error('Error sending message part:', error);
          // If we still have an error, send a simplified message
          if (messageParts.length > 1) {
            try {
              await message.reply("I've prepared a detailed answer, but it's too long for Discord. Please ask a more specific question for a shorter response.");
            } catch (innerError) {
              console.error('Error sending fallback message:', innerError);
            }
            break; // Stop trying to send more parts
          }
        }
      }
    } else {
      // Provide feedback when the bot decides not to answer
      message.reply("I'm sorry, but I don't have enough information in my knowledge base to answer that question. Please try asking something related to the Private AI documentation.");
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log("Autodelve is now running...");
  return client;
}

/**
 * Lists all channels the bot has access to (can view and send messages)
 * @param client The Discord client instance
 */
export function listAccessibleChannels(client: Client): void {
  console.log("Channels the bot has access to:");

  client.guilds.cache.forEach(guild => {
    console.log(`\nGuild: ${guild.name} (${guild.id})`);

    // Get the bot's member object in this guild
    const botMember = guild.members.cache.get(client.user!.id);

    guild.channels.cache.forEach(channel => {
      // Only check text-based channels
      if (channel.isTextBased()) {
        const canView = channel.permissionsFor(botMember!)?.has('ViewChannel');
        const canSend = channel.permissionsFor(botMember!)?.has('SendMessages');

        if (canView && canSend) {
          console.log(`  ✅ ${channel.name} (${channel.id}) - Can view and send`);
        } else if (canView) {
          console.log(`  👁️ ${channel.name} (${channel.id}) - Can view only`);
        } else {
          console.log(`  ❌ ${channel.name} (${channel.id}) - No access`);
        }
      }
    });
  });
}

// Removed Node.js specific check that doesn't work in Bun
// if (require.main === module) {
//   connect().catch(console.error);
// }
