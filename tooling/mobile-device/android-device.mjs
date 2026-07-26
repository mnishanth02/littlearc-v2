#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_PACKAGE_NAME,
  formatReverseRules,
  getProfileDifferences,
  isSecurityPatchStale,
  parseAdbDevices,
  parseBattery,
  selectSinglePhysicalDevice,
} from "./policy.mjs";

const METRO_PORT = "8081";
const API_PORT = "3000";

function resolveAdbPath(environment = process.env) {
  if (environment.ANDROID_ADB) {
    return environment.ANDROID_ADB;
  }

  for (const sdkRoot of [environment.ANDROID_HOME, environment.ANDROID_SDK_ROOT]) {
    if (sdkRoot) {
      const candidate = join(sdkRoot, "platform-tools", "adb");
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "adb";
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });
  const stdout = result.stdout?.trim() ?? "";
  const stderr = result.stderr?.trim() ?? "";

  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(stderr || stdout || `${command} exited with status ${result.status}`);
  }

  return {
    ok: result.status === 0,
    stdout,
    stderr,
  };
}

function createAdb() {
  const adbPath = resolveAdbPath();

  const run = (args, options) => runCommand(adbPath, args, options);
  const devices = parseAdbDevices(run(["devices", "-l"]).stdout);
  selectSinglePhysicalDevice(devices);

  return {
    run,
    device(args, options) {
      return run(["-d", ...args], options);
    },
  };
}

function readProperty(adb, name) {
  return adb.device(["shell", "getprop", name]).stdout;
}

function readSetting(adb, namespace, name) {
  return adb.device(["shell", "settings", "get", namespace, name]).stdout;
}

function readPackage(adb, packageName) {
  const packagePath = adb.device(["shell", "pm", "path", packageName], {
    allowFailure: true,
  });

  if (!packagePath.ok || packagePath.stdout.length === 0) {
    return null;
  }

  const packageDump = adb.device(["shell", "dumpsys", "package", packageName]).stdout;
  const versionName = packageDump.match(/\bversionName=([^\s]+)/)?.[1] ?? "unknown";
  const targetSdk = packageDump.match(/\btargetSdk=(\d+)/)?.[1] ?? "unknown";

  return { versionName, targetSdk };
}

function printDoctor(adb) {
  const manufacturer = readProperty(adb, "ro.product.manufacturer");
  const model = readProperty(adb, "ro.product.model");
  const androidVersion = readProperty(adb, "ro.build.version.release");
  const sdk = readProperty(adb, "ro.build.version.sdk");
  const securityPatch = readProperty(adb, "ro.build.version.security_patch");
  const build = readProperty(adb, "ro.build.display.id");
  const verifiedBoot = readProperty(adb, "ro.boot.verifiedbootstate");
  const battery = parseBattery(adb.device(["shell", "dumpsys", "battery"]).stdout);
  const thermalOutput = adb.device(["shell", "dumpsys", "thermalservice"]).stdout;
  const thermalStatus = thermalOutput.match(/Thermal Status:\s*(\d+)/)?.[1] ?? "unknown";
  const storage = adb.device(["shell", "df", "-h", "/data"]).stdout;
  const reverseRules = formatReverseRules(adb.run(["reverse", "--list"]).stdout);
  const littleArc = readPackage(adb, DEFAULT_PACKAGE_NAME);

  console.log(`Device: ${manufacturer} ${model}`);
  console.log(`Android: ${androidVersion} (API ${sdk})`);
  console.log(`Build: ${build}`);
  console.log(`Security patch: ${securityPatch}`);
  console.log(`Verified Boot: ${verifiedBoot}`);
  console.log(
    `Battery: ${battery.level ?? "unknown"}%, ${battery.temperatureTenthsCelsius === null ? "unknown" : `${(battery.temperatureTenthsCelsius / 10).toFixed(1)} C`}`,
  );
  console.log(`Thermal status: ${thermalStatus}`);
  console.log(`Storage:\n${storage}`);
  console.log(
    `Development profile: stay-awake=${readSetting(adb, "global", "stay_on_while_plugged_in")}, animations=${readSetting(adb, "global", "window_animation_scale")}x, peak-refresh=${readSetting(adb, "system", "peak_refresh_rate")} Hz`,
  );
  console.log(`Reverse rules:\n${reverseRules || "(none)"}`);
  console.log(
    littleArc
      ? `LittleArc: installed (version ${littleArc.versionName}, target SDK ${littleArc.targetSdk})`
      : "LittleArc: not installed",
  );

  if (isSecurityPatchStale(securityPatch)) {
    console.warn(
      "Warning: the Android security patch is older than 180 days. Check system and Google Play updates before using the device.",
    );
  }
  if (battery.level !== null && battery.level < 25) {
    console.warn("Warning: battery is below 25%; charge before a long native build or device run.");
  }
}

