import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = process.env.RESPONSIVE_TEST_BASE_URL ?? 'http://127.0.0.1:18512';
const chromiumPath = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/repl/tools/bin/chromium';
const routes = ['/', '/about', '/services', '/work', '/#skills', '/resume', '/contact'];
const reducedMotionRoutes = new Set([...routes, '/privacy']);
const viewports = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function stopBrowser(browser, profileDir) {
  let exited = browser.exitCode !== null || browser.signalCode !== null;
  const exit = exited ? Promise.resolve() : new Promise(resolve => browser.once('exit', resolve));
  if (!exited) browser.kill('SIGTERM');
  const stopped = await Promise.race([exit.then(() => true), sleep(2000).then(() => false)]);
  if (!stopped) {
    browser.kill('SIGKILL');
    await exit;
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function waitFor(predicate, description, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function startBrowser() {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'portfolio-responsive-'));
  const browser = spawn(chromiumPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const activePortPath = path.join(profileDir, 'DevToolsActivePort');
    const activePort = await waitFor(async () => {
      if (browser.exitCode !== null) throw new Error(`Chromium exited with code ${browser.exitCode}`);
      try {
        return (await readFile(activePortPath, 'utf8')).split('\n')[0];
      } catch {
        return null;
      }
    }, 'Chromium DevTools');
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    assert.equal(response.ok, true, 'Chromium must expose its DevTools target list');
    const targets = await response.json();
    const target = targets.find(item => item.type === 'page');
    assert.ok(target?.webSocketDebuggerUrl, 'Chromium must open a page target');
    return { browser, profileDir, activePort, target };
  } catch (error) {
    await stopBrowser(browser, profileDir);
    throw error;
  }
}

function connectToPage(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const eventWaiters = new Map();
  let nextId = 0;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }

    const waiters = eventWaiters.get(message.method) ?? [];
    eventWaiters.delete(message.method);
    waiters.forEach(({ resolve, timer }) => {
      clearTimeout(timer);
      resolve(message.params);
    });
  });

  function command(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chromium command timed out: ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function event(name, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = eventWaiters.get(name) ?? [];
        eventWaiters.set(name, waiters.filter(waiter => waiter.resolve !== resolve));
        reject(new Error(`Chromium event timed out: ${name}`));
      }, timeout);
      const waiters = eventWaiters.get(name) ?? [];
      waiters.push({ resolve, reject, timer });
      eventWaiters.set(name, waiters);
    });
  }

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return { socket, command, event, ready };
}

