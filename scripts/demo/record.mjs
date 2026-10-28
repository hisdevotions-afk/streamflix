// Records the Streamflix demo as CDP screencast frames, one folder per scene.
// Usage: node record.mjs <outDir> [sceneName...]
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2]);
const ONLY = process.argv.slice(3);
const APP = "http://localhost:3000";
const CARD = "file://" + path.resolve(path.dirname(new URL(import.meta.url).pathname), "card.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake cursor: headless screencasts never draw the OS pointer.
const CURSOR = (touch) => `
(() => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform .12s ease-out;will-change:transform;";
    c.innerHTML = ${touch}
      ? '<div style="width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.85);box-shadow:0 4px 18px rgba(0,0,0,.4)"></div>'
      : '<svg width="30" height="30" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))"><path d="M4 2l16 9.5-7 1.6L9.4 20z" fill="#fff" stroke="#0b0a1a" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const pos = window.__curPos || { x: -100, y: -100 };
    c.style.left = pos.x + "px"; c.style.top = pos.y + "px";
    addEventListener("mousemove", (e) => { window.__curPos = { x: e.clientX, y: e.clientY }; c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "scale(.8)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = "scale(1)"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install); else install();
})();`;

class Scene {
  constructor(page, name) {
    this.page = page;
    this.dir = path.join(OUT, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.frames = [];
    this.x = 960;
    this.y = 540;
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", async (f) => {
      const file = path.join(this.dir, String(this.frames.length).padStart(6, "0") + ".jpg");
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      this.frames.push({ file, t: f.metadata.timestamp });
      await this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    const vp = this.page.viewportSize();
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
    this.t0 = Date.now() / 1000;
  }
  async stop() {
    const end = Date.now() / 1000;
    await this.cdp.send("Page.stopScreencast");
    // ffmpeg concat list with real frame durations; the last frame holds until the scene ended.
    const lines = [];
    this.frames.forEach((f, i) => {
      const next = i + 1 < this.frames.length ? this.frames[i + 1].t : end;
      lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    if (this.frames.length) lines.push(`file '${this.frames.at(-1).file}'`);
    fs.writeFileSync(path.join(this.dir, "list.txt"), lines.join("\n"));
    console.log(path.basename(this.dir), this.frames.length, "frames", (end - this.frames[0]?.t).toFixed(1) + "s");
  }
  async move(x, y, ms = 700) {
    const steps = Math.max(8, Math.round(ms / 16));
    const [x0, y0] = [this.x, this.y];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await sleep(ms / steps);
    }
    this.x = x;
    this.y = y;
  }
  async to(locator, ms = 700, dx = 0.5, dy = 0.5) {
    const b = await locator.boundingBox();
    if (!b) throw new Error("not visible: " + locator);
    await this.move(b.x + b.width * dx, b.y + b.height * dy, ms);
  }
  async click(locator, ms = 700) {
    await this.to(locator, ms);
    await sleep(180);
    await this.page.mouse.down();
    await sleep(90);
    await this.page.mouse.up();
  }
  async wheel(dy, ms = 900) {
    const steps = Math.round(ms / 16);
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await sleep(16);
    }
  }
}

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb"],
});

async function newPage(mobile = false) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" }
      : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  );
  await ctx.addInitScript(CURSOR(mobile));
  return ctx.newPage();
}

async function card(name, q, ms) {
  const page = await newPage();
  await page.goto(`${CARD}?${new URLSearchParams(q)}`);
  await page.evaluate(() => document.fonts.ready);
  const s = new Scene(page, name);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await s.start();
  await sleep(ms);
  await s.stop();
  await page.context().close();
}

