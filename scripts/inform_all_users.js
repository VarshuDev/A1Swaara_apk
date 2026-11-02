#!/usr/bin/env node

/**
 * A1 Swaara Sovereign Unified Broadcaster
 * Informs all existing installed app users simultaneously through 3 independent channels:
 * 1. Android Status Bar Push Alert (Firestore notifications/broadcast)
 * 2. In-App OTA Update Dialog & Auto-Installer (Firestore app_config/update)
 * 3. In-App Home Screen Announcement Banner (Firestore remote_config/app)
 *
 * No GitHub account required.
 *
 * Usage:
 *   node scripts/inform_all_users.js [optionalCustomDownloadUrl]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let customUrl = args[0];

// Read manifest from version.json
const versionJsonPath = path.join(__dirname, '..', 'version.json');
let manifest = {
  version: '1.1.4',
  versionCode: 15,
  title: 'A1 Swaara v1.1.4 - Lossless Audio Engine',
  changelog: 'Apple Music-grade Lossless Audio Engine, 32-bit float output, real-time quality badges, and fixed leaderboards.',
  downloadUrl: 'https://raaga-music-8e1f2.web.app/A1_Swaara_v1.1.4.apk',
  forceUpdate: false
};

if (fs.existsSync(versionJsonPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    manifest = { ...manifest, ...raw };
  } catch (e) {
    console.warn('Could not parse version.json, using defaults:', e.message);
  }
}

const finalDownloadUrl = customUrl || manifest.downloadUrl;
const now = Date.now().toString();
const notifId = `broadcast_v${manifest.version.replace(/\./g, '')}_${now}`;

function sendFirestorePatch(documentPath, fields) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ fields });
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/raaga-music-8e1f2/databases/(default)/documents/${documentPath}?key=AIzaSyD8F5v--Ls6YXVCQ_5UhBY20scKJQu7Lxo`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log(` A1 SWAARA SOVEREIGN BROADCAST - v${manifest.version} (Code: ${manifest.versionCode})`);
  console.log('====================================================');
  console.log(`Target Download URL: ${finalDownloadUrl}`);
  console.log(`Title:               ${manifest.title}`);
  console.log('');

  try {
    // 1. Android Status Bar Push Alert (Background devices)
    console.log('[1/3] Arming System Status-Bar Push Alert (notifications/broadcast)...');
    await sendFirestorePatch('notifications/broadcast', {
      id: { stringValue: notifId },
      title: { stringValue: `A1 Swaara v${manifest.version} Update Available` },
      message: { stringValue: `New Lossless Audio Engine, 32-bit float output, and fixed leaderboards. Tap to update!` },
      actionUrl: { stringValue: finalDownloadUrl },
      enabled: { booleanValue: true },
      timestamp: { integerValue: now }
    });
    console.log('      System Status-Bar Push Alert armed successfully.');

    // 2. In-App OTA Update Dialog (Checks automatically on app startup)
    console.log('[2/3] Publishing In-App OTA Update Manifest (app_config/update)...');
    await sendFirestorePatch('app_config/update', {
      version: { stringValue: manifest.version },
      versionCode: { integerValue: manifest.versionCode.toString() },
      title: { stringValue: manifest.title },
      changelog: { stringValue: manifest.changelog },
      downloadUrl: { stringValue: finalDownloadUrl },
      forceUpdate: { booleanValue: !!manifest.forceUpdate },
      timestamp: { integerValue: now }
    });
    console.log('      In-App OTA Update Manifest published successfully.');

    // 3. In-App Home Screen Announcement Banner
    console.log('[3/3] Updating In-App Home Screen Announcement Banner (remote_config/app)...');
    await sendFirestorePatch('remote_config/app', {
      announcementId: { stringValue: `banner_${now}` },
      announcementTitle: { stringValue: `A1 Swaara v${manifest.version} is Live!` },
      announcementMessage: { stringValue: `Lossless Audio Engine, 32-bit float DAC rendering, and fixed community leaderboards.` },
      announcementActionUrl: { stringValue: finalDownloadUrl },
      announcementEnabled: { booleanValue: true },
      streamProxyMode: { stringValue: 'direct' },
      minRequiredVersion: { stringValue: '1.0.0' },
      recommendedBitrate: { stringValue: '320kbps' },
      activePipedInstances: {
        arrayValue: {
          values: [{ stringValue: 'https://pipedapi.kavin.rocks' }]
        }
      }
    });
    console.log('      In-App Home Screen Banner updated successfully.');

    console.log('');
    console.log('====================================================');
    console.log(' ALL 3 CHANNELS BROADCASTED SUCCESSFULLY');
    console.log(' All active and background users will receive this update.');
    console.log('====================================================');
  } catch (err) {
    console.error('ERROR broadcasting update:', err.message);
    process.exit(1);
  }
}

main();
