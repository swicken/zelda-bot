import { parentPort, workerData } from 'worker_threads';
import RSSParser from 'rss-parser';
import { itemMatchesFilters } from './filters';
import { Story } from '../types';

const rssParser = new RSSParser();
const { feeds } = workerData;

async function checkRssFeed() {
    for (const rssFeedUrl of feeds) {
        try {
            console.debug("Checking RSS feed:", rssFeedUrl);
            const feed = await rssParser.parseURL(rssFeedUrl);
            for (const item of feed.items) {
                if (itemMatchesFilters(item as Story)) {
                    parentPort?.postMessage({ type: 'newStory', story: item as Story });
                }
            }
        } catch (error) {
            console.error('Error checking RSS feed:', error);
        }
    }
}

checkRssFeed();
setInterval(checkRssFeed, 15 * 60 * 1000); // 15 minutes