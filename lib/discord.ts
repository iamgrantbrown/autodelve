import { readFileSync } from "fs";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Message,
  Partials,
} from "discord.js";
import { ask } from "./ask";


// const STREAMING_INDICATOR = " ⚪";

type MessageRole = "assistant" | "user" | "system";

type MessageHistoryEntry = {
  role: MessageRole;
  content: string;
  timestamp: number;
  userId: string;
};

const messageHistory = new Map<string, MessageHistoryEntry[]>(); // In-memory message history map

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message], // Remove to disable DMs
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user!.tag}!`);
  // listAccessibleChannels(client);
});

client.on("debug", console.log);
client.on("warn", console.log);
client.on("error", console.error);

client.on("messageCreate", async (message: Message) => {

  // console.log(message.content);
  console.log(
    `Received message: "${message.content}" from ${message.author.tag} in channel ${message.channel.id} (${message.channel.type})`,
  );

  if (message.author.tag === 'samhogan') {
    const content = message.content;

    const answer = await ask(content);
    message.reply(answer);
  }

});


/**
 * Connects the Discord bot to the Discord API
 * @returns The Discord client instance
 */
export async function connect(): Promise<Client> {
  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log("Kuzco Discord LLM Chat bot is now running...");
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

// If this file is run directly, connect the bot
if (require.main === module) {
  connect().catch(console.error);
}
