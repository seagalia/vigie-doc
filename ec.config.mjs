// @ts-check
import { defineEcConfig } from '@astrojs/starlight/expressive-code';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginCodeblocks } from 'starlight-codeblocks/expressive-code';

export default defineEcConfig({
	// starlight-codeblocks fails the build when collapsible sections come after it.
	plugins: [pluginCollapsibleSections(), pluginLineNumbers(), pluginCodeblocks()],
	// Most blocks are one-line shell commands, where a gutter is noise, so a block opts in with `showLineNumbers`.
	defaultProps: { showLineNumbers: false },
});
