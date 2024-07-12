import { Client } from 'discord.js';
import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { processNewStory } from './storyProcessor';
import { Story } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rssFeeds = JSON.parse(readFileSync(join(__dirname, '../config/rssFeeds.json'), 'utf8'));
const numWorkers = 4;

export function startRssFeedChecking(client: Client) {
    const feedsPerWorker = Math.ceil(rssFeeds.feeds.length / numWorkers);

    for (let i = 0; i < numWorkers; i++) {
        const workerFeeds = rssFeeds.feeds.slice(i * feedsPerWorker, (i + 1) * feedsPerWorker);
        const worker = new Worker(join(__dirname, 'worker.js'), {
            workerData: { feeds: workerFeeds }
        });

        worker.on('message', async (message: { type: string, story: Story }) => {
            if (message.type === 'newStory') {
                await processNewStory(client, message.story);
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