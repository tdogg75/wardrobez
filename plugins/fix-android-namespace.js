const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin to ensure:
 * 1. The Android namespace in build.gradle matches the package name from app.json
 * 2. buildFeatures.buildConfig is enabled (required in AGP 8.x where it defaults to false)
 *
 * This fixes "Unresolved reference: R" and "Unresolved reference: BuildConfig" errors.
 */
function fixAndroidNamespace(config) {
  const packageName = config.android?.package;
  if (!packageName) {
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // --- Fix namespace ---
    if (
      !contents.includes(`namespace "${packageName}"`) &&
      !contents.includes(`namespace '${packageName}'`)
    ) {
      // Replace existing (wrong) namespace declaration
      if (contents.match(/namespace\s*=?\s*["'][^"']+["']/)) {
        contents = contents.replace(
          /namespace\s*=?\s*["'][^"']+["']/,
          `namespace "${packageName}"`
        );
      } else {
        // No namespace at all — add one inside the android block
        contents = contents.replace(
          /android\s*\{/,
          `android {\n    namespace "${packageName}"`
        );
      }
    }

    // --- Ensure buildFeatures.buildConfig = true (AGP 8.x defaults to false) ---
    if (!contents.match(/buildConfig\s*(=\s*)?true/)) {
      if (contents.match(/buildFeatures\s*\{/)) {
        // buildFeatures block exists — add buildConfig inside it
        contents = contents.replace(
          /buildFeatures\s*\{/,
          `buildFeatures {\n        buildConfig = true`
        );
      } else {
        // No buildFeatures block — add one inside the android block
        contents = contents.replace(
          /android\s*\{/,
          `android {\n    buildFeatures {\n        buildConfig = true\n    }`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = fixAndroidNamespace;
