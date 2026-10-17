---
id: jekyll
layer: platform
extends: []
---

# Jekyll

## Purpose

Jekyll is a Ruby static site generator. It turns Markdown files with YAML front matter into HTML through Liquid layouts. The output is a plain folder (`_site/`) that any static host can serve. Without shared rules, teams do not pin the Ruby and Jekyll versions, put logic into Liquid, insert unescaped strings into JavaScript, and break the site when it moves under a sub-path. This spec keeps Jekyll builds reproducible and keeps Liquid as a thin data layer.

## Do

- Pin the Ruby version in `.ruby-version` or `.tool-versions`.
- Pin Jekyll and all plugins in a `Gemfile`. Commit the `Gemfile.lock`.
- Model each content type as a collection with `output: true` and an explicit `permalink`.
- Set the layout for a collection through `defaults` in `_config.yml`, not in each file.
- Use Liquid only to collect page data and write it out. Write each value into JavaScript with the `jsonify` filter.
- Make every asset and page link with the `relative_url` filter.

## Don't

- Run `jekyll` without `bundle exec`.
- Put scene logic, layout math or business rules in Liquid.
- Insert a front matter value into a `<script>` block without `jsonify`.
- Write absolute paths such as `/assets/...` in layouts. The site breaks when `baseurl` is not empty.
- Commit `_site/`, `.jekyll-cache/` or `.jekyll-metadata`.

## References

- **external** `https://jekyllrb.com/docs/collections/` — Collections, `output`, and `permalink`
- **external** `https://jekyllrb.com/docs/configuration/front-matter-defaults/` — Front matter defaults
- **external** `https://jekyllrb.com/docs/liquid/filters/` — `jsonify`, `relative_url`, `where`
- **external** `https://jekyllrb.com/docs/configuration/liquid/` — Liquid error modes

## Rules

1. Pin Ruby in `.ruby-version` or `.tool-versions`. Pin `jekyll` in the `Gemfile` with a `~>` constraint. Commit `Gemfile.lock`.
2. Run all builds with `bundle exec jekyll build`. Run the local server with `bundle exec jekyll serve --livereload`.
3. Set `liquid: { error_mode: strict, strict_filters: true }` in `_config.yml`. An unknown filter or a Liquid syntax error must stop the build.
4. Build with `--strict_front_matter`. A front matter YAML error must stop the build.
5. Define each content type as a collection in `_config.yml`, with `output: true` and a `permalink` such as `/:name/`.
6. Document the front matter keys of each collection: name, type, required or optional, and default value. Keep this list in the stack README or in an ADR.
7. A layout must write page data into JavaScript only as JSON, with `jsonify` on each value. Strip HTML from Markdown body text (`strip_html`, `normalize_whitespace`) before it goes into JSON.
8. Resolve references between pages (for example `parent: <slug>`) in Liquid with `where`. When a reference does not resolve, write a marker value (for example `{ missing: "<slug>" }`). Do not fail without a signal.
9. Make all URLs with `relative_url`. The site must work at `/` and under a `baseurl` sub-path.
10. List every folder that is not site content (for example `.sdlc`, `node_modules`, `docs`) in the `exclude` key of `_config.yml`.
11. Add `_site`, `.jekyll-cache` and `.jekyll-metadata` to `.gitignore`.
