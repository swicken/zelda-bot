import * as cheerio from 'cheerio';

export async function getImageUrlFromArticle(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        let imageUrl = $('meta[property="og:image"]').attr('content') ||
                       $('meta[name="twitter:image"]').attr('content') ||
                       $('img').first().attr('src');
        
        return imageUrl || null;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Request timed out for URL:', url);
        } else {
            console.error('Error fetching image from article:', error);
        }
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}