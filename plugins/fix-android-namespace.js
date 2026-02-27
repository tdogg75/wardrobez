const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin to ensure the Android namespace in build.gradle
 * matches the package name from app.json. This fixes "Unresolved reference: R"
 * and "Unresolved reference: BuildConfig" errors in AGP 8.x builds.
 */
function fixAndroidNamespace(config) {
  const packageName = config.android?.package;
  if (!packageName) {
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Already correctly set — do nothing
    if (
      contents.includes(`namespace "${packageName}"`) ||
      contents.includes(`namespace '${packageName}'`)
    ) {
      return config;
    }

    // Replace an existing (wrong) namespace declaration
    if (contents.match(/namespace\s+["'][^"']+["']/)) {
      contents = contents.replace(
        /namespace\s+["'][^"']+["']/,
        `namespace "${packageName}"`
      );
    } else {
      // No namespace at all — add one inside the android block
      contents = contents.replace(
        /android\s*\{/,
        `android {\n    namespace "${packageName}"`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = fixAndroidNamespace;
