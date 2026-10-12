import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.paliaapk.paliaai',
  appName: 'Palia AI',
  webDir: 'dist',
  server: {
    // Load the deployed Palia AI website so existing hosted APIs and payments keep working.
    url: 'https://shanpalia.github.io/PaliaAi/',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
