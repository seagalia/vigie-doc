import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

// src/pages/og draws an image for each docs entry only, so pages added by plugins, such as the tag pages, keep none.
const entriesWithImage = new Set((await getCollection('docs')).map((entry) => entry.id));

export const onRequest = defineRouteMiddleware((context) => {
	const { entry, head } = context.locals.starlightRoute;
	if (!entriesWithImage.has(entry.id)) return;

	const imageUrl = new URL(`/og/${entry.id}.png`, context.site);
	head.push({ tag: 'meta', attrs: { property: 'og:image', content: imageUrl.href } });
	head.push({ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } });
	head.push({ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } });
});
