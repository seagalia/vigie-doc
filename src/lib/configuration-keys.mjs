// The keys of the vigie configuration file, read from one data file. They fill the tables of the configuration
// reference page, and the tooltips shown when hovering a key in any YAML code block of the site, so both stay in step.

import { readFileSync } from 'node:fs';
import { ExpressiveCodeAnnotation } from '@astrojs/starlight/expressive-code';
import { h } from '@astrojs/starlight/expressive-code/hast';
import { toHast } from 'mdast-util-to-hast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import { parse } from 'yaml';

// Astro turns quotes and apostrophes into typographic ones before the plugins of the site run, so the text of the data
// file gets the same treatment here.
const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);

// The phrasing nodes of a one-line Markdown text, ready to go in a table cell or a paragraph.
function parsePhrasing(text) {
	const paragraph = markdown.runSync(markdown.parse(text)).children[0];
	return paragraph?.children ?? [];
}

/**
 * Reads the groups of keys of the data file. Each key keeps its fields as Markdown nodes, and `byPath` finds a key from
 * its full path, such as `services[].dns.type`.
 */
export function loadConfigurationKeys(path) {
	const groups = parse(readFileSync(path, 'utf8')).map((group) => ({
		prefix: group.prefix,
		keys: group.keys.map((key) => ({
			path: key.path,
			type: parsePhrasing(key.type),
			required: parsePhrasing(key.required),
			default: parsePhrasing(key.default),
			description: parsePhrasing(key.description),
		})),
	}));
	const byPath = new Map(groups.flatMap((group) => group.keys.map((key) => [key.path, key])));
	return { groups, byPath };
}

/**
 * Remark plugin. Replaces each `::configuration-keys{prefix="services[].dns."}` line with the table of the group of
 * that prefix, each key written without the prefix.
 */
export function remarkConfigurationTables({ keys }) {
	const cell = (children) => ({ type: 'tableCell', children: structuredClone(children) });
	const row = (cells) => ({ type: 'tableRow', children: cells.map(cell) });

	function table(group) {
		const titles = ['Key', 'Type', 'Required', 'Default', 'Description'];
		const header = row(titles.map((title) => [{ type: 'text', value: title }]));
		const rows = group.keys.map((key) => {
			const shortPath = { type: 'inlineCode', value: key.path.slice(group.prefix.length) };
			return row([[shortPath], key.type, key.required, key.default, key.description]);
		});
		// remark-rehype writes as many cells per row as `align` has entries.
		return { type: 'table', align: titles.map(() => null), children: [header, ...rows] };
	}

	function replaceDirectives(parent, file) {
		parent.children = parent.children.map((node) => {
			const isTableDirective = node.type === 'leafDirective' && node.name === 'configuration-keys';
			if (!isTableDirective) {
				if (node.children) replaceDirectives(node, file);
				return node;
			}
			const prefix = node.attributes?.prefix ?? '';
			const group = keys.groups.find((candidate) => candidate.prefix === prefix);
			if (!group) file.fail(`no group of configuration keys has the prefix "${prefix}"`, node);
			return table(group);
		});
	}

	return (tree, file) => replaceDirectives(tree, file);
}

