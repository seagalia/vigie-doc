// starlight-llms-txt only reads the content collection, so the Protobuf reference, an Astro page, gets its own text file,
// linked from llms.txt. It stays out of llms-full.txt and llms-small.txt, where it would double their size.
import type { APIRoute } from 'astro';
import reference from '../generated/proto-reference.json';

// A comment can span several lines, which would end the table row it sits in.
function cell(text: string): string {
	return text.replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|');
}

function typeWithStream(fullType: string, isStreaming: boolean): string {
	const streamPrefix = isStreaming ? 'stream ' : '';
	return `${streamPrefix}\`${fullType}\``;
}

export const GET: APIRoute = () => {
	const lines = [
		'# Vigie Protobuf reference',
		'',
		'> Every message, field, enum and service of the .proto files under api/vigie in the Vigie repository, generated from their comments. Types are given by their full proto name.',
	];

	for (const file of reference.files) {
		lines.push('', `## ${file.name}`, '', `Package \`${file.package}\`.`);
		if (file.description) lines.push('', file.description);

		for (const message of file.messages) {
			lines.push('', `### ${message.fullName}`);
			if (message.description) lines.push('', message.description);
			if (message.fields.length === 0) continue;
			lines.push('', '| Field | Type | Label | Description |', '|---|---|---|---|');
			for (const field of message.fields) {
				const label = field.isoneof ? `oneof ${field.oneofdecl}` : field.label;
				lines.push(`| \`${field.name}\` | \`${field.fullType}\` | ${label} | ${cell(field.description)} |`);
			}
		}

		for (const protoEnum of file.enums) {
			lines.push('', `### ${protoEnum.fullName}`);
			if (protoEnum.description) lines.push('', protoEnum.description);
			lines.push('', '| Name | Number | Description |', '|---|---|---|');
			for (const value of protoEnum.values) {
				lines.push(`| \`${value.name}\` | ${value.number} | ${cell(value.description)} |`);
			}
		}

		for (const service of file.services) {
			lines.push('', `### ${service.fullName}`);
			if (service.description) lines.push('', service.description);
			lines.push('', '| Method | Request | Response | Description |', '|---|---|---|---|');
			for (const method of service.methods) {
				const request = typeWithStream(method.requestFullType, method.requestStreaming);
				const response = typeWithStream(method.responseFullType, method.responseStreaming);
				lines.push(`| \`${method.name}\` | ${request} | ${response} | ${cell(method.description)} |`);
			}
		}
	}

	return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