const inspectPage = `(() => {
  const width = window.innerWidth;
  const overflowElements = [...document.querySelectorAll('body *')]
    .filter(element => element.getClientRects().length)
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        element: element.tagName.toLowerCase() + (element.className && typeof element.className === 'string' ? '.' + element.className.trim().replace(/\\s+/g, '.') : ''),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        overflow: getComputedStyle(element).overflow,
      };
    })
    .filter(element => element.left < -1 || element.right > width + 1)
    .slice(0, 12);
  const scrollOverflowElements = [...document.querySelectorAll('html, body, .route-stage, .site-public, .hero-next, .hero-portrait, .hero-image-wrap')]
    .filter(element => element.scrollWidth > element.clientWidth + 1)
    .map(element => ({
      element: element.tagName.toLowerCase() + (typeof element.className === 'string' && element.className ? '.' + element.className.trim().replace(/\\s+/g, '.') : ''),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      rectLeft: Math.round(element.getBoundingClientRect().left * 10) / 10,
      rectRight: Math.round(element.getBoundingClientRect().right * 10) / 10,
      beforeTransform: getComputedStyle(element, '::before').transform,
      beforeAnimation: getComputedStyle(element, '::before').animationName,
      children: [...element.children].map(child => ({
        className: typeof child.className === 'string' ? child.className : child.tagName,
        width: child.clientWidth,
        scrollWidth: child.scrollWidth,
        left: Math.round(child.getBoundingClientRect().left * 10) / 10,
        right: Math.round(child.getBoundingClientRect().right * 10) / 10,
        transform: getComputedStyle(child).transform,
      })),
    }));
  const allScrollOverflowElements = [...document.querySelectorAll('html, body, .site-public *')]
    .filter(element => element.scrollWidth > element.clientWidth + 1)
    .slice(0, 20)
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        element: element.tagName.toLowerCase() + (typeof element.className === 'string' && element.className ? '.' + element.className.trim().replace(/\\s+/g, '.') : ''),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        overflowX: getComputedStyle(element).overflowX,
      };
    });
  const textClips = [];
  const imageClips = [];
  const isHidden = node => {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (element.closest('[aria-hidden="true"]')) return true;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
    }
    return false;
  };
  const clipBounds = element => {
    const rect = element.getBoundingClientRect();
    const xScale = element.offsetWidth ? rect.width / element.offsetWidth : 1;
    const yScale = element.offsetHeight ? rect.height / element.offsetHeight : 1;
    return {
      left: rect.left + element.clientLeft * xScale,
      right: rect.left + (element.clientLeft + element.clientWidth) * xScale,
      top: rect.top + element.clientTop * yScale,
      bottom: rect.top + (element.clientTop + element.clientHeight) * yScale,
    };
  };

  const walker = document.createTreeWalker(document.querySelector('.site-public') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim() || isHidden(node)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const textRect of range.getClientRects()) {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';
        const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';
        if (!clipsX && !clipsY) continue;
        const box = clipBounds(parent);
        const clipped = (clipsX && (textRect.left < box.left - 2 || textRect.right > box.right + 2))
          || (clipsY && (textRect.top < box.top - 2 || textRect.bottom > box.bottom + 2));
        if (clipped) {
          textClips.push((node.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60)));
          break;
        }
      }
    }
  }

  for (const image of document.querySelectorAll('.site-public img')) {
    if (!image.getClientRects().length) continue;
    const rect = image.getBoundingClientRect();
    if (rect.left < -2 || rect.right > width + 2) {
      imageClips.push({
        image: image.alt || image.currentSrc || 'unnamed image',
        reason: 'viewport edge',
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
      });
    }
    for (let parent = image.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!['hidden', 'clip'].includes(style.overflowX) && !['hidden', 'clip'].includes(style.overflowY)) continue;
      const box = clipBounds(parent);
      if (rect.left < box.left - 2 || rect.right > box.right + 2
        || rect.top < box.top - 2 || rect.bottom > box.bottom + 2) {
        imageClips.push({
          image: image.alt || image.currentSrc || 'unnamed image',
          reason: 'clipping ancestor ' + parent.tagName.toLowerCase() + (typeof parent.className === 'string' && parent.className ? '.' + parent.className.trim().replace(/\\s+/g, '.') : ''),
          imageLeft: Math.round(rect.left * 10) / 10,
          imageRight: Math.round(rect.right * 10) / 10,
          clipLeft: Math.round(box.left * 10) / 10,
          clipRight: Math.round(box.right * 10) / 10,
          imageTop: Math.round(rect.top * 10) / 10,
          imageBottom: Math.round(rect.bottom * 10) / 10,
          clipTop: Math.round(box.top * 10) / 10,
          clipBottom: Math.round(box.bottom * 10) / 10,
        });
        break;
      }
    }
  }

  return {
    width,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    layout: {
      innerWidth: window.innerWidth,
      rootClientWidth: document.documentElement.clientWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      routeRect: (() => {
        const rect = document.querySelector('.route-stage')?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
      })(),
      publicRect: (() => {
        const rect = document.querySelector('.site-public')?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
      })(),
      visualViewportWidth: visualViewport?.width ?? null,
    },
    overflowElements,
    scrollOverflowElements,
    allScrollOverflowElements,
    textClips: [...new Set(textClips)],
    imageClips: [...new Set(imageClips)],
    routeHasHeading: Boolean(document.querySelector('.site-public h1, .privacy-notice-page h1')),
    transition: (() => {
      const page = document.querySelector('.site-public');
      return page ? getComputedStyle(page).animationName : 'none';
    })(),
    magic: (() => {
      const element = document.querySelector('.page-magic');
      if (!element) return null;
      return {
        overflow: getComputedStyle(element).overflow,
        glimmer: getComputedStyle(element, '::before').animationName,
        sweep: getComputedStyle(element, '::after').animationName,
      };
    })(),
    revealCount: document.querySelectorAll('.reveal').length,
    unrevealedCount: document.querySelectorAll('.reveal:not(.is-in)').length,
  };
})()`;

