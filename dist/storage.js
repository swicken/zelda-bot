import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
async function connectDb() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    }
    catch (error) {
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
async function saveGuildChannel(guildId, channelId) {
    const collection = client.db("discordBot").collection("guildChannels");
    await collection.updateOne({ guildId }, { $set: { channelId } }, { upsert: true });
}
/**
    * Get the channel ID for the given guild ID.
    * @param {string} guildId
    * @returns {Promise<string | null>}
    * @example const channelId = await getGuildChannel('123456789');
    *
*/
async function getGuildChannel(guildId) {
    const collection = client.db("discordBot").collection("guildChannels");
    const doc = await collection.findOne({ guildId });
    return doc ? doc.channelId : null;
}
/**
    * Get all guild IDs in the database.
    * @returns {Promise<string[]>}
    * @example const guildIds = await getAllGuilds();
    *
*/
async function getAllGuilds() {
    const collection = client.db("discordBot").collection("guildChannels");
    const docs = await collection.find({}).toArray();
    return docs.map(doc => doc.guildId);
}
/**
 * Retrieves all guild-channel mappings that have a channel ID set in the database.
 *
 * @returns {Promise<GuildChannel[]>} An array of GuildChannel objects.
 */
async function getGuildsWithChannel() {
    const collection = client.db("discordBot").collection("guildChannels");
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
async function removeGuildChannel(guildId) {
    const collection = client.db("discordBot").collection("guildChannels");
    await collection.deleteOne({ guildId });
}
/**
 * Save the story as posted for a specific guild.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} storyId - The ID of the story.
 * @returns {Promise<void>}
 */
async function savePostedStory(guildId, storyId) {
    const collection = client.db("discordBot").collection("postedStories");
    await collection.updateOne({ guildId, storyId }, { $set: { guildId, storyId } }, { upsert: true });
}
/**
 * Check if a story has already been posted to a guild.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} storyId - The ID of the story.
 * @returns {Promise<boolean>}
 */
async function hasStoryBeenPosted(guildId, storyId) {
    const collection = client.db("discordBot").collection("postedStories");
    const doc = await collection.findOne({ guildId, storyId });
    return doc != null;
}
export { connectDb, saveGuildChannel, getGuildChannel, removeGuildChannel, savePostedStory, hasStoryBeenPosted, getAllGuilds, getGuildsWithChannel };
