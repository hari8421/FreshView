/**
 * Functional check of the cassette mechanics in a real browser:
 *  - do the reels visibly turn while playing?
 *  - does the tape pack actually transfer from the supply reel to the take-up
 *    reel as the track advances?
 *  - is the static part of the shell still (i.e. the diff is the tape, not a
 *    whole-frame flicker)?
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { serveDist, listen } from "./lib/static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = serveDist(root);
const url = await listen(server);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
page.on("pageerror", (e) => console.log("  PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("  CONSOLE:", m.text());
});
// record every Audio element the app creates so we can inspect it directly
await page.addInitScript(() => {
  const Native = window.Audio;
  window.__audios = [];
  window.Audio = function (...args) {
    const el = new Native(...args);
    window.__audios.push(el);
    return el;
  };
  window.Audio.prototype = Native.prototype;
});
await page.goto(url, { waitUntil: "networkidle" });

const packRadii = () =>
  page.evaluate(() => {
    const l = document.querySelector('svg circle[cx="112"]');
    const r = document.querySelector('svg circle[cx="228"]');
    return { supply: Number(l?.getAttribute("r")), takeUp: Number(r?.getAttribute("r")) };
  });

/* ------------------------------------------------- pixel diff over the reels */

const rawOf = (buf) =>
  execFileSync("ffmpeg", ["-v", "error", "-i", "pipe:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], {
    input: buf,
  });
const clip = async (name) => {
  const b = await page.screenshot({ clip: await page.locator("svg").first().boundingBox() });
  fs.writeFileSync(`/tmp/${name}.png`, b);
  return { raw: rawOf(b), w: page.viewportSize().width };
};

await page.getByRole("button", { name: "Play", exact: true }).first().click();
await page.waitForTimeout(1200);

const box = await page.locator("svg").first().boundingBox();
const reelsClip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };

const frame = async () => {
  const b = await page.screenshot({ clip: reelsClip });
  return execFileSync("ffmpeg", ["-v", "error", "-i", "pipe:0", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { input: b });
};

const diff = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};

const w = reelsClip.width;
const h = reelsClip.height;
// reel discs in svg units -> frame pixels (viewBox 340x224)
const sx = w / 340;
const sy = h / 224;
const reelBox = (cx) => ({ x0: Math.round((cx - 40) * sx), x1: Math.round((cx + 40) * sx), y0: Math.round((132 - 40) * sy), y1: Math.round((132 + 40) * sy) });
const labelBox = { x0: Math.round(40 * sx), x1: Math.round(300 * sx), y0: Math.round(22 * sy), y1: Math.round(36 * sy) };

const region = (raw, box) => {
  const out = [];
  for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) out.push(raw[y * w + x]);
  return out;
};
const diffIn = (a, b, box) => {
  const ra = region(a, box);
  const rb = region(b, box);
  let sum = 0;
  for (let i = 0; i < ra.length; i++) sum += Math.abs(ra[i] - rb[i]);
  return sum / ra.length;
};

const f1 = await frame();
await page.waitForTimeout(260);
const f2 = await frame();
await page.waitForTimeout(260);
const f3 = await frame();

const reelL = reelBox(112);
const reelR = reelBox(228);

console.log("reel motion (mean pixel delta between frames):");
console.log(`  supply reel : ${diffIn(f1, f2, reelL).toFixed(2)} -> ${diffIn(f2, f3, reelL).toFixed(2)}`);
console.log(`  take-up reel: ${diffIn(f1, f2, reelR).toFixed(2)} -> ${diffIn(f2, f3, reelR).toFixed(2)}`);
console.log(`  static label: ${diffIn(f1, f2, labelBox).toFixed(2)} (should stay near 0)`);
console.log(`  whole frame : ${diff(f1, f2).toFixed(2)}`);

console.log("\ntape pack radius (supply should shrink, take-up should grow):");
const start = await packRadii();
// jump most of the way through the track with a real click on the rail
const rail = await page.locator('[role="slider"]').boundingBox();
await page.mouse.click(rail.x + rail.width * 0.8, rail.y + rail.height / 2);
await page.waitForTimeout(500);
const afterClick = await page.evaluate(() => {
  const nums = document.body.innerText.match(/\d+:\d\d/g) ?? [];
  return nums.slice(0, 2);
});
console.log(`  clock after clicking 80% of the rail: ${afterClick.join(" / ")}`);
const audioState = await page.evaluate(() =>
  (window.__audios ?? []).map((a) => ({
    duration: Number(a.duration.toFixed(1)),
    currentTime: Number(a.currentTime.toFixed(2)),
    seekable: a.seekable.length ? `${a.seekable.start(0).toFixed(0)}-${a.seekable.end(0).toFixed(0)}` : "none",
    paused: a.paused,
  })),
);
console.log("  audio element:", JSON.stringify(audioState[0]));

await page.waitForTimeout(600);
const end = await packRadii();
console.log(`  at ~0%:  supply ${start.supply}  take-up ${start.takeUp}`);
console.log(`  after seek: supply ${end.supply}  take-up ${end.takeUp}`);
console.log(
  `  verdict: ${end.supply < start.supply - 1 && end.takeUp > start.takeUp + 1 ? "tape transfers correctly" : "TAPE DID NOT MOVE"}`,
);

// spectrum should be alive while playing
const bars = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) lit++;
  return lit;
});
console.log(`\nspectrum lit pixels while playing: ${bars}`);

await browser.close();
server.close();
