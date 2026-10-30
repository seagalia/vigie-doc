// Marks the glossary terms written in any doc page, so hovering or focusing one shows its definition. The terms and
// definitions come from the table of the glossary page, which stays the single place to edit them.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * Reads the `Term | Abbreviation | Definition` table of the glossary page. A term matches whatever its case, since it
 * starts a sentence as often as not. An abbreviation only matches as written, so "eds" in a word list isn't EDS.
 */
export function loadGlossary(path) {
	const tree = unified().use(remarkParse).use(remarkGfm).parse(readFileSync(path, 'utf8'));
	const table = tree.children.find((node) => node.type === 'table');
	if (!table) throw new Error(`${path}: no glossary table found`);

	const byTerm = new Map();
	const byAbbreviation = new Map();
	for (const row of table.children.slice(1)) {
		const [termCell, abbreviationCell, definitionCell] = row.children;
		const entry = { term: toString(termCell), definition: definitionCell.children };
		byTerm.set(entry.term.toLowerCase(), entry);
		const abbreviation = toString(abbreviationCell).trim();
		if (abbreviation) byAbbreviation.set(abbreviation, entry);
	}
	return { path: resolve(path), byTerm, byAbbreviation };
}

/**
 * Remark plugin. The first time a page uses a glossary term or its abbreviation in plain text, plural included, it gets
 * a tooltip with the definition. Later mentions stay plain, so a page about routes isn't underlined all over. Text in a
 * link, a heading or code is left alone, and so is the glossary page itself.
 */
export function remarkGlossaryTerms({ glossary }) {
	const { byTerm, byAbbreviation } = glossary;
	// Longest names first, so "virtual server" wins over a shorter term it starts with.
	const names = [...byTerm.keys(), ...byAbbreviation.keys()]
		.sort((a, b) => b.length - a.length)
		.map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
	const namePattern = new RegExp(`(?<![\\w./-])(${names.join('|')})(?:s|es)?(?![\\w/-]|\\.\\w)`, 'gi');

	function termNode(text, entry) {
		const tooltipId = `glossary-${entry.term.toLowerCase().replace(/\W+/g, '-')}`;
		const tooltip = {
			type: 'glossaryTooltip',
			// Pagefind would otherwise put definitions in the search results of every page using the term.
			data: { hName: 'span', hProperties: { id: tooltipId, role: 'tooltip', className: ['glossary-tooltip'], dataPagefindIgnore: '' } },
			children: structuredClone(entry.definition),
		};
		return {
			type: 'glossaryTerm',
			// tabindex lets keyboard users reach the definition, since the CSS also shows it on focus.
			data: { hName: 'span', hProperties: { className: ['glossary-term'], tabIndex: 0, ariaDescribedBy: tooltipId } },
			children: [{ type: 'text', value: text }, tooltip],
		};
	}

	return (tree, file) => {
		const isGlossaryPage = file.path && resolve(file.path) === glossary.path;
		if (isGlossaryPage) return;
		const markedOnThisPage = new Set();

		function markText(value) {
			const nodes = [];
			let last = 0;
			for (const match of value.matchAll(namePattern)) {
				const entry = byTerm.get(match[1].toLowerCase()) ?? byAbbreviation.get(match[1]);
				// A lowercase abbreviation reaches here through the case-insensitive pattern without being one.
				if (!entry || markedOnThisPage.has(entry)) continue;
				markedOnThisPage.add(entry);

				if (match.index > last) nodes.push({ type: 'text', value: value.slice(last, match.index) });
				nodes.push(termNode(match[0], entry));
				last = match.index + match[0].length;
			}
			if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
			return nodes;
		}

		function markChildren(parent) {
			parent.children = parent.children.flatMap((node) => {
				if (node.type === 'text') return markText(node.value);

				const isLinkOrHeading = ['link', 'linkReference', 'heading'].includes(node.type);
				// An HTML element inside an inline SVG diagram breaks its text, which is laid out by SVG rules.
				const isSvg = node.type.startsWith('mdxJsx') && node.name === 'svg';
				if (!isLinkOrHeading && !isSvg && node.children) markChildren(node);
				return [node];
			});
		}

		markChildren(tree);
	};
}
