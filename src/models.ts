// models.ts

export interface GuildChannel {
    guildId: string;
    channelId: string;
}

export interface PostedStory {
    guildId: string;
    storyId: string;
}

export interface Story {
    guid: string;
    title: string;
    link: string;
    pubDate?: string;
    creator?: string;
    content?: string;
    contentSnippet?: string;
    categories?: string[];
    isoDate?: string;
    enclosure?: {
        url: string;
        type: string;
        length?: string;
    };
}