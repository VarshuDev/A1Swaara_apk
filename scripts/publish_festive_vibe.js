#!/usr/bin/env node

/**
 * A1 Swaara Live Festive Vibe Broadcast Engine (OTA)
 * Broadcasts instant festive themes, SVGs/images, greetings, and curated actions
 * to all A1 Swaara clients via Cloud Firestore without requiring an APK update.
 *
 * Usage:
 *   node scripts/publish_festive_vibe.js --preset diwali
 *   node scripts/publish_festive_vibe.js --preset christmas
 *   node scripts/publish_festive_vibe.js --preset newyear
 *   node scripts/publish_festive_vibe.js --preset holi
 *   node scripts/publish_festive_vibe.js --preset eid
 *   node scripts/publish_festive_vibe.js --disable
 *
 * Custom Usage:
 *   node scripts/publish_festive_vibe.js --title "Grand Festive Drop" --message "Exclusive celebration acoustics" --accent "#FF9900" --secondary "#FF2DAA" --badge "FESTIVE SPECIAL" --image "https://example.com/festive.png" --action "diwali hits"
 */

const https = require('https');

const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const isDisable = args.includes('--disable') || args.includes('--off');
const presetName = (getArg('--preset') || 'diwali').toLowerCase();

const PRESETS = {
    diwali: {
        id: 'festive_diwali_' + new Date().getFullYear(),
        festivalName: 'Diwali',
        title: 'Happy Diwali!',
        message: 'Celebrate the festival of lights with divine lossless acoustics & booming bass.',
        badgeText: 'DIWALI SPECIAL',
        accentColorHex: '#FF9900',
        secondaryColorHex: '#FFD700',
        actionText: 'Play Diwali Hits',
        actionUrl: 'diwali songs',
        bannerImageUrl: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=240&auto=format&fit=crop&q=80'
    },
    christmas: {
        id: 'festive_christmas_' + new Date().getFullYear(),
        festivalName: 'Christmas',
        title: 'Merry Christmas & Season\'s Greetings',
        message: 'Warm holiday melodies and cozy acoustic vibes in lossless sound.',
        badgeText: 'HOLIDAY SPECIAL',
        accentColorHex: '#E50914',
        secondaryColorHex: '#00E676',
        actionText: 'Play Holiday Songs',
        actionUrl: 'christmas songs',
        bannerImageUrl: 'https://images.unsplash.com/photo-1543258103-a62bdc069871?w=240&auto=format&fit=crop&q=80'
    },
    newyear: {
        id: 'festive_newyear_' + (new Date().getFullYear() + 1),
        festivalName: 'New Year',
        title: 'Happy New Year!',
        message: 'Turn up the volume and ring in the new year with unthrottled party beats.',
        badgeText: 'NEW YEAR BASH',
        accentColorHex: '#8B35FF',
        secondaryColorHex: '#00F0FF',
        actionText: 'Play Party Bangers',
        actionUrl: 'new year party hits',
        bannerImageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=240&auto=format&fit=crop&q=80'
    },
    holi: {
        id: 'festive_holi_' + new Date().getFullYear(),
        festivalName: 'Holi',
        title: 'Happy Holi!',
        message: 'Splash into high-energy beats and vibrant festival anthems in CD-quality sound.',
        badgeText: 'HOLI COLOR BLAST',
        accentColorHex: '#FF007F',
        secondaryColorHex: '#00DFD8',
        actionText: 'Play Holi Beats',
        actionUrl: 'holi dance songs',
        bannerImageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=240&auto=format&fit=crop&q=80'
    },
    eid: {
        id: 'festive_eid_' + new Date().getFullYear(),
        festivalName: 'Eid',
        title: 'Eid Mubarak!',
        message: 'Celebrate blessed moments with soulful festive melodies in high fidelity.',
        badgeText: 'EID CELEBRATION',
        accentColorHex: '#10B981',
        secondaryColorHex: '#F59E0B',
        actionText: 'Play Soulful Melodies',
        actionUrl: 'eid special songs',
        bannerImageUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=240&auto=format&fit=crop&q=80'
    }
};

let config;
if (isDisable) {
    config = {
        enabled: false,
        id: 'disabled',
        festivalName: '',
        title: '',
        message: '',
        badgeText: '',
        accentColorHex: '#FFD700',
        secondaryColorHex: '#FF2DAA',
        actionText: '',
        actionUrl: '',
        bannerImageUrl: '',
        isDismissible: true
    };
} else {
    const base = PRESETS[presetName] || PRESETS.diwali;
    config = {
        enabled: true,
        id: getArg('--id') || base.id,
        festivalName: getArg('--festival') || base.festivalName,
        title: getArg('--title') || base.title,
        message: getArg('--message') || base.message,
        badgeText: getArg('--badge') || base.badgeText,
        accentColorHex: getArg('--accent') || base.accentColorHex,
        secondaryColorHex: getArg('--secondary') || base.secondaryColorHex,
        actionText: getArg('--action-text') || base.actionText,
        actionUrl: getArg('--action') || base.actionUrl,
        bannerImageUrl: getArg('--image') || base.bannerImageUrl,
        isDismissible: true
    };
}

const firestoreFields = {
    enabled: { booleanValue: config.enabled },
    id: { stringValue: config.id },
    festivalName: { stringValue: config.festivalName },
    title: { stringValue: config.title },
    message: { stringValue: config.message },
    badgeText: { stringValue: config.badgeText },
    accentColorHex: { stringValue: config.accentColorHex },
    secondaryColorHex: { stringValue: config.secondaryColorHex },
    actionText: { stringValue: config.actionText },
    actionUrl: { stringValue: config.actionUrl || '' },
    bannerImageUrl: { stringValue: config.bannerImageUrl || '' },
    isDismissible: { booleanValue: config.isDismissible },
    timestamp: { integerValue: Date.now().toString() }
};

const postData = JSON.stringify({ fields: firestoreFields });

const options = {
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/raaga-music-8e1f2/databases/(default)/documents/notifications/festive_broadcast?key=AIzaSyD8F5v--Ls6YXVCQ_5UhBY20scKJQu7Lxo',
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('Broadcasting Festive Vibe to Cloud Firestore...');
if (isDisable) {
    console.log('Action:       DISABLE (Festive banners turned off for all users)');
} else {
    console.log('Festival:     ' + config.festivalName + ' (ID: ' + config.id + ')');
    console.log('Title:        ' + config.title);
    console.log('Message:      ' + config.message);
    console.log('Badge:        ' + config.badgeText);
    console.log('Accent Color: ' + config.accentColorHex + ' -> ' + config.secondaryColorHex);
    console.log('Action:       ' + config.actionText + ' (' + config.actionUrl + ')');
    console.log('Artwork URL:  ' + (config.bannerImageUrl || 'None'));
}

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('\nSUCCESS: Festive vibe broadcast is now LIVE on all A1 Swaara clients via OTA!');
        } else {
            console.error('\nERROR: Failed to broadcast festive vibe (' + res.statusCode + ')');
            console.error(body);
        }
    });
});

req.on('error', (err) => {
    console.error('\nNetwork error:', err.message);
});

req.write(postData);
req.end();
