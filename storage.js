// storage.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectDb() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Could not connect to MongoDB", error);
    }
}

async function saveGuildChannel(guildId, channelId) {
    const collection = client.db("discordBot").collection("guildChannels");
    await collection.updateOne(
        { guildId },
        { $set: { channelId } },
        { upsert: true }
    );
}

async function getGuildChannel(guildId) {
    const collection = client.db("discordBot").collection("guildChannels");
    const doc = await collection.findOne({ guildId });
    return doc ? doc.channelId : null;
}

async function getAllGuilds() {
    const collection = client.db("discordBot").collection("guildChannels");
    const docs = await collection.find({}).toArray();
    return docs.map(doc => doc.guildId);
}

async function removeGuildChannel(guildId) {
    const collection = client.db("discordBot").collection("guildChannels");
    await collection.deleteOne({ guildId });
}

async function savePostedStory(guildId, storyId) {
    const collection = client.db("discordBot").collection("postedStories");
    await collection.updateOne(
        { guildId, storyId },
        { $set: { guildId, storyId } },
        { upsert: true }
    );
}

async function hasStoryBeenPosted(guildId, storyId) {
    const collection = client.db("discordBot").collection("postedStories");
    const doc = await collection.findOne({ guildId, storyId });
    return doc != null;
}

export { connectDb, saveGuildChannel, getGuildChannel, removeGuildChannel, savePostedStory, hasStoryBeenPosted, getAllGuilds };

