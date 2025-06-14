import { MongoClient, Collection } from 'mongodb';
import dotenv from 'dotenv';
import { GuildChannel, PostedStory, GuildKeywords } from './models';

dotenv.config();

const uri: string = process.env.MONGODB_URI as string;
const client: MongoClient = new MongoClient(uri);


async function connectDb(): Promise<void> {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Could not connect to MongoDB", error);
    }
}



/**
    * Save the guild ID and channel ID to the database.
    * If the guild ID already exists, update the channel ID.
    * If the guild ID does not exist, insert a new document.
    * @param {string} guildId
    * @param {string} channelId
    * @returns {Promise<void>}
    * @example await saveGuildChannel('123456789', '987654321');
    * 
*/

async function saveGuildChannel(guildId: string, channelId: string): Promise<void> {
    const collection: Collection = client.db("discordBot").collection("guildChannels");
    await collection.updateOne(
        { guildId },
        { $set: { channelId } },
        { upsert: true }
    );
}

/**
    * Get the channel ID for the given guild ID.
    * @param {string} guildId
    * @returns {Promise<string | null>}
    * @example const channelId = await getGuildChannel('123456789');
    * 
*/

async function getGuildChannel(guildId: string): Promise<string | null> {
    const collection: Collection = client.db("discordBot").collection("guildChannels");
    const doc = await collection.findOne({ guildId });
    return doc ? doc.channelId : null;
}

/**
    * Get all guild IDs in the database.
    * @returns {Promise<string[]>}
    * @example const guildIds = await getAllGuilds();
    * 
*/
async function getAllGuilds(): Promise<string[]> {
    const collection: Collection = client.db("discordBot").collection("guildChannels");
    const docs = await collection.find({}).toArray();
    return docs.map(doc => doc.guildId);
}

/**
 * Retrieves all guild-channel mappings that have a channel ID set in the database.
 * 
 * @returns {Promise<GuildChannel[]>} An array of GuildChannel objects.
 */
async function getGuildsWithChannel(): Promise<GuildChannel[]> {
    const collection: Collection<GuildChannel> = client.db("discordBot").collection("guildChannels");
    const docs = await collection.find({ channelId: { $exists: true } }).toArray();
    return docs.map(doc => ({ guildId: doc.guildId, channelId: doc.channelId }));
}


/**
* Remove the guild ID from the database.
*
* @param {string} guildId - the ID of the guild.
* 
* @returns {Promise<void>}
* @example await removeGuildChannel('123456789');
* 
*/
async function removeGuildChannel(guildId: string): Promise<void> {
    const collection: Collection = client.db("discordBot").collection("guildChannels"); await collection.deleteOne({ guildId });
}

/**
 * Save the story as posted for a specific guild.
 * 
 * @param {string} guildId - The ID of the guild.
 * @param {string} storyId - The ID of the story.
 * @returns {Promise<void>}
 */
async function savePostedStory(guildId: string, storyId: string): Promise<void> {
    const collection: Collection<PostedStory> = client.db("discordBot").collection("postedStories");
    await collection.updateOne(
        { guildId, storyId },
        { $set: { guildId, storyId } },
        { upsert: true }
    );
}
/**
 * Check if a story has already been posted to a guild.
 * 
 * @param {string} guildId - The ID of the guild.
 * @param {string} storyId - The ID of the story.
 * @returns {Promise<boolean>}
 */
async function hasStoryBeenPosted(guildId: string, storyId: string): Promise<boolean> {
    const collection: Collection<PostedStory> = client.db("discordBot").collection("postedStories");
    const doc = await collection.findOne({ guildId, storyId });
    return doc != null;
}


async function batchSavePostedStories(stories: Array<{ guildId: string, storyId: string }>): Promise<void> {
    const collection: Collection<PostedStory> = client.db("discordBot").collection("postedStories");
    const operations = stories.map(story => ({
        updateOne: {
            filter: { guildId: story.guildId, storyId: story.storyId },
            update: { $set: { guildId: story.guildId, storyId: story.storyId } },
            upsert: true
        }
    }));
    await collection.bulkWrite(operations);
}

async function initializeKeywordsForGuild(guildId: string, keywords: string[]): Promise<void> {
    const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
    const existing = await collection.findOne({ guildId });
    if (!existing) {
        await collection.insertOne({ guildId, keywords });
    }
}

async function addKeyword(guildId: string, keyword: string): Promise<void> {
    const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
    await collection.updateOne(
        { guildId },
        { $addToSet: { keywords: keyword.toLowerCase() } },
        { upsert: true }
    );
}

  async function removeKeyword(guildId: string, keyword: string): Promise<void> {
      const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
      await collection.updateOne(
          { guildId },
          { $pull: { keywords: keyword.toLowerCase() } }
      );
  }

  async function clearKeywords(guildId: string): Promise<void> {
      const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
      await collection.updateOne(
          { guildId },
          { $set: { keywords: [] } },
          { upsert: true }
      );
  }

  async function restoreDefaultKeywords(guildId: string, defaults: string[]): Promise<void> {
      const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
      await collection.updateOne(
          { guildId },
          { $set: { keywords: defaults } },
          { upsert: true }
      );
  }

async function getGuildKeywords(guildId: string): Promise<string[]> {
    const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
    const doc = await collection.findOne({ guildId });
    return doc ? doc.keywords : [];
}

async function getAllGuildKeywords(): Promise<Array<{ guildId: string; keywords: string[] }>> {
    const collection: Collection<GuildKeywords> = client.db("discordBot").collection("guildKeywords");
    const docs = await collection.find({}).toArray();
    return docs.map(doc => ({ guildId: doc.guildId, keywords: doc.keywords }));
}

async function getAllKeywords(): Promise<string[]> {
    const all = await getAllGuildKeywords();
    const set = new Set(all.flatMap(g => g.keywords));
    return Array.from(set);
}



export {
    connectDb,
    saveGuildChannel,
    getGuildChannel,
    removeGuildChannel,
    savePostedStory,
    hasStoryBeenPosted,
    getAllGuilds,
    getGuildsWithChannel,
    batchSavePostedStories,
    initializeKeywordsForGuild,
    addKeyword,
    removeKeyword,
    getGuildKeywords,
    getAllGuildKeywords,
    getAllKeywords,
    clearKeywords,
    restoreDefaultKeywords
};
