import { Client } from 'discord.js';
import { handleCommands } from './commands';

export function setupClient(client: Client) {
    client.on('messageCreate', handleCommands);
    // Add other event handlers as needed
}