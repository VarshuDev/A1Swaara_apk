/**
 * Swaara Connect Service for Desktop (Windows PC / Web)
 * Bidirectional Cross-Device Handoff & Remote Control synchronized via Firestore REST API.
 * Mirrors Android's `com.varshudev.a1swaara.cloud.SwaaraConnectEngine`.
 */

const PROJECT_ID = 'raaga-music-8e1f2';
const API_KEY = 'AIzaSyD8F5v--Ls6YXVCQ_5UhBY20scKJQu7Lxo';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface ConnectDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastSeenMs: number;
  currentSongId: string;
  currentTitle: string;
  currentArtist: string;
  artworkUrl: string;
  positionMs: number;
  isPlaying: boolean;
}

export interface IncomingTransferCommand {
  command: string;
  songId: string;
  title: string;
  artist: string;
  artworkUrl: string;
  positionMs: number;
  fromDeviceId: string;
  timestamp: number;
}

const isElectron = typeof window !== 'undefined' && Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
export const LOCAL_CONNECT_DEVICE_ID = isElectron ? 'swaara-pc-desktop' : 'swaara-web-player';
export const LOCAL_CONNECT_DEVICE_NAME = isElectron ? 'Swaara PC (Windows)' : 'Swaara Web Player';
export const LOCAL_CONNECT_DEVICE_TYPE = isElectron ? 'windows' : 'web';

function toFirestoreFields(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') {
      fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return { fields };
}

function fromFirestoreFields(fields?: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = String(v.stringValue ?? '');
    else if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
    else if ('integerValue' in v) out[k] = Number(v.integerValue ?? 0);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue ?? 0);
  }
  return out;
}

export async function publishDesktopPresence(state: {
  songId: string;
  title: string;
  artist: string;
  artworkUrl: string;
  positionMs: number;
  isPlaying: boolean;
}): Promise<void> {
  try {
    await fetch(`${BASE_URL}/connect_devices/${LOCAL_CONNECT_DEVICE_ID}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toFirestoreFields({
          deviceId: LOCAL_CONNECT_DEVICE_ID,
          deviceName: LOCAL_CONNECT_DEVICE_NAME,
          deviceType: LOCAL_CONNECT_DEVICE_TYPE,
          lastSeenMs: Date.now(),
          currentSongId: state.songId || '',
          currentTitle: state.title || '',
          currentArtist: state.artist || '',
          artworkUrl: state.artworkUrl || '',
          positionMs: Math.floor(state.positionMs || 0),
          isPlaying: Boolean(state.isPlaying),
        })
      ),
    });
  } catch {
    // Non-fatal background heartbeat
  }
}

export async function fetchActiveRemoteDevices(): Promise<ConnectDevice[]> {
  try {
    const res = await fetch(`${BASE_URL}/connect_devices?pageSize=25&key=${API_KEY}`);
    if (!res.ok) return [];
    const json = await res.json();
    const docs: Array<{ name?: string; fields?: Record<string, Record<string, unknown>> }> = json.documents || [];
    const now = Date.now();
    const active: ConnectDevice[] = [];

    for (const doc of docs) {
      const id = (doc.name || '').split('/').pop() || '';
      if (!id || id === LOCAL_CONNECT_DEVICE_ID) continue;
      const f = fromFirestoreFields(doc.fields);
      const lastSeenMs = Number(f.lastSeenMs || 0);
      if (now - lastSeenMs > 90_000) continue;

      active.push({
        deviceId: id,
        deviceName: String(f.deviceName || 'Swaara Phone'),
        deviceType: String(f.deviceType || 'android'),
        lastSeenMs,
        currentSongId: String(f.currentSongId || ''),
        currentTitle: String(f.currentTitle || ''),
        currentArtist: String(f.currentArtist || ''),
        artworkUrl: String(f.artworkUrl || ''),
        positionMs: Number(f.positionMs || 0),
        isPlaying: Boolean(f.isPlaying),
      });
    }

    return active.sort((a, b) => b.lastSeenMs - a.lastSeenMs);
  } catch {
    return [];
  }
}

export async function pollIncomingConnectCommand(): Promise<IncomingTransferCommand | null> {
  try {
    const res = await fetch(`${BASE_URL}/connect_commands/${LOCAL_CONNECT_DEVICE_ID}?key=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    const f = fromFirestoreFields(json.fields);
    const command = String(f.command || '');
    const timestamp = Number(f.timestamp || 0);

    if (!command || command === 'ACK') return null;
    if (Date.now() - timestamp > 20_000) return null;

    // Acknowledge immediately so it doesn't replay
    await fetch(`${BASE_URL}/connect_commands/${LOCAL_CONNECT_DEVICE_ID}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreFields({ command: 'ACK', timestamp: Date.now() })),
    });

    return {
      command,
      songId: String(f.songId || ''),
      title: String(f.title || 'Swaara Track'),
      artist: String(f.artist || ''),
      artworkUrl: String(f.artworkUrl || ''),
      positionMs: Number(f.positionMs || 0),
      fromDeviceId: String(f.fromDeviceId || ''),
      timestamp,
    };
  } catch {
    return null;
  }
}

export async function sendRemotePauseToDevice(deviceId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/connect_commands/${deviceId}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toFirestoreFields({
          command: 'REMOTE_PAUSE',
          fromDeviceId: LOCAL_CONNECT_DEVICE_ID,
          timestamp: Date.now(),
        })
      ),
    });
  } catch {
    // Non-fatal
  }
}
