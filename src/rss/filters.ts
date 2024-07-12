import { Story } from '../types';

export const filters: string[] = [
    'zelda',
    'a link to the past',
    'ocarina of time',
    'majora\'s mask',
    'wind waker',
    'twilight princess',
    'skyward sword',
    'breath of the wild',
    'link\'s awakening',
    'phantom hourglass',
    'spirit tracks',
    'a link between worlds',
    'triforce heroes',
    'the legend of zelda',
    'the adventure of link',
    'the minish cap',
    'four swords',
    'four swords adventures',
    'the wind waker hd',
    'twilight princess hd',
    'tears of the kingdom'
];

export function itemMatchesFilters(item: Story): boolean {
    const title = item.title.toLowerCase();
    const categories = item.categories?.map(category => category.toLowerCase()) || [];
    return filters.some(filter => 
        title.includes(filter) || 
        categories.includes(filter)
    );
}