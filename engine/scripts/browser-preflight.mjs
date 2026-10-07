// Fail before compilation if Chrome cannot start (missing browser/dependencies,
// socket path, sandbox). Real Forge browser tests still run after compilation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "om-browser-"));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.OPENMANA_CHROME || chromium.executablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = context.pages()[0] || await context.newPage();
  console.log(`Browser preflight: ${await page.evaluate(() => navigator.userAgent)}`);
} finally {
  await context?.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
