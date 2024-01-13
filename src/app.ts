// Dynamic import for CommonJS modules in ES Module context
import { Client, GatewayIntentBits, TextChannel, DMChannel } from 'discord.js';

import dotenv from 'dotenv';
import * as storage from './storage.js'; 
import RSSParser from 'rss-parser';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const rssParser = new RSSParser();
const rssFeedUrl: string = 'https://www.kotaku.com/rss';

client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    storage.connectDb();
    checkRssFeed();
    setInterval(checkRssFeed, 120000); // Check the RSS feed every 2 minutes
});

async function checkRssFeed(): Promise<void> {
    try {
        const feed = await rssParser.parseURL(rssFeedUrl);
        for (const item of feed.items) {
            const guilds = await storage.getAllGuilds();
            for (const guildId of guilds) {
                const channelId = await storage.getGuildChannel(guildId);

                // Check if the channel ID exists, otherwise there is nowhere to send the message
                if (!channelId) {
                    console.error(`No channel ID found for guild ID ${guildId}`);
                    continue;
                }
                const channel = await client.channels.fetch(channelId);
                // Check if the channel is a text channel or DM channel
                if (channel instanceof TextChannel || channel instanceof DMChannel) {
                    const hasBeenPosted = await storage.hasStoryBeenPosted(guildId, item.guid as string);
                    if (!hasBeenPosted && channel) {
                        await channel.send(`**${item.title}**\n${item.link}`);
                        await storage.savePostedStory(guildId, item.guid as string);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking RSS feed:', error);
    }
}

client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    if (message.content.startsWith('!startGameUpdates')) {
        await storage.saveGuildChannel(message.guild.id, message.channel.id);
        message.reply('Updates will be sent to this channel.');
    }

    if (message.content.startsWith('!stopGameUpdates')) {
        await storage.removeGuildChannel(message.guild.id);
        message.reply('Updates will be stopped for this channel.');
    }
});

client.login(process.env.DISCORD_TOKEN);
