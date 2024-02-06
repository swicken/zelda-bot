import { Client, GatewayIntentBits, TextChannel, DMChannel } from 'discord.js';
import dotenv from 'dotenv';
import * as storage from './storage.js';
import RSSParser from 'rss-parser';
dotenv.config();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
const rssParser = new RSSParser();
const filters = ['zelda', 'a link to the past', 'ocarina of time', 'majora\'s mask', 'wind waker', 'twilight princess', 'skyward sword', 'breath of the wild', 'link\'s awakening', 'phantom hourglass', 'spirit tracks', 'a link between worlds', 'triforce heroes', 'the legend of zelda', 'the adventure of link', 'the minish cap', 'four swords', 'four swords adventures', 'the wind waker hd', 'twilight princess hd', 'the wind waker hd', 'the wind waker', 'twilight princess', 'twilight princess', 'skyward sword', 'breath of the wild', 'tears of the kingdom'];
const rssFeedUrl = 'https://www.kotaku.com/rss';
client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    storage.connectDb();
    checkRssFeed();
    setInterval(checkRssFeed, 120000); // Check the RSS feed every 2 minutes
});
async function checkRssFeed() {
    try {
        const feed = await rssParser.parseURL(rssFeedUrl);
        for (const item of feed.items) {
            const guilds = await storage.getGuildsWithChannel();
            guilds.forEach(async (guild) => {
                //check if title, description, or categories contain any of the filters
                const title = item.title?.toLowerCase();
                const description = item.description?.toLowerCase();
                const categories = item.categories?.map(category => category.toLowerCase());
                const containsFilter = filters.some(filter => title?.includes(filter) || description?.includes(filter) || categories?.includes(filter));
                if (!containsFilter)
                    return;
                const channel = await client.channels.fetch(guild.channelId);
                // Check if the channel is a text channel or DM channel
                if (channel instanceof TextChannel || channel instanceof DMChannel) {
                    const hasBeenPosted = await storage.hasStoryBeenPosted(guild.guildId, item.guid);
                    if (!hasBeenPosted && channel) {
                        await channel.send(`**${item.title}**\n${item.link}`);
                        await storage.savePostedStory(guild.guildId, item.guid);
                    }
                }
            });
        }
    }
    catch (error) {
        console.error('Error checking RSS feed:', error);
    }
}
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot)
        return;
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
