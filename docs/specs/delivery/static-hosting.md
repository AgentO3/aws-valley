---
id: static-hosting
layer: delivery
extends: []
---

# Static Hosting

## Purpose

A static site is a folder of files. A build step makes the folder, and a host serves the folder over HTTPS. The model is simple, but teams often build on a laptop and upload by hand, send the wrong MIME type for binary assets, cache HTML for too long, or serve over HTTP, where WebXR and other secure-context APIs do not work. This spec makes static deploys reproducible, cache-correct, and easy to roll back on GitHub Pages, Amazon S3 with CloudFront, or Cloudflare Pages.

## Do

- Build the site in CI. Upload the built folder as one versioned artifact.
- Run smoke tests against that artifact before the deploy step.
- Serve all pages over HTTPS.
- Give HTML a short cache time. Give large binary assets a long cache time only when the file name or path changes with the content.
- Send the correct `Content-Type` for each asset type, for example `model/gltf-binary` for `.glb`.
- Keep the last good artifact, so that you can deploy it again to roll back.

## Don't

- Deploy from a developer machine.
- Mark a file `immutable` if its URL stays the same after its content changes.
- Make an S3 bucket public. Use CloudFront with Origin Access Control.
- Hotlink assets from a third-party host that you do not control.

## References

- **external** `https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages` — GitHub Pages deploys from Actions
- **external** `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html` — CloudFront Origin Access Control for S3
- **external** `https://developers.cloudflare.com/pages/configuration/headers/` — Cloudflare Pages `_headers` file
- **external** `https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts` — Secure contexts

## Rules

1. CI builds the site. CI uploads the output folder (for example `_site/`) as one artifact with the commit SHA in its name.
2. The deploy job uses the same artifact that the smoke tests passed on. The deploy job must not build again.
3. Serve the site only over HTTPS. Redirect HTTP to HTTPS.
4. The site must work at the root path and under a sub-path. Set the base path from one value (for example Jekyll `baseurl`).
5. Send `Cache-Control: no-cache` for HTML. Send `Cache-Control: public, max-age=31536000, immutable` only for files with a content hash or a version in the URL. Send a moderate `max-age` (for example 3600) for all other assets.
6. Send `model/gltf-binary` for `.glb`, `model/gltf+json` for `.gltf`, `application/wasm` for `.wasm`, and `image/webp` for `.webp`. Check these headers in the post-deploy smoke test.
7. Enable gzip or Brotli compression for HTML, CSS, JS and JSON. Do not compress `.glb`, `.webp` or other files that are already compressed.
8. Supply a `404.html` page.
9. On GitHub Pages, deploy with `actions/upload-pages-artifact` and `actions/deploy-pages`.
10. On AWS, keep the S3 bucket private. Serve it through CloudFront with Origin Access Control. Invalidate the HTML paths after each deploy.
11. On Cloudflare Pages, set headers in a `_headers` file in the output folder.
12. Keep at least the last 5 deploy artifacts. Roll back with a deploy of an earlier artifact, not with a new build.
13. Run the smoke tests against the live URL within 5 minutes after each deploy.
