// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import codeblocks, { linksValidatorExclude } from 'starlight-codeblocks';
import starlightHeadingBadges from 'starlight-heading-badges';
import starlightImageZoom from 'starlight-image-zoom';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightTags from 'starlight-tags';
import { loadConfigurationKeys, remarkConfigurationTables } from './src/lib/configuration-keys.mjs';
import { loadExternalLinks, remarkExternalLinks } from './src/lib/external-links.mjs';
import { loadGlossary, remarkGlossaryTerms } from './src/lib/glossary-terms.mjs';

const groups = [
	{ label: 'Start', directory: 'start' },
	{ label: 'Concepts', directory: 'concepts' },
	{ label: 'Guides', directory: 'guides' },
	{ label: 'Reference', directory: 'reference' },
	{ label: 'Contribute', directory: 'contribute' },
];

// https://astro.build/config
export default defineConfig({
	site: 'https://vigie.seagalia.io',
	markdown: {
		// Each plugin skips text already in a link, so project names win over glossary terms.
		remarkPlugins: [
			// First, so the other plugins also see the tables it builds.
			[remarkConfigurationTables, { keys: loadConfigurationKeys('./src/data/configuration.yaml') }],
			[remarkExternalLinks, { links: loadExternalLinks('./src/data/external-links.yaml') }],
			[remarkGlossaryTerms, { glossary: loadGlossary('./src/content/docs/reference/glossary.md') }],
		],
	},
	integrations: [
		// Mermaid has to come before Starlight so its Markdown plugins see the diagram blocks first.
		mermaid({ autoTheme: true }),
		starlight({
			title: 'Vigie',
			logo: {
				light: './src/assets/brand/lockup.svg',
				dark: './src/assets/brand/lockup-dark.svg',
				replacesTitle: true,
			},
			favicon: '/favicon.svg',
			routeMiddleware: './src/routeData.ts',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/seagalia/vigie' }],
			customCss: ['./src/styles/fonts.css', './src/styles/custom.css'],
			components: {
				Header: './src/components/Header.astro',
				PageFrame: './src/components/PageFrame.astro',
				PageTitle: './src/components/PageTitle.astro',
				SocialIcons: './src/components/SocialIcons.astro',
			},
			sidebar: groups
				.map((group) => ({ label: group.label, items: [{ autogenerate: { directory: group.directory } }] }))
				.concat({ label: 'Tags', link: '/tags/' }),
			plugins: [
				// Before any plugin that sets the expressiveCode option, as the plugin asks.
				codeblocks({ runnable: false, placeholders: { storage: 'session' } }),
				// The links that starlight-codeblocks adds (code block ids, mentions) are no pages, so the validator skips them.
				starlightLinksValidator({ exclude: linksValidatorExclude }),
				starlightImageZoom(),
				starlightTags({ configPath: 'src/data/tags.yaml', onInlineTagsNotFound: 'error' }),
				starlightHeadingBadges(),
				starlightLlmsTxt({
					projectName: 'Vigie',
					// The labels and buttons of starlight-codeblocks would otherwise land inside the code, and the glossary
					// definitions in the middle of the sentences that use the terms, and the descriptions of the configuration
					// keys inside the YAML blocks.
					customSelectors: { all: ['.scb-deco', '.glossary-tooltip', '.config-key-tooltip'] },
					description:
						'Vigie is an endpoint discovery server. It reads the endpoints of named services from DNS, a file, a URL or Kubernetes, and serves them as JSON over HTTP to the clients that poll them.',
				}),
			],
		}),
	],
});
