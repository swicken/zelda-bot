import { Message } from 'discord.js';
import * as storage from '../storage';

export async function handleCommands(message: Message) {
    if (!message.guild || message.author.bot) return;

    if (message.content.startsWith('!startGameUpdates')) {
        await storage.saveGuildChannel(message.guild.id, message.channel.id);
        message.reply('Updates will be sent to this channel.');
    }

    if (message.content.startsWith('!stopGameUpdates')) {
        await storage.removeGuildChannel(message.guild.id);
        message.reply('Updates will be stopped for this channel.');
    }
}