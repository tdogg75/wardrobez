const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that fixes Android build failures caused by:
 *   1. Namespace mismatch in app/build.gradle (AGP 8.x)
 *   2. Missing buildFeatures.buildConfig = true (AGP 8.x default is false)
 *   3. Missing explicit imports for R / BuildConfig in generated Kotlin sources
 *   4. Kotlin version conflicts across subprojects
 *   5. JVM target mismatch between Kotlin and Java
 */
function fixAndroidBuild(config) {
  const pkg = config.android?.package;
  if (!pkg) return config;

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.platformProjectRoot;

      // --- 1. Patch app/build.gradle ---
      let gradlePath = path.join(root, "app", "build.gradle");
      if (!fs.existsSync(gradlePath)) {
        gradlePath = path.join(root, "app", "build.gradle.kts");
      }

      if (fs.existsSync(gradlePath)) {
        const isKts = gradlePath.endsWith(".kts");
        let g = fs.readFileSync(gradlePath, "utf8");

        // Remove every existing namespace line (any syntax variant)
        g = g.replace(/^[ \t]*namespace\s*[=(]?\s*["'][^"']*["'][)]?\s*$/gm, "");

        // Insert correct namespace immediately after "android {"
        const nsDecl = isKts
          ? `    namespace = "${pkg}"`
          : `    namespace "${pkg}"`;
        g = g.replace(/(android\s*\{)/, `$1\n${nsDecl}`);

        // Ensure buildFeatures.buildConfig = true
        if (!/buildConfig\s*[=(]\s*true/.test(g)) {
          g = g.replace(/^[ \t]*buildConfig\s*[=(]?\s*false\s*[)]?\s*$/gm, "");

          if (/buildFeatures\s*\{/.test(g)) {
            g = g.replace(
              /(buildFeatures\s*\{)/,
              "$1\n        buildConfig = true"
            );
          } else {
            const nsPattern = isKts
              ? `namespace = "${pkg}"`
              : `namespace "${pkg}"`;
            g = g.replace(
              nsPattern,
              `${nsPattern}\n    buildFeatures {\n        buildConfig = true\n    }`
            );
          }
        }

        fs.writeFileSync(gradlePath, g, "utf8");
      }

      // --- 2. Force Kotlin version alignment in root build.gradle ---
      let rootGradlePath = path.join(root, "build.gradle");
      if (!fs.existsSync(rootGradlePath)) {
        rootGradlePath = path.join(root, "build.gradle.kts");
      }
      if (fs.existsSync(rootGradlePath)) {
        const isKts = rootGradlePath.endsWith(".kts");
        let rg = fs.readFileSync(rootGradlePath, "utf8");

        // Add subprojects block to force consistent Kotlin JVM target
        const subprojectsBlock = isKts
          ? `
subprojects {
    afterEvaluate {
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }
}
`
          : `
subprojects {
    afterEvaluate {
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }
}
`;
        // Only add if not already present
        if (!rg.includes("KotlinCompile")) {
          rg += subprojectsBlock;
          fs.writeFileSync(rootGradlePath, rg, "utf8");
        }
      }

      // --- 3. Ensure gradle.properties has required settings ---
      const gradlePropsPath = path.join(root, "gradle.properties");
      let props = "";
      if (fs.existsSync(gradlePropsPath)) {
        props = fs.readFileSync(gradlePropsPath, "utf8");
      }
      const requiredProps = {
        "android.useAndroidX": "true",
        "android.enableJetifier": "true",
        "org.gradle.jvmargs": "-Xmx2048m -XX:MaxMetaspaceSize=512m",
        "kotlin.jvm.target.validation.mode": "warning",
      };
      let propsChanged = false;
      for (const [key, value] of Object.entries(requiredProps)) {
        const regex = new RegExp(`^${key.replace(/\./g, "\\.")}\\s*=`, "m");
        if (!regex.test(props)) {
          props += `\n${key}=${value}`;
          propsChanged = true;
        }
      }
      if (propsChanged) {
        fs.writeFileSync(gradlePropsPath, props, "utf8");
      }

      // --- 4. Add explicit R / BuildConfig imports to Kotlin sources ---
      const pkgParts = pkg.split(".");
      const srcDir = path.join(
        root, "app", "src", "main", "java", ...pkgParts
      );

      if (fs.existsSync(srcDir)) {
        const escapedPkg = pkg.replace(/\./g, "\\.");
        const rImportRe = new RegExp(`import\\s+${escapedPkg}\\.R\\b`);
        const bcImportRe = new RegExp(
          `import\\s+${escapedPkg}\\.BuildConfig\\b`
        );

        const ktFiles = fs
          .readdirSync(srcDir)
          .filter((f) => f.endsWith(".kt"));

        for (const file of ktFiles) {
          const fp = path.join(srcDir, file);
          let src = fs.readFileSync(fp, "utf8");

          const usesR = /\bR\./.test(src);
          const usesBC = /\bBuildConfig\b/.test(src);
          const hasRImport = rImportRe.test(src);
          const hasBCImport = bcImportRe.test(src);

          const toAdd = [];
          if (usesR && !hasRImport) toAdd.push(`import ${pkg}.R`);
          if (usesBC && !hasBCImport) toAdd.push(`import ${pkg}.BuildConfig`);

          if (toAdd.length > 0) {
            src = src.replace(
              /^(package\s+.+)$/m,
              `$1\n\n${toAdd.join("\n")}`
            );
            fs.writeFileSync(fp, src, "utf8");
          }
        }
      }

      return config;
    },
  ]);
}

module.exports = fixAndroidBuild;
