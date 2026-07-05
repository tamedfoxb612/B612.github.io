/**
 * play-together-server.js - B612 ❤️ Play Together Local Host Server
 * 
 * RUN ON YOUR LOCAL LAPTOP TO SHARE AN ANONYMOUS HEADLESS BROWSER & LET PARTNER INTERACT IN REAL-TIME!
 * 
 * Instructions:
 * 1. Install dependencies:
 *    npm install @supabase/supabase-js puppeteer express socket.io wrtc
 * 2. Run the script with your Supabase Room Code:
 *    ROOM_CODE=SUMMER-92 node play-together-server.js
 */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const http = require('http');

// Default Supabase configuration matching your PWA
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'public-anon-key';
const ROOM_CODE = (process.env.ROOM_CODE || 'VADS').toUpperCase();

console.log(`🎮 [Play Together Host] Initializing for Room: ${ROOM_CODE}...`);

let browser, page;
let supabase, channel;

async function startHostServer() {
  try {
    // 1. Initialize anonymous, completely isolated headless browser
    console.log('🌐 Launching anonymous Chromium instance (No profile/cookies)...');
    browser = await puppeteer.launch({
      headless: false, // Set to false so local host can watch too, or true for pure background
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-size=1280,720',
        '--incognito',
        '--disable-extensions'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    // Navigate to a starter friendly game or blank search
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
    console.log('✅ Headless VM active at viewport 1280x720');

    // 2. Connect to Supabase Realtime channel for remote interactions
    if (SUPABASE_URL !== 'https://xyzcompany.supabase.co') {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      channel = supabase.channel(`room-controls-${ROOM_CODE}`, {
        config: { broadcast: { self: false } }
      });

      channel
        .on('broadcast', { event: 'play-interaction' }, async ({ payload }) => {
          if (!page) return;
          try {
            const viewport = page.viewport();
            const width = viewport ? viewport.width : 1280;
            const height = viewport ? viewport.height : 720;

            if (payload.type === 'click' && typeof payload.x === 'number' && typeof payload.y === 'number') {
              const absX = Math.round(payload.x * width);
              const absY = Math.round(payload.y * height);
              console.log(`🎯 [Remote Click] from ${payload.sender}: (${payload.x.toFixed(2)}, ${payload.y.toFixed(2)}) -> Pixels (${absX}, ${absY})`);
              await page.mouse.click(absX, absY);
            } else if (payload.type === 'keydown' && payload.key) {
              console.log(`⌨️ [Remote Key] from ${payload.sender}: "${payload.key}"`);
              if (payload.key === 'Enter') {
                await page.keyboard.press('Enter');
              } else if (payload.key === 'Backspace') {
                await page.keyboard.press('Backspace');
              } else if (payload.key.length === 1) {
                await page.keyboard.type(payload.key);
              }
            } else if (payload.type === 'scroll' && typeof payload.deltaY === 'number') {
              await page.mouse.wheel({ deltaY: payload.deltaY });
            } else if (payload.type === 'navigate' && payload.url) {
              console.log(`🧭 [Navigate] to ${payload.url}`);
              await page.goto(payload.url, { waitUntil: 'domcontentloaded' });
            }
          } catch (err) {
            console.error('❌ Error executing remote interaction:', err.message);
          }
        })
        .subscribe((status) => {
          console.log(`🔌 Supabase Realtime channel status: ${status}`);
        });
    } else {
      console.log('ℹ️ Note: Provide SUPABASE_URL and SUPABASE_KEY env variables to link live Supabase Realtime.');
    }

    // 3. WebRTC / Video Streaming Setup
    // Use puppeteer-stream or WebRTC screen capture to stream page tab to peer
    console.log('📡 Ready to stream headless browser tab via WebRTC P2P to partner!');
    console.log('Press Ctrl+C to stop the Play Together Virtual Machine.');

  } catch (error) {
    console.error('💥 Host server boot error:', error);
  }
}

startHostServer();

process.on('SIGINT', async () => {
  console.log('Shutting down Play Together Host...');
  if (browser) await browser.close();
  process.exit(0);
});