function readProfile(adb) {
  const normalizeDefault = (value) => (value === "null" ? "1.0" : value);

  return {
    stayAwake: readSetting(adb, "global", "stay_on_while_plugged_in"),
    windowAnimation: normalizeDefault(readSetting(adb, "global", "window_animation_scale")),
    transitionAnimation: normalizeDefault(readSetting(adb, "global", "transition_animation_scale")),
    animatorDuration: normalizeDefault(readSetting(adb, "global", "animator_duration_scale")),
    peakRefreshRate: readSetting(adb, "system", "peak_refresh_rate"),
  };
}

function checkProfile(adb, profile) {
  const differences = getProfileDifferences(profile, readProfile(adb));

  if (differences.length === 0) {
    console.log(`The device matches the ${profile} profile.`);
    return;
  }

  console.warn(`The ${profile} profile needs these manual OxygenOS changes:`);
  for (const difference of differences) {
    console.warn(`- ${difference}`);
  }
  console.warn(
    "OxygenOS denies ADB WRITE_SECURE_SETTINGS, so change these values on the device instead of bypassing the OS permission.",
  );
}

function configureReversePorts(adb) {
  for (const port of [METRO_PORT, API_PORT]) {
    adb.device(["reverse", `tcp:${port}`, `tcp:${port}`]);
  }

  console.log(`Forwarded device localhost ports ${METRO_PORT} (Metro) and ${API_PORT} (API) to the Mac.`);
}

function removeReversePorts(adb) {
  for (const port of [METRO_PORT, API_PORT]) {
    adb.device(["reverse", "--remove", `tcp:${port}`], { allowFailure: true });
  }

  console.log("Removed LittleArc Android reverse-port rules.");
}

function cleanup(adb) {
  removeReversePorts(adb);
  adb.device(["shell", "dumpsys", "deviceidle", "unforce"], { allowFailure: true });
  adb.device(["shell", "dumpsys", "battery", "reset"], { allowFailure: true });
  checkProfile(adb, "acceptance");
  console.log("Reset forced idle and synthetic battery state.");
}

function printUsage() {
  console.log(`Usage: node tooling/mobile-device/android-device.mjs <command>

Commands:
  doctor       Read-only device, storage, battery, thermal, and app checks
  prepare      Forward Metro/API ports and check the daily profile
  daily        Check the lower-heat daily development profile
  acceptance   Check the reproducible acceptance-test profile
  ports        Forward Metro/API localhost ports over USB
  cleanup      Remove port rules and restore idle, battery, and acceptance state`);
}

function main(command = process.argv[2]) {
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  const adb = createAdb();

  switch (command) {
    case "doctor":
      printDoctor(adb);
      break;
    case "prepare":
      configureReversePorts(adb);
      checkProfile(adb, "daily");
      printDoctor(adb);
      break;
    case "daily":
      checkProfile(adb, "daily");
      break;
    case "acceptance":
      checkProfile(adb, "acceptance");
      break;
    case "ports":
      configureReversePorts(adb);
      break;
    case "cleanup":
      cleanup(adb);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`android_device_error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

export { main, resolveAdbPath };
