const appEnv = process.env.EXPO_PUBLIC_APP_ENV || "local";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000";

export default {
  expo: {
    name: "LittleArc",
    slug: "littlearc",
    version: "0.0.1",
    runtimeVersion: "m1-fnd-03",
    scheme: "littlearc",
    orientation: "portrait",
    newArchEnabled: true,
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "app.littlearc.mobile",
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: "Allow LittleArc to scan documents you choose.",
        NSFaceIDUsageDescription: "Allow LittleArc to protect local health information.",
        NSPhotoLibraryUsageDescription: "Allow LittleArc to import documents you choose.",
      },
    },
    android: {
      package: "app.littlearc.mobile",
      permissions: ["android.permission.CAMERA", "android.permission.USE_BIOMETRIC"],
    },
    plugins: [
      "expo-router",
      "expo-dev-client",
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.4",
          },
          android: {
            minSdkVersion: 29,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
        },
      ],
      [
        "expo-sqlite",
        {
          useSQLCipher: true,
          enableFTS: true,
        },
      ],
      [
        "expo-secure-store",
        {
          configureAndroidBackup: false,
          faceIDPermission: "Allow LittleArc to protect local health information.",
        },
      ],
      "expo-local-authentication",
      "expo-notifications",
      "expo-web-browser",
      [
        "react-native-document-scanner-plugin",
        {
          cameraPermission: "Allow LittleArc to scan documents you choose.",
        },
      ],
    ],
    experiments: {
      reactCompiler: true,
    },
    extra: {
      appEnv,
      apiBaseUrl,
      router: {
        root: "app",
      },
    },
  },
};
