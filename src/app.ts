import { Client, GatewayIntentBits, TextChannel, DMChannel, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import * as storage from './storage.js';
import RSSParser from 'rss-parser';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Worker, isMainThread, parentPort, workerData, MessagePort } from 'worker_threads';
import { Story } from './models.js';
import * as cheerio from 'cheerio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultKeywords = ['zelda', 'a link to the past', 'ocarina of time', "majora's mask", 'wind waker', 'twilight princess', 'skyward sword', 'breath of the wild', "link's awakening", 'phantom hourglass', 'spirit tracks', 'a link between worlds', 'triforce heroes', 'the legend of zelda', 'the adventure of link', 'the minish cap', 'four swords', 'four swords adventures', 'the wind waker hd', 'twilight princess hd', 'the wind waker hd', 'the wind waker', 'twilight princess', 'twilight princess', 'skyward sword', 'breath of the wild', 'tears of the kingdom'];

const rssFeeds = JSON.parse(readFileSync(join(__dirname, 'rssFeeds.json'), 'utf8'));

export function getSourceFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '').split('.')[0];
    } catch (error) {
        console.error('Error parsing URL:', error);
        return 'Unknown Source';
    }
}

if (isMainThread && process.env.NODE_ENV !== 'test') {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    const numWorkers = 4; // Adjust based on your needs and server capacity

    async function registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('startgameupdates')
                .setDescription('Receive Zelda news updates in this channel'),
            new SlashCommandBuilder()
                .setName('stopgameupdates')
                .setDescription('Stop receiving Zelda news updates in this channel'),
            new SlashCommandBuilder()
                .setName('addkeyword')
                .setDescription('Add a keyword for this server')
                .addStringOption(opt => opt.setName('keyword').setDescription('Keyword to add').setRequired(true)),
            new SlashCommandBuilder()
                .setName('removekeyword')
                .setDescription('Remove a keyword for this server')
                .addStringOption(opt => opt.setName('keyword').setDescription('Keyword to remove').setRequired(true)),
            new SlashCommandBuilder()
                .setName('listkeywords')
                .setDescription('List configured keywords for this server'),
            new SlashCommandBuilder()
                .setName('clearkeywords')
                .setDescription('Remove all keywords for this server'),
            new SlashCommandBuilder()
                .setName('restorekeywords')
                .setDescription('Restore default keywords for this server')
        ];

        await client.application?.commands.set(commands.map(c => c.toJSON()));
    }

    client.on('ready', async () => {
        console.log(`Logged in as ${client.user?.tag}!`);
        storage.connectDb();
        await registerCommands();
        startRssFeedChecking();
    });

    function startRssFeedChecking() {
        const feedsPerWorker = Math.ceil(rssFeeds.feeds.length / numWorkers);
        for (let i = 0; i < numWorkers; i++) {
            const workerFeeds = rssFeeds.feeds.slice(i * feedsPerWorker, (i + 1) * feedsPerWorker);
            const worker = new Worker(__filename, {
                workerData: { feeds: workerFeeds },
                execArgv: process.execArgv
            });

            worker.on('message', async (message: { type: string, story: Story }) => {
                if (message.type === 'newStory') {
                    await processNewStory(message.story);
                }
            });

            worker.on('error', (error) => {
                console.error(`Worker error:`, error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                }
            });
        }
    }

    async function getImageUrlFromArticle(url: string): Promise<string | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
    
        try {
            const response = await fetch(url, { signal: controller.signal });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            let imageUrl = $('meta[property="og:image"]').attr('content') ||
                           $('meta[name="twitter:image"]').attr('content') ||
                           $('img').first().attr('src');
            
            return imageUrl || null;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.error('Request timed out for URL:', url);
            } else {
                console.error('Error fetching image from article:', error);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }
    
    
    async function processNewStory(story: Story) {
        const guilds = await storage.getGuildsWithChannel();
        const keywordMap = await storage.getAllGuildKeywords();
        const postedStories = [];
        for (const guild of guilds) {
            try {
                const channel = await client.channels.fetch(guild.channelId);
                if (channel instanceof TextChannel || channel instanceof DMChannel) {
                    const hasBeenPosted = await storage.hasStoryBeenPosted(guild.guildId, story.guid);
                    const entry = keywordMap.find(k => k.guildId === guild.guildId);
                    const keywords = entry ? entry.keywords : defaultKeywords;
                    if (!hasBeenPosted && storyMatchesKeywords(story, keywords)) {
                        const imageUrl = await getImageUrlFromArticle(story.link);
                        const sourceSite = getSourceFromUrl(story.link);
                        
                        const embed = new EmbedBuilder()
                            .setColor('#FFA500')  // Zelda-inspired orange color
                            .setTitle(story.title)
                            .setURL(story.link)
                            .setDescription(story.contentSnippet 
                                ? story.contentSnippet.substring(0, 200) + '...' 
                                : 'Click to read more')
                            .setTimestamp(story.isoDate ? new Date(story.isoDate) : null);
    
                        if (imageUrl) {
                            embed.setImage(imageUrl);
                        }
    
                        // Combine author and source information
                        const authorAndSource = `${story.creator ? story.creator + ' | ' : ''}${sourceSite}`;
                        embed.setAuthor({ name: authorAndSource });
    
                        embed.setFooter({ text: 'Zelda News Bot' });
    
                        await channel.send({ embeds: [embed] });
                        postedStories.push({ guildId: guild.guildId, storyId: story.guid });
                    }
                }
            } catch (error) {
                console.error(`Error processing story for guild ${guild.guildId}:`, error);
            }
        }
        if (postedStories.length > 0) {
            await storage.batchSavePostedStories(postedStories);
        }
    }

    function storyMatchesKeywords(story: Story, keywords: string[]): boolean {
        const title = story.title.toLowerCase();
        const categories = story.categories?.map(c => c.toLowerCase()) || [];
        return keywords.some(k => title.includes(k) || categories.includes(k));
    }
    

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand() || !interaction.guildId) return;
        const guildId = interaction.guildId;
        const channelId = interaction.channelId;
        if (interaction.commandName === 'startgameupdates') {
            await storage.saveGuildChannel(guildId, channelId);
            await storage.initializeKeywordsForGuild(guildId, defaultKeywords);
            await interaction.reply({ content: 'Updates will be sent to this channel.', ephemeral: true });
        }
        if (interaction.commandName === 'stopgameupdates') {
            await storage.removeGuildChannel(guildId);
            await interaction.reply({ content: 'Updates will be stopped for this channel.', ephemeral: true });
        }
        if (interaction.commandName === 'addkeyword') {
            const keyword = interaction.options.getString('keyword', true).toLowerCase();
            await storage.addKeyword(guildId, keyword);
            await interaction.reply({ content: `Added keyword \`${keyword}\`.`, ephemeral: true });
        }
        if (interaction.commandName === 'removekeyword') {
            const keyword = interaction.options.getString('keyword', true).toLowerCase();
            await storage.removeKeyword(guildId, keyword);
            await interaction.reply({ content: `Removed keyword \`${keyword}\`.`, ephemeral: true });
        }
        if (interaction.commandName === 'listkeywords') {
            const keywords = await storage.getGuildKeywords(guildId);
            await interaction.reply({ content: `Current keywords: ${keywords.join(', ') || 'none'}`, ephemeral: true });
        }
        if (interaction.commandName === 'clearkeywords') {
            await storage.clearKeywords(guildId);
            await interaction.reply({ content: 'All keywords cleared for this server.', ephemeral: true });
        }
        if (interaction.commandName === 'restorekeywords') {
            await storage.restoreDefaultKeywords(guildId, defaultKeywords);
            await interaction.reply({ content: 'Default keywords restored for this server.', ephemeral: true });
        }
    });

    client.login(process.env.DISCORD_TOKEN);

} else {
    // Worker thread code
    if (!parentPort) {
        console.error('This worker thread was initiated without a parent port.');
        process.exit(1);
    }

    const workerParentPort: MessagePort = parentPort;
    const rssParser = new RSSParser();
    const { feeds } = workerData as { feeds: string[] };
    storage.connectDb();

    async function checkRssFeed() {
        const keywords = await storage.getAllKeywords();
        for (const rssFeedUrl of feeds) {
            try {
                console.debug("Checking RSS feed:", rssFeedUrl);
                const feed = await rssParser.parseURL(rssFeedUrl);
                for (const item of feed.items) {
                    if (itemMatchesFilters(item as Story, keywords)) {
                        workerParentPort.postMessage({ type: 'newStory', story: item as Story });
                    }
                }
            } catch (error) {
                console.error('Error checking RSS feed:', error);
            }
        }
    }

    function itemMatchesFilters(item: Story, keywords: string[]): boolean {
        const title = item.title.toLowerCase();
        const categories = item.categories?.map(category => category.toLowerCase()) || [];
        return keywords.some(filter =>
            title.includes(filter) ||
            categories.includes(filter)
        );
    }

    // Start checking RSS feeds every 15 minutes
    checkRssFeed();
    setInterval(checkRssFeed, 15 * 60 * 1000); // 15 minutes
}

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, you could restart the bot here
    // process.exit(1);
});