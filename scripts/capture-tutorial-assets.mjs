import { spawn } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = "http://127.0.0.1:8081";
const outputRoot = path.join(projectRoot, "output", "playwright", "tutorial");
const publicRoot = path.join(projectRoot, "public", "tutorial");
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screens = [
  "members-list", "member-new", "member-profile",
  "meetings-list", "meeting-new", "attendance",
  "calendar", "visit-new", "event-new",
  "notes-list", "note-edit", "notes-search",
  "account-profile", "notifications", "application",
];
const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

async function isDemoRouteAvailable() {
  try {
    const response = await fetch(`${baseUrl}/tutorial-demo/members-list`, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startLocalServerIfNeeded() {
  if (await isDemoRouteAvailable()) return null;

  const server = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "8081", "--strictPort"], {
    cwd: projectRoot,
    stdio: "ignore",
    windowsHide: true,
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite encerrou antes de iniciar (código ${server.exitCode}).`);
    if (await isDemoRouteAvailable()) return server;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  server.kill();
  throw new Error("O servidor local não ficou pronto em 30 segundos.");
}

async function captureScreen(page, viewport, screen) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/tutorial-demo/${screen}`, { waitUntil: "domcontentloaded" });
  await page.locator(`[data-demo-screen="${screen}"]`).waitFor({ state: "visible", timeout: 30000 });
  await page.locator("[data-tutorial-demo='ready']").waitFor({ state: "visible", timeout: 30000 });

  const outputPath = path.join(outputRoot, viewport.name, `${screen}.jpg`);
  const publicPath = path.join(publicRoot, viewport.name, `${screen}.jpg`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(publicPath), { recursive: true });
  await page.screenshot({ path: outputPath, type: "jpeg", quality: 78, animations: "disabled" });
  await copyFile(outputPath, publicPath);
  return stat(outputPath);
}

let localServer;
let browser;

try {
  localServer = await startLocalServerIfNeeded();
  browser = await chromium.launch({ headless: true });
  let fileCount = 0;
  let totalBytes = 0;

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    const page = await context.newPage();

    for (const screen of screens) {
      const file = await captureScreen(page, viewport, screen);
      fileCount += 1;
      totalBytes += file.size;
      console.log(`${viewport.name}: ${screen}.jpg (${Math.round(file.size / 1024)} KiB)`);
    }

    await context.close();
  }

  console.log(`Capturas geradas: ${fileCount}; tamanho total: ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB.`);
  console.log(`Originais: ${path.relative(projectRoot, outputRoot)}`);
  console.log(`Assets do tutorial: ${path.relative(projectRoot, publicRoot)}`);
} finally {
  await browser?.close();
  if (localServer && localServer.exitCode === null) localServer.kill();
}
