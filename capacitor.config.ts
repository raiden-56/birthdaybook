import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.birthdaybook.app",
  appName: "BirthdayBook",
  webDir: "out",
  backgroundColor: "#FAF9F6",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#FAF9F6",
  },
  plugins: {
    LocalNotifications: {
      // Android small icon lives in android/app/src/main/res/drawable*/ic_stat_birthdaybook.xml
      smallIcon: "ic_stat_birthdaybook",
      iconColor: "#563B5C",
      sound: undefined,
    },
  },
};

export default config;