// The full path of each key of a YAML text, line by line, worked out from the indentation. A key under a list item
// gets `[]` after the list, so `- name:` under `services:` is `services[].name`. Flow collections such as `{a: b}` and
// lines inside a block scalar get no path.
function yamlKeyPaths(lines) {
	const keyPattern = /^(\s*)(-\s+)?([A-Za-z_][\w.-]*)\s*:(?=\s|$)(.*)$/;
	const blockScalarPattern = /^\s*[|>][-+0-9]*\s*(#.*)?$/;
	const found = [];
	// Each entry is a key whose children may follow: its column, its path and the path of its parent.
	const stack = [];
	let blockScalarColumn = -1;

	lines.forEach((text, lineIndex) => {
		const indent = text.search(/\S/);
		const isBlank = indent === -1;
		if (isBlank) return;
		const isInBlockScalar = blockScalarColumn >= 0 && indent > blockScalarColumn;
		if (isInBlockScalar) return;
		blockScalarColumn = -1;

		const match = text.match(keyPattern);
		if (!match) return;
		const [, spaces, dash = '', key, value] = match;
		const dashColumn = spaces.length;
		const keyColumn = dashColumn + dash.length;

		let parentPath;
		if (dash) {
			// A new list item: its parent is the list key above it, at the same column or to its left.
			while (stack.length && stack.at(-1).column > dashColumn) stack.pop();
			parentPath = `${stack.at(-1)?.path ?? ''}[]`;
		} else {
			while (stack.length && stack.at(-1).column > keyColumn) stack.pop();
			const sibling = stack.at(-1)?.column === keyColumn ? stack.pop() : undefined;
			parentPath = sibling ? sibling.parentPath : (stack.at(-1)?.path ?? '');
		}
		const path = parentPath ? `${parentPath}.${key}` : key;
		stack.push({ column: keyColumn, path, parentPath });
		if (blockScalarPattern.test(value)) blockScalarColumn = keyColumn;

		found.push({ lineIndex, path, columnStart: keyColumn, columnEnd: keyColumn + key.length });
	});
	return found;
}

let tooltipCount = 0;

class ConfigurationKeyAnnotation extends ExpressiveCodeAnnotation {
	constructor({ key, ...options }) {
		super({ ...options, renderPhase: 'latest' });
		this.key = key;
	}

	tooltip() {
		const { key } = this;
		const label = (text) => ({ type: 'strong', children: [{ type: 'text', value: text }] });
		const space = { type: 'text', value: ' ' };
		const separator = { type: 'text', value: ' · ' };
		const facts = [
			label('Type'), space, ...key.type, separator,
			label('Required'), space, ...key.required, separator,
			label('Default'), space, ...key.default,
		];
		const paragraphs = {
			type: 'root',
			children: [
				{ type: 'paragraph', children: [{ type: 'inlineCode', value: key.path }] },
				{ type: 'paragraph', children: structuredClone(facts) },
				{ type: 'paragraph', children: structuredClone(key.description) },
			],
		};
		tooltipCount += 1;
		const id = `config-key-tooltip-${tooltipCount}`;
		const content = toHast(paragraphs);
		// Pagefind would otherwise index the description in every page showing the key.
		const attributes = { id, role: 'tooltip', 'data-pagefind-ignore': '' };
		return { id, element: h('span.config-key-tooltip', attributes, content.children) };
	}

	render({ nodesToTransform }) {
		const { id, element } = this.tooltip();
		// A key is one token of the YAML grammar, so it comes as one node; the tooltip goes on the first node otherwise.
		return nodesToTransform.map((node, index) => {
			if (index > 0) return node;
			// tabindex lets keyboard and touch users open the tooltip, which the CSS also shows on focus.
			return h('span.config-key', { tabindex: '0', 'aria-describedby': id }, [node, element]);
		});
	}
}

// The tooltip is fixed to the viewport, because the code block scrolls sideways and would cut a tooltip placed inside
// it. The script moves it under the key, or above when there is no room below, each time the key opens it.
const placeTooltipScript = `
function placeTooltip(key) {
	const tooltip = key.querySelector('.config-key-tooltip');
	if (!tooltip) return;
	const margin = 8;
	const keyBox = key.getBoundingClientRect();
	const viewportWidth = document.documentElement.clientWidth;
	const viewportHeight = document.documentElement.clientHeight;
	const fitsBelow = keyBox.bottom + tooltip.offsetHeight + margin <= viewportHeight;
	const top = fitsBelow ? keyBox.bottom + 4 : keyBox.top - tooltip.offsetHeight - 4;
	const left = Math.max(margin, Math.min(keyBox.left, viewportWidth - tooltip.offsetWidth - margin));
	tooltip.style.top = top + 'px';
	tooltip.style.left = left + 'px';
}
function placeTooltipOf(event) {
	const key = event.target instanceof Element ? event.target.closest('.config-key') : null;
	if (key) placeTooltip(key);
}
document.addEventListener('pointerover', placeTooltipOf);
document.addEventListener('focusin', placeTooltipOf);
document.addEventListener('scroll', () => {
	const openKey = document.querySelector('.config-key:hover, .config-key:focus-within');
	if (openKey) placeTooltip(openKey);
}, { capture: true, passive: true });
`;

/**
 * Expressive Code plugin. In every YAML code block, a key whose full path is a configuration key gets a tooltip with
 * its type, whether it's required, its default and its description. Other keys, such as those of a Kubernetes
 * manifest, stay plain.
 */
export function pluginConfigurationKeys({ keys }) {
	return {
		name: 'Configuration keys',
		jsModules: [placeTooltipScript],
		hooks: {
			annotateCode: ({ codeBlock }) => {
				const isYaml = ['yaml', 'yml'].includes(codeBlock.language);
				if (!isYaml) return;
				const lines = codeBlock.getLines();
				for (const found of yamlKeyPaths(lines.map((line) => line.text))) {
					const key = keys.byPath.get(found.path);
					if (!key) continue;
					const inlineRange = { columnStart: found.columnStart, columnEnd: found.columnEnd };
					lines[found.lineIndex].addAnnotation(new ConfigurationKeyAnnotation({ key, inlineRange }));
				}
			},
		},
	};
}
