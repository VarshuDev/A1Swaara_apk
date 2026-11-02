import { registerPlugin, Capacitor } from '@capacitor/core';
import { Track, EqualizerPreset } from '../types/music';

export interface SwaaraNativeAudioPlugin {
  playTrack(options: {
    streamUrl: string;
    title: string;
    artist: string;
    artwork: string;
    duration: number;
    id?: string;
  }): Promise<{ status: string }>;

  pause(): Promise<{ status: string }>;
  resume(): Promise<{ status: string }>;
  seekTo(options: { seconds: number }): Promise<{ status: string }>;
  setVolume(options: { volume: number }): Promise<{ status: string }>;
  setPlaybackRate(options: { rate: number }): Promise<{ status: string }>;
  setEqualizer(options: { gains: number[]; bassBoost: number }): Promise<{ status: string }>;

  addListener(eventName: 'onRemotePlay', listenerFunc: () => void): Promise<any>;
  addListener(eventName: 'onRemotePause', listenerFunc: () => void): Promise<any>;
  addListener(eventName: 'onRemoteNext', listenerFunc: () => void): Promise<any>;
  addListener(eventName: 'onRemotePrevious', listenerFunc: () => void): Promise<any>;
  addListener(
    eventName: 'onTimeUpdate',
    listenerFunc: (data: { currentTime: number; duration: number }) => void
  ): Promise<any>;
  addListener(eventName: 'onTrackEnded', listenerFunc: () => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

export const NativeAudio = registerPlugin<SwaaraNativeAudioPlugin>('SwaaraAudioPlugin');

export const isNativeIOS = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

export const isNativeMobile = (): boolean => {
  return Capacitor.isNativePlatform();
};