async function main() {
  const response = await fetch(baseUrl, { redirect: 'manual' });
  assert.equal(response.status, 200, `Portfolio server must be running at ${baseUrl}`);

  const { browser, profileDir, activePort, target } = await startBrowser();
  const page = connectToPage(target.webSocketDebuggerUrl);
  let revealTargets = 0;
  try {
    await page.ready;
    await page.command('Page.enable');
    await page.command('Runtime.enable');
    await page.command('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 640,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });

    const firstLoad = page.event('Page.loadEventFired');
    await page.command('Page.navigate', { url: baseUrl });
    await firstLoad;
    await waitFor(async () => await page.command('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".visitor-intake__card"))',
      returnByValue: true,
    }).then(result => result.result.value), 'visitor gate');
    await sleep(1000);

    const gate = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const gate = document.querySelector('[data-testid="visitor-intake-gate"]');
        const card = gate?.querySelector('.visitor-intake__card');
        if (!gate || !card) return null;
        const gateRect = gate.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        return {
          position: getComputedStyle(gate).position,
          left: gateRect.left,
          right: gateRect.right,
          cardLeft: cardRect.left,
          cardRight: cardRect.right,
          cardTop: cardRect.top,
          cardBottom: cardRect.bottom,
          viewportHeight: innerHeight,
          cardScrolls: card.scrollHeight > card.clientHeight,
          headingVisible: Boolean(card.querySelector('.visitor-intake__heading')?.getClientRects().length),
          submitVisible: Boolean(card.querySelector('.visitor-intake__submit')?.getClientRects().length),
        };
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);

    assert.equal(gate.position, 'fixed', 'Visitor gate must stay fixed to the viewport');
    assert.ok(gate.left >= -1 && gate.right <= 321, 'Visitor gate backdrop must fit the narrow viewport');
    assert.ok(gate.cardLeft >= 0 && gate.cardRight <= 320, 'Visitor gate card must fit the narrow viewport');
    assert.ok(gate.cardTop >= 0 && gate.cardBottom <= gate.viewportHeight, 'Visitor gate card must remain on-screen');
    assert.ok(gate.headingVisible && gate.submitVisible, 'Visitor gate heading and continue button must remain visible');
    console.log('PASS visitor gate remains fixed and readable at 320×640');

    await page.command('Runtime.evaluate', {
      expression: `localStorage.setItem('kaveri-visitor-intake-complete', 'true')`,
    });

    for (const viewport of viewports) {
      await page.command('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: true });

      for (const route of routes) {
        const routeUrl = new URL(route, baseUrl);
        const expectedLocation = `${routeUrl.pathname}${routeUrl.search}${routeUrl.hash}`;
        await page.command('Page.navigate', { url: routeUrl.toString() });
        let routeState;
        try {
          await waitFor(async () => await page.command('Runtime.evaluate', {
          expression: `(() => {
            const gate = document.querySelector('[data-testid="visitor-intake-gate"]');
            const expectedLocation = ${JSON.stringify(expectedLocation)};
            return {
              ready: location.pathname + location.search + location.hash === expectedLocation &&
                document.readyState === 'complete' &&
                Boolean(document.querySelector('.site-public h1, .privacy-notice-page h1')) &&
                (!gate || getComputedStyle(gate).display === 'none'),
              heading: Boolean(document.querySelector('.site-public h1, .privacy-notice-page h1')),
              gateDisplay: gate ? getComputedStyle(gate).display : null,
              gateComplete: Boolean(document.documentElement?.classList.contains('visitor-intake-complete')),
              marker: localStorage.getItem('kaveri-visitor-intake-complete'),
            };
          })()`,
          returnByValue: true,
          }).then(result => {
            routeState = result?.result?.value;
            if (!routeState) {
              throw new Error(`Route inspection failed: ${JSON.stringify(result?.exceptionDetails ?? result?.result ?? result)}`);
            }
            return routeState.ready;
          }), `page content for ${route}`);
        } catch (error) {
          throw new Error(`${error.message}; route state: ${JSON.stringify(routeState) ?? 'unavailable'}`);
        }
        const duringTransition = await page.command('Runtime.evaluate', {
          expression: `(() => {
            const publicPage = document.querySelector('.site-public');
            return {
              width: innerWidth,
              documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
              hasPublicPage: Boolean(publicPage),
              transform: publicPage ? getComputedStyle(publicPage).transform : null,
            };
          })()`,
          returnByValue: true,
        }).then(result => result.result.value);
        assert.ok(duringTransition?.documentWidth <= viewport.width + 1,
          `${route} at ${viewport.width}px overflows during its page transition (${duringTransition?.documentWidth ?? 'unknown'}px, ${duringTransition?.transform ?? 'page not rendered'})`);
        await sleep(250);

        const initial = await page.command('Runtime.evaluate', { expression: inspectPage, returnByValue: true })
          .then(result => result.result.value);
        assert.equal(initial.routeHasHeading, true, `${route} must render its public page heading`);
        const linkedPublicRoutes = await page.command('Runtime.evaluate', {
          expression: `Array.from(document.querySelectorAll('a[href^="/services/"],a[href^="/work/"]'))
            .map(anchor => anchor.getAttribute('href')).filter(Boolean)`,
          returnByValue: true,
        }).then(result => result.result.value);
        for (const linkedRoute of linkedPublicRoutes) {
          reducedMotionRoutes.add(linkedRoute);
        }
        if (route !== '/privacy') {
          assert.ok(initial.transition.includes('public-page-enter'), `${route} must retain the page transition`);
        }
        assert.equal(initial.magic?.overflow, 'hidden', `${route} page transition accents must stay clipped to their container`);
        assert.ok(initial.magic?.glimmer.includes('magic-glimmer') && initial.magic?.sweep.includes('magic-sweep'),
          `${route} must retain both page-transition effects`);
        assert.ok(initial.documentWidth <= viewport.width + 1,
          `${route} at ${viewport.width}px has horizontal overflow (${initial.documentWidth}px); layout: ${JSON.stringify(initial.layout)}; outside elements: ${JSON.stringify(initial.overflowElements)}; scroll containers: ${JSON.stringify(initial.scrollOverflowElements)}; all: ${JSON.stringify(initial.allScrollOverflowElements)}`);
        assert.deepEqual(initial.textClips, [], `${route} at ${viewport.width}px has clipped text: ${initial.textClips.join(', ')}`);
        assert.deepEqual(initial.imageClips, [], `${route} at ${viewport.width}px has clipped images: ${initial.imageClips.join(', ')}`);

        const revealResult = await page.command('Runtime.evaluate', {
          expression: `(async () => {
            const step = Math.max(240, innerHeight * 0.72);
            const end = document.documentElement.scrollHeight;
            document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
            for (let top = 0; top < end; top += step) {
              window.scrollTo({ top, behavior: 'instant' });
              await new Promise(resolve => setTimeout(resolve, 90));
            }
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
            await new Promise(resolve => setTimeout(resolve, 180));
            return {
              count: document.querySelectorAll('.reveal').length,
              unrevealed: document.querySelectorAll('.reveal:not(.is-in)').length,
              hidden: [...document.querySelectorAll('.reveal:not(.is-in)')].map(element => ({
                element: element.tagName.toLowerCase() + '.' + element.className,
                top: Math.round(element.getBoundingClientRect().top),
                bottom: Math.round(element.getBoundingClientRect().bottom),
                text: element.textContent.trim().replace(/\\s+/g, ' ').slice(0, 50),
              })),
            };
          })()`,
          awaitPromise: true,
          returnByValue: true,
        }).then(result => result.result.value);
        assert.equal(revealResult.count, initial.revealCount, `${route} changed its scroll reveal targets while scrolling`);
        revealTargets += revealResult.count;
        assert.equal(revealResult.unrevealed, 0, `${route} has scroll reveals still hidden after scrolling: ${JSON.stringify(revealResult.hidden)}`);

        const afterScroll = await page.command('Runtime.evaluate', { expression: inspectPage, returnByValue: true })
          .then(result => result.result.value);
        assert.ok(afterScroll.documentWidth <= viewport.width + 1,
          `${route} at ${viewport.width}px overflows horizontally after reveals (${afterScroll.documentWidth}px)`);
        assert.deepEqual(afterScroll.textClips, [], `${route} at ${viewport.width}px clips text after reveals`);
        assert.deepEqual(afterScroll.imageClips, [], `${route} at ${viewport.width}px clips images after reveals`);

        console.log(`PASS ${route} at ${viewport.width}px: no horizontal overflow or clipped text/images; ${revealResult.count} reveals settled`);
      }
    }
    assert.ok(revealTargets > 0, 'The route set must exercise scroll reveals');

    await page.command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
    await page.command('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.command('Page.navigate', { url: baseUrl });
    await waitFor(async () => await page.command('Runtime.evaluate', {
      expression: `location.pathname === '/' && document.readyState === 'complete' &&
        Boolean(document.querySelector('.hero-portrait'))`,
      returnByValue: true,
    }).then(result => result.result.value), 'home portrait before pointer testing');
    await sleep(100);
    const portraitBounds = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const rect = document.querySelector('.hero-portrait')?.getBoundingClientRect();
        return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(portraitBounds, 'Home must render the portrait for pointer testing');
    await page.command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: portraitBounds.left + portraitBounds.width - 1,
      y: portraitBounds.top + 1,
      buttons: 0,
    });
    await sleep(60);
    const mouseTilt = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const portrait = document.querySelector('.hero-portrait');
        if (!portrait) return null;
        return {
          x: portrait.style.getPropertyValue('--portrait-tilt-x'),
          y: portrait.style.getPropertyValue('--portrait-tilt-y'),
        };
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(mouseTilt?.x && mouseTilt?.y && mouseTilt.x !== '0deg' && mouseTilt.y !== '0deg',
      'Fine-pointer movement must tilt the portrait');
    const tiltOverflow = await page.command('Runtime.evaluate', {
      expression: 'Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)',
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(tiltOverflow <= 376, `Portrait tilt causes horizontal overflow (${tiltOverflow}px)`);
    await page.command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 0,
      y: 0,
      buttons: 0,
    });
    await sleep(60);
    const resetTilt = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const portrait = document.querySelector('.hero-portrait');
        return [portrait?.style.getPropertyValue('--portrait-tilt-x'), portrait?.style.getPropertyValue('--portrait-tilt-y')];
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.deepEqual(resetTilt, ['0deg', '0deg'], 'Portrait tilt must reset after the pointer leaves');

    await page.command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await page.command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const touchBounds = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const rect = document.querySelector('.hero-portrait')?.getBoundingClientRect();
        return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(touchBounds, 'Home must render the portrait for touch testing');
    await page.command('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: touchBounds.x, y: touchBounds.y }],
    });
    await page.command('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: touchBounds.x + 8, y: touchBounds.y + 8 }],
    });
    const touchTilt = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const portrait = document.querySelector('.hero-portrait');
        if (!portrait) return null;
        return [portrait.style.getPropertyValue('--portrait-tilt-x'), portrait.style.getPropertyValue('--portrait-tilt-y')];
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.deepEqual(touchTilt, ['0deg', '0deg'], 'Touch movement must not apply portrait tilt');
    await page.command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const touchOverflow = await page.command('Runtime.evaluate', {
      expression: 'Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)',
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(touchOverflow <= 376, `Touch interaction causes horizontal overflow (${touchOverflow}px)`);
    console.log('PASS fine-pointer portrait tilt works and resets; touch input stays stable');

    await page.command('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await page.command('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const route of reducedMotionRoutes) {
      const routeUrl = new URL(route, baseUrl);
      const expectedLocation = `${routeUrl.pathname}${routeUrl.search}${routeUrl.hash}`;
      await page.command('Page.navigate', { url: routeUrl.toString() });
      await waitFor(async () => await page.command('Runtime.evaluate', {
        expression: `(() => {
          const gate = document.querySelector('[data-testid="visitor-intake-gate"]');
          const expectedLocation = ${JSON.stringify(expectedLocation)};
          return location.pathname + location.search + location.hash === expectedLocation &&
            document.readyState === 'complete' &&
            Boolean(document.querySelector('.site-public h1, .privacy-notice-page h1')) &&
            (!gate || getComputedStyle(gate).display === 'none');
        })()`,
        returnByValue: true,
      }).then(result => result.result.value), `reduced-motion page content for ${route}`);

      const reducedMotionState = await page.command('Runtime.evaluate', {
        expression: `(() => {
          const publicPage = document.querySelector('.route-stage > .site-public');
          const privacyPage = document.querySelector('.privacy-notice-page');
          const page = publicPage ?? privacyPage;
          const heading = publicPage?.querySelector('h1');
          const contentHeading = heading ?? privacyPage?.querySelector('h1');
          const magic = document.querySelector('.page-magic');
          const portrait = document.querySelector('.hero-portrait');
          const reveals = [...document.querySelectorAll('.reveal')];
          return {
            preferenceEnabled: matchMedia('(prefers-reduced-motion: reduce)').matches,
            headingVisible: Boolean(contentHeading?.getClientRects().length) &&
              getComputedStyle(contentHeading).visibility !== 'hidden' &&
              getComputedStyle(contentHeading).opacity === '1',
            pageAnimation: page ? getComputedStyle(page).animationName : null,
            pageTransform: page ? getComputedStyle(page).transform : null,
            magicDisplay: magic ? getComputedStyle(magic).display : null,
            magicGlimmer: magic ? getComputedStyle(magic, '::before').animationName : null,
            magicSweep: magic ? getComputedStyle(magic, '::after').animationName : null,
            revealFailures: reveals.filter(element => {
              const style = getComputedStyle(element);
              return !element.getClientRects().length || style.opacity !== '1' ||
                style.transform !== 'none' || style.animationName !== 'none';
            }).map(element => element.className),
            portrait: portrait ? {
              animation: getComputedStyle(portrait).animationName,
              transform: getComputedStyle(portrait).transform,
              frameAnimation: getComputedStyle(portrait, '::before').animationName,
              frameTransform: getComputedStyle(portrait, '::before').transform,
            } : null,
          };
        })()`,
        returnByValue: true,
      }).then(result => result.result.value);

      assert.equal(reducedMotionState.preferenceEnabled, true, `${route} must use the reduced-motion emulation`);
      assert.equal(reducedMotionState.headingVisible, true, `${route} must show its heading immediately`);
      assert.equal(reducedMotionState.pageAnimation, 'none', `${route} page transition must be disabled`);
      assert.equal(reducedMotionState.pageTransform, 'none', `${route} page transform must be disabled`);
      assert.equal(reducedMotionState.magicDisplay, 'none', `${route} page-magic overlay must be hidden`);
      assert.equal(reducedMotionState.magicGlimmer, 'none', `${route} page-magic glimmer must be disabled`);
      assert.equal(reducedMotionState.magicSweep, 'none', `${route} page-magic sweep must be disabled`);
      assert.deepEqual(reducedMotionState.revealFailures, [],
        `${route} must show every reveal without animation: ${JSON.stringify(reducedMotionState.revealFailures)}`);
      if (reducedMotionState.portrait) {
        assert.equal(reducedMotionState.portrait.animation, 'none', `${route} portrait float must be disabled`);
        assert.equal(reducedMotionState.portrait.transform, 'none', `${route} portrait tilt must be disabled`);
        assert.equal(reducedMotionState.portrait.frameAnimation, 'none', `${route} portrait frame animation must be disabled`);
        assert.equal(reducedMotionState.portrait.frameTransform, 'none', `${route} portrait frame transform must be disabled`);
      }
      console.log(`PASS ${route} with reduced motion: content is immediately visible and motion effects are disabled`);
    }

    await page.command('Page.navigate', { url: baseUrl });
    await waitFor(async () => await page.command('Runtime.evaluate', {
      expression: `location.pathname === '/' && document.readyState === 'complete' &&
        Boolean(document.querySelector('.hero-portrait'))`,
      returnByValue: true,
    }).then(result => result.result.value), 'home portrait before reduced-motion pointer testing');
    const reducedPortraitBounds = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const rect = document.querySelector('.hero-portrait')?.getBoundingClientRect();
        return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.ok(reducedPortraitBounds, 'Home must render the portrait for reduced-motion pointer testing');
    await page.command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: reducedPortraitBounds.left + reducedPortraitBounds.width - 1,
      y: reducedPortraitBounds.top + 1,
      buttons: 0,
    });
    await sleep(60);
    const reducedMotionTilt = await page.command('Runtime.evaluate', {
      expression: `(() => {
        const portrait = document.querySelector('.hero-portrait');
        if (!portrait) return null;
        return [
          portrait.style.getPropertyValue('--portrait-tilt-x'),
          portrait.style.getPropertyValue('--portrait-tilt-y'),
        ];
      })()`,
      returnByValue: true,
    }).then(result => result.result.value);
    assert.deepEqual(reducedMotionTilt, ['0deg', '0deg'],
      'Portrait pointer movement must not add tilt when reduced motion is enabled');
    console.log('PASS reduced-motion pointer movement leaves the portrait level');
  } finally {
    page.socket.close();
    await stopBrowser(browser, profileDir);
  }
}

main().catch(error => {
  console.error(`Responsive motion regression failed: ${error.stack ?? error}`);
  process.exitCode = 1;
});
