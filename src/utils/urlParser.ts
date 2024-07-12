export function getSourceFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '').split('.')[0];
    } catch (error) {
        console.error('Error parsing URL:', error);
        return 'Unknown Source';
    }
}