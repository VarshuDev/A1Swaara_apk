import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.varshudev.a1swaara',
  appName: 'A1 Swaara',
  webDir: 'dist',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
  },
  plugins: {
    // Custom native plugin configs can be declared here
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
};

export default config;
