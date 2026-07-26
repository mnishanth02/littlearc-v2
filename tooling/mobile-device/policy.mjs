const DEFAULT_PACKAGE_NAME = "app.littlearc.mobile";

function parseAdbDevices(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("List of devices"))
    .map((line) => {
      const [serial, state, ...attributeParts] = line.split(/\s+/);
      const attributes = Object.fromEntries(
        attributeParts
          .map((part) => part.split(":", 2))
          .filter((entry) => entry.length === 2),
      );

      return {
        serial,
        state,
        attributes,
        physical: !serial.startsWith("emulator-"),
      };
    });
}

function selectSinglePhysicalDevice(devices) {
  const physicalDevices = devices.filter((device) => device.physical);
  const authorizedDevices = physicalDevices.filter((device) => device.state === "device");

  if (authorizedDevices.length === 1 && physicalDevices.length === 1) {
    return authorizedDevices[0];
  }

  if (physicalDevices.length === 0) {
    throw new Error("No physical Android device is connected.");
  }

  if (authorizedDevices.length === 0) {
    throw new Error(
      "A physical Android device is connected but not authorized. Unlock it and accept the USB debugging prompt.",
    );
  }

  throw new Error(
    `Expected exactly one physical Android device, but found ${physicalDevices.length}. Disconnect extra devices or target one explicitly.`,
  );
}

function parseBattery(output) {
  const readNumber = (name) => {
    const match = output.match(new RegExp(`^\\s*${name}:\\s*(-?\\d+)\\s*$`, "m"));
    return match ? Number.parseInt(match[1], 10) : null;
  };

  return {
    level: readNumber("level"),
    temperatureTenthsCelsius: readNumber("temperature"),
    health: readNumber("health"),
    status: readNumber("status"),
  };
}

function isSecurityPatchStale(patchDate, now = new Date(), maximumAgeDays = 180) {
  const parsed = new Date(`${patchDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  const ageMilliseconds = now.getTime() - parsed.getTime();
  return ageMilliseconds > maximumAgeDays * 24 * 60 * 60 * 1000;
}

function formatReverseRules(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [, deviceEndpoint, hostEndpoint] = line.split(/\s+/);
      return deviceEndpoint && hostEndpoint ? `${deviceEndpoint} -> ${hostEndpoint}` : "(unrecognized rule)";
    })
    .join("\n");
}

function getProfileExpectations(profile) {
  if (profile === "daily") {
    return {
      stayAwake: "2",
      windowAnimation: "0.5",
      transitionAnimation: "0.5",
      animatorDuration: "0.5",
      peakRefreshRate: 60,
    };
  }

  if (profile === "acceptance") {
    return {
      stayAwake: "0",
      windowAnimation: "1.0",
      transitionAnimation: "1.0",
      animatorDuration: "1.0",
      peakRefreshRate: 120,
    };
  }

  throw new Error(`Unknown device profile: ${profile}`);
}

function getProfileDifferences(profile, observed) {
  const expected = getProfileExpectations(profile);
  const differences = [];

  for (const key of ["stayAwake", "windowAnimation", "transitionAnimation", "animatorDuration"]) {
    if (observed[key] !== expected[key]) {
      differences.push(`${key}: expected ${expected[key]}, observed ${observed[key]}`);
    }
  }

  if (Math.round(Number.parseFloat(observed.peakRefreshRate)) !== expected.peakRefreshRate) {
    differences.push(
      `peakRefreshRate: expected ${expected.peakRefreshRate}, observed ${observed.peakRefreshRate}`,
    );
  }

  return differences;
}

export {
  DEFAULT_PACKAGE_NAME,
  formatReverseRules,
  getProfileDifferences,
  getProfileExpectations,
  isSecurityPatchStale,
  parseAdbDevices,
  parseBattery,
  selectSinglePhysicalDevice,
};
