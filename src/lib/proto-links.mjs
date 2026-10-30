// Turns the full name of a proto element, written in any doc page or proto comment, into a link to its entry in the
// protobuf reference page.

const referencePath = '/reference/proto/';
// Prefix of the type URL a google.protobuf.Any carries, such as the @type of an extension.
const typeUrlPrefix = 'type.googleapis.com/';

function withoutTypeUrlPrefix(value) {
	return value.startsWith(typeUrlPrefix) ? value.slice(typeUrlPrefix.length) : value;
}

/**
 * Every name the protobuf reference has an anchor for, mapped to the anchor. Fields, enum values and methods are named
 * after their parent, like `vigie.eds.v1.Endpoint.ip`. A method also answers to its URL path form,
 * `vigie.eds.v1.EndpointDiscoveryService/GetEndpoints`.
 */
export function protoAnchors(reference) {
	const anchors = new Map();
	for (const file of reference.files) {
		anchors.set(file.name, file.name);
		for (const message of file.messages) {
			anchors.set(message.fullName, message.fullName);
			for (const field of message.fields) anchors.set(`${message.fullName}.${field.name}`, `${message.fullName}.${field.name}`);
		}
		for (const protoEnum of file.enums) {
			anchors.set(protoEnum.fullName, protoEnum.fullName);
			for (const value of protoEnum.values) anchors.set(`${protoEnum.fullName}.${value.name}`, `${protoEnum.fullName}.${value.name}`);
		}
		for (const service of file.services) {
			anchors.set(service.fullName, service.fullName);
			for (const method of service.methods) {
				const anchor = `${service.fullName}.${method.name}`;
				anchors.set(anchor, anchor);
				anchors.set(`${service.fullName}/${method.name}`, anchor);
			}
		}
	}
	return anchors;
}

export function protoHref(anchor) {
	return `${referencePath}#${anchor}`;
}

/**
 * The name without its package, such as `Endpoint` for `vigie.eds.v1.Endpoint`, or
 * `EndpointDiscoveryService/GetEndpoints` for a method. Packages are lower case and messages, enums and services start
 * with a capital, which is how the package ends. A name with no capital, such as a file, stays whole.
 */
export function shortName(name) {
	const parts = name.split('.');
	const firstTypePart = parts.findIndex((part) => /^[A-Z]/.test(part));
	return firstTypePart === -1 ? name : parts.slice(firstTypePart).join('.');
}

/**
 * Remark plugin. Inline code holding exactly a proto name becomes a link, and so does a proto name in plain text. Text
 * already in a link or a heading is left alone. A name may carry the type.googleapis.com/ prefix of a type URL.
 *
 * In a table, a name shows without its package, and the full name moves to the title of the link, because full names
 * make the columns too wide. `inTable` treats the whole tree as a table cell, for text rendered on its own into one.
 * Elsewhere, a Markdown link with a proto: URL keeps a short label:
 * [`Endpoint`](proto:vigie.eds.v1.Endpoint). An empty label shows the last part of the name.
 */
export function remarkProtoLinks({ reference, inTable = false }) {
	const anchors = protoAnchors(reference);
	// Longest names first, so a field wins over the message its name starts with.
	const names = [...anchors.keys()].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
	const namePattern = new RegExp(`(?<![\\w./])(?:type\\.googleapis\\.com/)?(${names.join('|')})(?![\\w/])`, 'g');

	function link(name, children, title = null) {
		return { type: 'link', url: protoHref(anchors.get(name)), title, children };
	}

	function linkText(value, inTable) {
		const nodes = [];
		let last = 0;
		for (const match of value.matchAll(namePattern)) {
			if (match.index > last) nodes.push({ type: 'text', value: value.slice(last, match.index) });
			const name = match[1];
			if (inTable) nodes.push(link(name, [{ type: 'text', value: shortName(name) }], name));
			else nodes.push(link(name, [{ type: 'text', value: match[0] }]));
			last = match.index + match[0].length;
		}
		if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
		return nodes;
	}

	function resolveProtoUrl(node) {
		const name = withoutTypeUrlPrefix(node.url.slice('proto:'.length));
		// A typo would otherwise ship as a link to the top of the reference page.
		if (!anchors.has(name)) throw new Error(`unknown proto name in link: ${node.url}`);
		node.url = protoHref(anchors.get(name));
		if (node.children.length === 0) node.children = [{ type: 'inlineCode', value: name.split(/[./]/).at(-1) }];
	}

	// starlight-links-validator can't see the reference page, which isn't in the content collection, so its anchors are
	// checked here.
	const anchorIds = new Set(anchors.values());
	function checkReferenceUrl(url) {
		const fragment = decodeURIComponent(url.slice(referencePath.length).replace(/^#/, ''));
		if (fragment && !anchorIds.has(fragment)) throw new Error(`unknown anchor in protobuf reference link: ${url}`);
	}

	function linkChildren(parent, inTable = false) {
		parent.children = parent.children.flatMap((node) => {
			if (node.type === 'link' && node.url.startsWith('proto:')) resolveProtoUrl(node);
			else if (node.type === 'link' && node.url.startsWith(referencePath)) checkReferenceUrl(node.url);
			const codeName = node.type === 'inlineCode' ? withoutTypeUrlPrefix(node.value) : undefined;
			if (anchors.has(codeName)) {
				if (!inTable) return [link(codeName, [node])];
				const shortCode = { type: 'inlineCode', value: shortName(codeName) };
				return [link(codeName, [shortCode], codeName)];
			}
			if (node.type === 'text') return linkText(node.value, inTable);

			const isLinkOrHeading = ['link', 'linkReference', 'heading'].includes(node.type);
			const childrenInTable = inTable || node.type === 'tableCell';
			if (!isLinkOrHeading && node.children) linkChildren(node, childrenInTable);
			return [node];
		});
	}

	return (tree) => linkChildren(tree, inTable);
}
