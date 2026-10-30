// Turns the name of an outside project, written in plain text in any doc page, into a link to that project's site. The
// names and their URLs live in src/data/external-links.yaml.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** Reads the YAML map of `name: url` into a Map keyed by the lowercased name, so matching ignores case. */
export function loadExternalLinks(path) {
	const entries = parse(readFileSync(path, 'utf8')) ?? {};
	const links = new Map();
	for (const [name, url] of Object.entries(entries)) {
		// A YAML slip, such as a missing value, would otherwise ship as a link to "null".
		if (typeof url !== 'string' || !URL.canParse(url)) throw new Error(`${path}: "${name}" needs a full URL, got ${url}`);
		links.set(name.toLowerCase(), url);
	}
	return links;
}

/**
 * Remark plugin. The first time a page names a project from the map in plain text, that name becomes a link. Later
 * mentions stay plain text, so a page that says "Envoy" twenty times doesn't turn blue. Text already in a link, a
 * heading or code is left alone, and the name keeps the case it was written in.
 */
export function remarkExternalLinks({ links }) {
	// With no names the pattern would be an empty group, which matches everywhere.
	if (links.size === 0) return () => {};

	// Longest names first, so "Envoy Gateway" wins over "Envoy".
	const names = [...links.keys()].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
	// A name glued to a path, a file name or a hyphenated word, like envoy.yaml or envoy-config, isn't a mention.
	const namePattern = new RegExp(`(?<![\\w./-])(${names.join('|')})(?![\\w/-]|\\.\\w)`, 'gi');

	return (tree) => {
		const linkedOnThisPage = new Set();

		function linkText(value) {
			const nodes = [];
			let last = 0;
			for (const match of value.matchAll(namePattern)) {
				const name = match[0].toLowerCase();
				if (linkedOnThisPage.has(name)) continue;
				linkedOnThisPage.add(name);

				if (match.index > last) nodes.push({ type: 'text', value: value.slice(last, match.index) });
				nodes.push({ type: 'link', url: links.get(name), children: [{ type: 'text', value: match[0] }] });
				last = match.index + match[0].length;
			}
			if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
			return nodes;
		}

		function linkChildren(parent) {
			parent.children = parent.children.flatMap((node) => {
				if (node.type === 'text') return linkText(node.value);

				const isLinkOrHeading = ['link', 'linkReference', 'heading'].includes(node.type);
				// An HTML element inside an inline SVG diagram breaks its text, which is laid out by SVG rules.
				const isSvg = node.type.startsWith('mdxJsx') && node.name === 'svg';
				if (!isLinkOrHeading && !isSvg && node.children) linkChildren(node);
				return [node];
			});
		}

		linkChildren(tree);
	};
}
