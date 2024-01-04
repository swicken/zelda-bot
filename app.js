import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import * as storage from './storage.js';
import RSSParser from 'rss-parser';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const rssParser = new RSSParser();
const rssFeedUrl = 'https://www.kotaku.com/rss'; // Replace with your RSS feed URL

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    storage.connectDb();
    checkRssFeed();
    // Check the RSS feed every 30 seconds
    setInterval(checkRssFeed, 30000);
});

async function checkRssFeed() {
    try {
        const feed = await rssParser.parseURL(rssFeedUrl);
        for (let item of feed.items) {
            let guilds = await storage.getAllGuilds();
            for (let guildId of guilds) {
                let channelId = await storage.getGuildChannel(guildId);
                let channel = await client.channels.fetch(channelId);
                let hasBeenPosted = await storage.hasStoryBeenPosted(guildId, item.guid);

                if (!hasBeenPosted && channel) {
                    await channel.send(`**${item.title}**\n${item.link}`);
                    await storage.savePostedStory(guildId, item.guid);
                }
            }
        }
    } catch (error) {
        console.error('Error checking RSS feed:', error);
    }
}

client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    if (message.content.startsWith('!startUpdates')) {
        await storage.saveGuildChannel(message.guild.id, message.channel.id);
        message.reply('Updates will be sent to this channel.');
    }

    if (message.content.startsWith('!stopUpdates')) {
        await storage.removeGuildChannel(message.guild.id);
        message.reply('Updates will be stopped for this channel.');
    }
});

client.login(process.env.DISCORD_TOKEN);