const scenes = {
  // Short cut: home with the trailer, reel, search, then stop at "Continuar assistindo".
  async v2() {
    const page = await newPage();
    await page.goto(APP, { waitUntil: "load" });
    await page.mouse.move(1500, 420);
    await sleep(6500); // trailer fades in after the embed starts
    const s = new Scene(page, "v2");
    s.x = 1500; s.y = 420;
    await s.start();
    await sleep(3800);
    await s.to(page.getByRole("link", { name: /Assistir|Retomar/ }), 1000);
    await sleep(1400);
    const thumbs = page.locator('button[aria-label^="Destacar"]');
    await s.click(thumbs.nth(1), 900);
    await sleep(2600);
    await s.click(thumbs.nth(3), 600);
    await sleep(2600);
    await s.click(page.getByRole("combobox"), 1100);
    await page.keyboard.type("duna", { delay: 150 });
    await sleep(1300);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace", { delay: 60 });
    await page.keyboard.type("matrix", { delay: 150 });
    await sleep(1500);
    await page.keyboard.press("Escape");
    await s.move(1500, 600, 700);
    await s.wheel(860, 1400);
    await sleep(700);
    await s.to(page.locator("#continuar li").first(), 900, 0.6, 0.5);
    await sleep(1300);
    // Close on playback: the series card resumes the episode where it stopped.
    await s.click(page.locator("#continuar li").first(), 300);
    await page.waitForURL(/watch/);
    await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentTime > 0 && !v.paused; }, null, { timeout: 30000 });
    await sleep(4500);
    await s.move(1100, 900, 700);
    await sleep(2600);
    await s.move(1700, 300, 600);
    await sleep(1500);
    await s.stop();
    await page.context().close();
  },


  async c0() { await card("c0", { kind: "hero", title: "Streamflix", sub: "A sala de cinema da sua casa" }, 3600); },

  async s1() {
    const page = await newPage();
    await page.goto(APP, { waitUntil: "load" });
    await sleep(2500);
    const s = new Scene(page, "s1");
    await page.mouse.move(1500, 700);
    s.x = 1500; s.y = 700;
    await s.start();
    await sleep(2200);
    const thumbs = page.locator('button[aria-label^="Destacar"]');
    await s.click(thumbs.nth(1), 900);
    await sleep(3200);
    await s.click(thumbs.nth(2), 600);
    await sleep(3200);
    await s.click(thumbs.nth(3), 600);
    await sleep(2600);
    await s.to(page.getByRole("link", { name: /Assistir|Retomar/ }), 900);
    await sleep(900);
    await s.move(1700, 300, 900);
    await sleep(800);
    await s.stop();
    await page.context().close();
  },

  async c1() { await card("c1", { title: "Busque", sub: "Tudo o que está na biblioteca, enquanto você digita" }, 2600); },

  async s2() {
    const page = await newPage();
    await page.goto(APP, { waitUntil: "load" });
    await sleep(2000);
    const s = new Scene(page, "s2");
    await page.mouse.move(1300, 500);
    s.x = 1300; s.y = 500;
    await s.start();
    await sleep(600);
    const input = page.getByRole("combobox");
    await s.click(input, 900);
    await page.keyboard.type("duna", { delay: 140 });
    await sleep(1100);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace", { delay: 60 });
    await page.keyboard.type("dark", { delay: 140 });
    await sleep(800);
    await s.click(page.getByRole("option").first(), 600);
    await page.waitForURL(/series/);
    await sleep(2200);
    await s.wheel(520, 1100);
    await sleep(900);
    const eps = page.locator("ol li a");
    await s.to(eps.nth(0), 700);
    await sleep(700);
    await s.to(eps.nth(1), 500);
    await sleep(900);
    await s.wheel(-520, 900);
    await sleep(700);
    await s.click(page.getByRole("link", { name: /Retomar|Assistir/ }).first(), 900);
    await page.waitForURL(/watch/);
    await sleep(5200);
    await s.move(960, 900, 800);
    await sleep(2200);
    await s.stop();
    await page.context().close();
  },

  async c2() { await card("c2", { title: "Continue de onde parou", sub: "O progresso fica no servidor, não no aparelho" }, 2800); },

  async s3() {
    const page = await newPage();
    await page.goto(APP, { waitUntil: "load" });
    await sleep(2000);
    const s = new Scene(page, "s3");
    await page.mouse.move(1700, 400);
    s.x = 1700; s.y = 400;
    await s.start();
    await sleep(800);
    await s.wheel(860, 1300);
    await sleep(900);
    const cont = page.locator("#continuar li");
    await s.to(cont.nth(0), 900, 0.3, 0.4);
    await s.to(cont.nth(0), 900, 0.75, 0.6);
    await sleep(500);
    await s.to(cont.nth(1), 800, 0.5, 0.5);
    await sleep(900);
    await s.wheel(460, 900);
    await sleep(600);
    const films = page.locator("#filmes li");
    for (const i of [0, 1, 2]) {
      await s.to(films.nth(i), 650, 0.4, 0.45);
      await sleep(650);
    }
    await s.click(films.nth(1), 500);
    await page.waitForURL(/watch/);
    await sleep(4200);
    await s.stop();
    await page.context().close();
  },

  async c3() { await card("c3", { title: "Em qualquer tela", sub: "Do sofá ao celular, o mesmo cinema" }, 2600); },

  async m1() {
    const page = await newPage(true);
    await page.goto(APP, { waitUntil: "load" });
    await sleep(2000);
    const s = new Scene(page, "m1");
    s.x = 300; s.y = 600;
    await page.mouse.move(300, 600);
    await s.start();
    await sleep(1500);
    const thumbs = page.locator('button[aria-label^="Destacar"]');
    await s.click(thumbs.nth(1), 700);
    await sleep(2600);
    await s.click(thumbs.nth(2), 500);
    await sleep(2400);
    await s.move(200, 500, 500);
    // Mobile emulation ignores wheel events; scroll the document like a swipe would.
    await page.evaluate(() => window.scrollBy({ top: 760, behavior: "smooth" }));
    await sleep(1800);
    await s.to(page.locator("#continuar li").first(), 500);
    await sleep(900);
    await page.evaluate(() => window.scrollBy({ top: 620, behavior: "smooth" }));
    await sleep(2000);
    await s.stop();
    await page.context().close();
  },

  async c4() {
    await card("c4", { kind: "hero", title: "Streamflix", sub: "Jellyfin local · Next.js · Motion", stats: "100%~na sua rede|10 s~entre salvamentos de progresso|1~biblioteca para a casa toda" }, 4600);
  },
};

for (const [name, fn] of Object.entries(scenes)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  await fn();
}
await browser.close();
