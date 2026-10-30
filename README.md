# Vigie documentation

The documentation site of [Vigie](https://github.com/seagalia/vigie), an endpoint discovery server. It's a
[Starlight](https://starlight.astro.build) site, built with Astro.

The site serves operators who run Vigie, authors of clients that poll its `/services` answer, and contributors to the
code.

## Run the site

You need Node.js and pnpm. Install the dependencies once:

```bash
pnpm install
```

Then use the scripts of `package.json`:

| Command        | What it does                                                             |
|----------------|--------------------------------------------------------------------------|
| `pnpm dev`     | Serves the site on `http://localhost:4321` and reloads it on each change |
| `pnpm build`   | Builds the site into `dist/`, and fails on a broken internal link        |
| `pnpm preview` | Serves the built site from `dist/`                                       |
| `pnpm astro …` | Runs any other Astro command                                             |

To keep the development server running in the background, start it with `astro dev --background`, and manage it with
`astro dev status`, `astro dev logs` and `astro dev stop`.

## Deploy

`.github/workflows/deploy.yml` builds the site on each pull request, and on each push to `main` publishes `dist/` to
GitHub Pages. In the settings of the repository, Pages must take its source from GitHub Actions, and the custom domain
`vigie.seagalia.io` set there must match `site` in `astro.config.mjs`.

## Where the pages live

Every page is a Markdown or MDX file under `src/content/docs/`. `index.mdx` is the landing page, and each folder is a
group of the sidebar:

| Folder        | Sidebar group | Holds                                                                            |
|---------------|---------------|----------------------------------------------------------------------------------|
| `start/`      | Start         | The quickstart and the installation guide                                        |
| `concepts/`   | Concepts      | How Vigie works                                                                  |
| `guides/`     | Guides        | Tasks, one per page, and troubleshooting                                         |
| `reference/`  | Reference     | The command line, the configuration, the HTTP API, the web page and the glossary |
| `contribute/` | Contribute    | The development loop                                                             |

`astro.config.mjs` builds each group from its folder and orders its pages by their `sidebar.order` front matter.

Each page starts with front matter holding its `title`, its `description` and its `tags`, and its body starts at `##`,
because Starlight renders the title as the heading of the page. The tags are listed in `src/data/tags.yaml`, and a page
with an unknown tag fails the build.

## Where the facts come from

The pages describe the [Vigie repository](https://github.com/seagalia/vigie): its code, the `--help` of the `vigie`
binary, its sample configuration and `docs/configuration.md`, which `src/content/docs/reference/configuration.md`
follows. When the code and a page disagree, the code is right, so fix the page.

## Plugins

The site uses the same plugins as the Flock documentation, without the protobuf reference, which is specific to Flock,
and without `starlight-sidebar-topics`, since Vigie has a single topic.

- `src/lib/external-links.mjs`, copied from the Flock documentation, turns the first plain-text mention of a project of
  `src/data/external-links.yaml` on each page into a link to its site.
- `src/lib/glossary-terms.mjs`, copied from the Flock documentation, gives the first plain-text mention of a term of the
  table of `src/content/docs/reference/glossary.md` on each page a tooltip with its definition. The glossary page stays
  the single place to edit the terms, and its tooltip styles are in `src/styles/custom.css`.

- `astro-mermaid` draws the `mermaid` code blocks, in the light and dark themes.
- `starlight-codeblocks` with the collapsible sections and line numbers of Expressive Code, configured in
  `ec.config.mjs`.
- `starlight-links-validator` fails the build on a link to a page or an anchor that doesn't exist.
- `starlight-image-zoom` lets the reader enlarge the screenshots.
- `starlight-tags` adds the tags under the title and the `/tags/` pages.
- `starlight-heading-badges` allows badges in headings.
- `starlight-llms-txt` publishes `llms.txt`, `llms-full.txt` and `llms-small.txt`.
- `astro-og-canvas` draws the social card of each page, in `src/pages/og/`, and `src/routeData.ts` links it.

## Check the style

The pages follow the Google developer documentation style, in British English, with a Vale configuration in
`.vale.ini` and `.vale/`.

```bash
vale sync
vale src/content/docs
```

`vale sync` downloads the Google package into `.vale/styles/Google/`, which git ignores.

## Brand assets

- The logos come from the `exports/vigie` folder of the seagalia-brand kit, the same files as `vigie/ui/brand/`. The
  favicon is `icon/icon-plain.svg`.
- `src/assets/brand/og-lockup.png` is `lockup-dark.svg` rendered with `rsvg-convert -h 96`, because the canvas of the
  social cards can't draw SVG.
- The Roquebrune-Cap-Martin illustration of the footer comes from the Riviera exports of the seagalia-brand kit
  (`exports/riviera/roquebrune-cap-martin.light/transparent.svg` and `.dark`).
- The Titillium Web fonts are the files of the Flock documentation, with the extended Latin subset.
- `src/styles/custom.css` sets the accent colours from the turquoise of the Vigie palette, the footer and the glossary
  tooltips.
- `src/components/PageFrame.astro` adds the footer illustration and the copyright band after the content of every page.
- The screenshots of the web page, in `src/assets/page/`, are taken from a running `vigie serve` in headless Chrome,
  with `--blink-settings=preferredColorScheme=1` for light and `0` for dark, at a 1000×520 window and a scale of 2.
