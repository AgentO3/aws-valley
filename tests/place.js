// Page object for one place. Tests read the scene through window.__placeDebug (stack ADR-011),
// not through pixels.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect } from '@playwright/test';

// The URL path of each pack under a packs folder: '' for the root, then 'moon/', 'moon/moon-base/', ...
export function packPaths(dir) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const sub = join(abs, name);
      if (name.startsWith('.') || !statSync(sub).isDirectory()) continue;
      if (readdirSync(sub).includes('index.md')) {
        out.push(`${relative(dir, sub).split('\\').join('/')}/`);
        walk(sub);
      }
    }
  };
  walk(dir);
  return ['', ...out];
}

export class Place {
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.responses = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.errors.push(msg.text());
    });
    page.on('pageerror', (err) => this.errors.push(err.message));
    page.on('response', (res) => this.responses.push({ url: res.url(), status: res.status() }));
  }

  async open(path) {
    const res = await this.page.goto(path);
    await this.ready();
    return res;
  }

  // The scene is ready when the engine exposes its debug object and all models have loaded.
  async ready() {
    await expect
      .poll(() => this.page.evaluate(() => window.__placeDebug?.pending() ?? -1), { timeout: 30_000 })
      .toBe(0);
  }

  data() {
    return this.page.evaluate(() => {
      const { placed, triggers } = window.__placeDebug;
      return { place: window.PLACE, placed: placed.length, triggers: triggers.map((t) => t.url) };
    });
  }

  debug(expression) {
    return this.page.evaluate(expression);
  }

  view() {
    return this.page.evaluate(() => window.__placeDebug.view());
  }

  avatar() {
    return this.page.evaluate(() => window.__placeDebug.avatar());
  }

  messages() {
    return this.page.evaluate(() => window.__placeDebug.messages.slice());
  }

  // Labels of the doors and the exit, as the scene shows them.
  labels() {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('#world a-text[data-place]')).map((e) => e.getAttribute('value'))
    );
  }

  // Moves the body point (the camera in first person, the avatar in third person) onto a door.
  // The engine arms a door only after the body point is clear of all doors, so the body point first
  // goes to a clear point.
  async walkTo(urlPart, clear = { x: 0, z: 0 }) {
    await this.page.evaluate(
      ({ part, clear }) => {
        const dbg = window.__placeDebug;
        const door = dbg.triggers.find((t) => t.url.includes(part));
        if (!door) throw new Error(`no trigger for ${part}`);
        dbg.teleport(clear.x, clear.z);
        requestAnimationFrame(() => requestAnimationFrame(() => dbg.teleport(door.x, door.z)));
      },
      { part: urlPart, clear }
    );
  }
}
