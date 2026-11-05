import type { CapacitorConfig } from "@capacitor/cli";

// This app is a thin native shell around the live site — it always loads
// https://ems.techmaax.com directly, so every web deploy is reflected immediately
// with no need to rebuild/redistribute the APK. `webDir` still points at the built
// client purely so `cap add android` has something to seed the project with.
const config: CapacitorConfig = {
  appId: "com.techmaax.ems",
  appName: "Techmaax EMS",
  webDir: "dist",
  server: {
    url: "https://ems.techmaax.com",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
