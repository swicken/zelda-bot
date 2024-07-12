import { Client, TextChannel, DMChannel, EmbedBuilder } from 'discord.js';
import * as storage from '../storage';
import { Story, GuildChannel } from '../types';
import { getSourceFromUrl } from '../utils/urlParser';
import { getImageUrlFromArticle } from '../utils/imageExtractor';

export async function processNewStory(client: Client, story: Story) {
    const guilds = await storage.getGuildsWithChannel();
    const postedStories = [];

    for (const guild of guilds) {
        try {
            const channel = await client.channels.fetch(guild.channelId);
            if (channel instanceof TextChannel || channel instanceof DMChannel) {
                const hasBeenPosted = await storage.hasStoryBeenPosted(guild.guildId, story.guid);
                if (!hasBeenPosted) {
                    await sendStoryToChannel(channel, story, guild);
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

async function sendStoryToChannel(channel: TextChannel | DMChannel, story: Story, guild: GuildChannel) {
    const imageUrl = await getImageUrlFromArticle(story.link);
    const sourceSite = getSourceFromUrl(story.link);
    
    const embed = createStoryEmbed(story, imageUrl, sourceSite);
    
    await channel.send({ embeds: [embed] });
}

function createStoryEmbed(story: Story, imageUrl: string | null, sourceSite: string): EmbedBuilder {
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

    return embed;
}