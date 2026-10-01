import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.waxtrax.deck",
  appName: "Wax Trax",
  webDir: "dist",
  android: {
    backgroundColor: "#05030a",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
