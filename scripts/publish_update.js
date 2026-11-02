#!/usr/bin/env node

/**
 * A1 Swaara Sovereign OTA Update Publisher
 * Publishes new app update manifests directly to Firebase Firestore (app_config/update).
 * No GitHub account required.
 *
 * Usage:
 *   node scripts/publish_update.js "1.1.3" 14 "https://your-apk-host.com/A1_Swaara_v1.1.3.apk" "Changelog details..." [forceUpdate=false]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

let version = args[0];
let versionCode = parseInt(args[1], 10);
let downloadUrl = args[2];
let changelog = args[3];
let forceUpdate = args[4] === 'true';

// Auto-read from version.json if parameters are omitted
if (!version) {
  const versionJsonPath = path.join(__dirname, '..', 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    const raw = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    version = raw.version || '1.1.2';
    versionCode = raw.versionCode || 13;
    downloadUrl = raw.downloadUrl || 'https://raaga-music-8e1f2.web.app/A1_Swaara_v1.1.2.apk';
    changelog = raw.changelog || 'Performance improvements and bug fixes.';
    forceUpdate = !!raw.forceUpdate;
    console.log('Read update parameters from version.json:');
  }
}

if (!version || isNaN(versionCode) || !downloadUrl) {
  console.log('Usage: node scripts/publish_update.js <version> <versionCode> <downloadUrl> <changelog> [forceUpdate]');
  console.log('Example: node scripts/publish_update.js 1.1.3 14 "https://example.com/A1_Swaara_v1.1.3.apk" "Fix audio glitch" false');
  process.exit(1);
}

const title = `A1 Swaara v${version}`;
const timestamp = Date.now().toString();

const postData = JSON.stringify({
  fields: {
    version: { stringValue: version },
    versionCode: { integerValue: versionCode.toString() },
    title: { stringValue: title },
    changelog: { stringValue: changelog || 'New features and improvements.' },
    downloadUrl: { stringValue: downloadUrl },
    forceUpdate: { booleanValue: forceUpdate },
    timestamp: { integerValue: timestamp }
  }
});

const options = {
  hostname: 'firestore.googleapis.com',
  path: '/v1/projects/raaga-music-8e1f2/databases/(default)/documents/app_config/update?key=AIzaSyD8F5v--Ls6YXVCQ_5UhBY20scKJQu7Lxo',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Publishing sovereign OTA update manifest to Cloud Firestore...');
console.log('Version:     v' + version + ' (Code: ' + versionCode + ')');
console.log('Title:       ' + title);
console.log('Download URL:' + downloadUrl);
console.log('Force Update:' + forceUpdate);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('\nSUCCESS: OTA update manifest published live to all A1 Swaara clients!');
    } else {
      console.error('\nERROR: Failed to publish update (' + res.statusCode + ')');
      console.error(body);
    }
  });
});

req.on('error', (err) => {
  console.error('\nNetwork error:', err.message);
});

req.write(postData);
req.end();
