const { withGradleProperties } = require("expo/config-plugins");

module.exports = function suppressKotlinCompatCheck(config) {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: "property",
      key: "kotlin.suppressKotlinVersionCompatibilityCheck",
      value: "true",
    });
    return config;
  });
};
