/**
 * Visual check: serves ./dist, drives the player in a phone-sized Chromium and
 * writes screenshots to .preview/. Also fails loudly on console/page errors.
 *
 * Usage: node scripts/shoot.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveDist, listen } from "./lib/static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".preview");
fs.mkdirSync(outDir, { recursive: true });

const server = serveDist(root);
const url = await listen(server);

const browser = await chromium.launch({
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--disable-gpu",
    "--no-sandbox",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
});
const page = await context.newPage();

const problems = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
});
page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(`  wrote .preview/${name}.png`);
};

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await shot("01-idle");

// press play through the deck itself
await page.getByRole("button", { name: "Play", exact: true }).first().click();
await page.waitForTimeout(2600);
await shot("02-playing");

const state = await page.evaluate(() => ({
  time: document.body.innerText.match(/\d+:\d\d/g)?.slice(0, 3),
  canvasPainted: (() => {
    const c = document.querySelector("canvas");
    if (!c) return "no canvas";
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 12) lit++;
    return lit;
  })(),
  reelRadii: [...document.querySelectorAll("circle")].slice(0, 40).map((c) => c.getAttribute("r")).filter(Boolean).slice(0, 6),
}));
console.log("  state:", JSON.stringify(state));

// scrub to the middle of the tape
const rail = await page.locator('[role="slider"]').boundingBox();
await page.mouse.move(rail.x + rail.width * 0.2, rail.y + rail.height / 2);
await page.mouse.down();
await page.mouse.move(rail.x + rail.width * 0.72, rail.y + rail.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1400);
await shot("03-scrubbed");

// library sheet
await page.getByRole("button", { name: /Tape library/ }).click();
await page.waitForTimeout(700);
await shot("04-library");

// a second device size, to catch cramped layouts
const wide = await context.newPage();
await wide.setViewportSize({ width: 1280, height: 800 });
await wide.goto(url, { waitUntil: "networkidle" });
await wide.waitForTimeout(1200);
await wide.screenshot({ path: path.join(outDir, "05-desktop.png") });
console.log("  wrote .preview/05-desktop.png");

// small phone
const small = await context.newPage();
await small.setViewportSize({ width: 360, height: 640 });
await small.goto(url, { waitUntil: "networkidle" });
await small.waitForTimeout(1200);
await small.screenshot({ path: path.join(outDir, "06-small.png") });
console.log("  wrote .preview/06-small.png");

await browser.close();
server.close();

if (problems.length) {
  console.log("\nConsole problems:");
  for (const p of [...new Set(problems)]) console.log("  " + p);
  process.exitCode = 1;
} else {
  console.log("\nNo console errors.");
}
