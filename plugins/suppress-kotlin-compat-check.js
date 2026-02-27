const {
  withGradleProperties,
  withProjectBuildGradle,
} = require("expo/config-plugins");

function suppressKotlinCompatCheck(config) {
  // 1. Set the gradle property with the specific version string
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: "property",
      key: "kotlin.suppressKotlinVersionCompatibilityCheck",
      value: "1.9.25",
    });
    return config;
  });

  // 2. Force Kotlin version 1.9.24 in the root build.gradle
  //    AND add the Compose compiler arg to suppress the version check
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents) {
      config.modResults.contents += `
subprojects {
    afterEvaluate {
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions {
                freeCompilerArgs += [
                    "-P",
                    "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=1.9.25"
                ]
            }
        }
    }
}
`;
    }
    return config;
  });

  return config;
}

module.exports = suppressKotlinCompatCheck;
