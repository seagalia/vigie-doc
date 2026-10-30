// @ts-check
import { defineEcConfig } from '@astrojs/starlight/expressive-code';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginCodeblocks } from 'starlight-codeblocks/expressive-code';
import { loadConfigurationKeys, pluginConfigurationKeys } from './src/lib/configuration-keys.mjs';

export default defineEcConfig({
	// starlight-codeblocks fails the build when collapsible sections come after it.
	plugins: [
		pluginCollapsibleSections(),
		pluginLineNumbers(),
		pluginCodeblocks(),
		pluginConfigurationKeys({ keys: loadConfigurationKeys('./src/data/configuration.yaml') }),
	],
	// Most blocks are one-line shell commands, where a gutter is noise, so a block opts in with `showLineNumbers`.
	defaultProps: { showLineNumbers: false },
});
