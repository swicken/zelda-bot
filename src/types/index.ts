export type GuildChannel = {
    guildId: string;
    channelId: string;
};

export type PostedStory = {
    guildId: string;
    storyId: string;
};

export type Story = {
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
};