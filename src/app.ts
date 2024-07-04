import { Client, GatewayIntentBits, TextChannel, DMChannel, EmbedBuilder } from 'discord.js';
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

const filters = ['zelda', 'a link to the past', 'ocarina of time', 'majora\'s mask', 'wind waker', 'twilight princess', 'skyward sword', 'breath of the wild', 'link\'s awakening', 'phantom hourglass', 'spirit tracks', 'a link between worlds', 'triforce heroes', 'the legend of zelda', 'the adventure of link', 'the minish cap', 'four swords', 'four swords adventures', 'the wind waker hd', 'twilight princess hd', 'the wind waker hd', 'the wind waker', 'twilight princess', 'twilight princess', 'skyward sword', 'breath of the wild', 'tears of the kingdom'];

const rssFeeds = JSON.parse(readFileSync(join(__dirname, 'rssFeeds.json'), 'utf8'));

if (isMainThread) {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });

    const numWorkers = 4; // Adjust based on your needs and server capacity

    client.on('ready', () => {
        console.log(`Logged in as ${client.user?.tag}!`);
        storage.connectDb();
        startRssFeedChecking();
    });

    function startRssFeedChecking() {
        const feedsPerWorker = Math.ceil(rssFeeds.feeds.length / numWorkers);
        for (let i = 0; i < numWorkers; i++) {
            const workerFeeds = rssFeeds.feeds.slice(i * feedsPerWorker, (i + 1) * feedsPerWorker);
            const worker = new Worker(__filename, {
                workerData: { feeds: workerFeeds, filters: filters }
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

    function getSourceFromUrl(url: string): string {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '').split('.')[0];
        } catch (error) {
            console.error('Error parsing URL:', error);
            return 'Unknown Source';
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
        const postedStories = [];
        for (const guild of guilds) {
            try {
                const channel = await client.channels.fetch(guild.channelId);
                if (channel instanceof TextChannel || channel instanceof DMChannel) {
                    const hasBeenPosted = await storage.hasStoryBeenPosted(guild.guildId, story.guid);
                    if (!hasBeenPosted) {
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

} else {
    // Worker thread code
    if (!parentPort) {
        console.error('This worker thread was initiated without a parent port.');
        process.exit(1);
    }

    const workerParentPort: MessagePort = parentPort;
    const rssParser = new RSSParser();
    const { feeds, filters } = workerData as { feeds: string[], filters: string[] };

    async function checkRssFeed() {
        for (const rssFeedUrl of feeds) {
            try {
                console.debug("Checking RSS feed:", rssFeedUrl);
                const feed = await rssParser.parseURL(rssFeedUrl);
                for (const item of feed.items) {
                    if (itemMatchesFilters(item as Story)) {
                        workerParentPort.postMessage({ type: 'newStory', story: item as Story });
                    }
                }
            } catch (error) {
                console.error('Error checking RSS feed:', error);
            }
        }
    }

    function itemMatchesFilters(item: Story): boolean {
        const title = item.title.toLowerCase();
        const categories = item.categories?.map(category => category.toLowerCase()) || [];
        return filters.some(filter => 
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