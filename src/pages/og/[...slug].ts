import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const entries = await getCollection('docs');
const pages = Object.fromEntries(entries.map((entry) => [entry.id, entry.data]));

// The colours are the footer band and the turquoise accent of custom.css, so a shared link looks like the site.
export const { getStaticPaths, GET } = await OGImageRoute({
	pages,
	// The default slug strips anything after a dot, and src/routeData.ts builds the image URL from the entry id as is.
	getSlug: (id) => `${id}.png`,
	getImageOptions: (_id, page) => ({
		title: page.title,
		description: page.description,
		// The canvas can't draw SVG, so this is lockup-dark.svg rendered with `rsvg-convert -h 96`.
		logo: { path: './src/assets/brand/og-lockup.png' },
		bgGradient: [[4, 60, 114], [2, 33, 64]],
		border: { color: [52, 187, 193], width: 12, side: 'inline-start' },
		padding: 80,
		fonts: ['./src/styles/fonts/titillium-web-600.woff2', './src/styles/fonts/titillium-web-400.woff2'],
		font: {
			title: { families: ['Titillium Web'], weight: 'SemiBold', size: 72 },
			description: { families: ['Titillium Web'], weight: 'Normal', size: 36, color: [234, 243, 251], lineHeight: 1.4 },
		},
	}),
});
