/**
 * Signs release builds with the app's permanent key instead of the debug key. The key and its passwords never enter
 * the repo: Gradle reads them from ~/.tilawati/keystore.properties (or the file named by TILAWATI_KEYSTORE_PROPS).
 * Without that file a release build fails instead of quietly falling back to the debug key.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// tilawati-release-signing";

const SIGNING = `
        release { ${MARK}
            def propsPath = System.getenv("TILAWATI_KEYSTORE_PROPS") ?: "\${System.getProperty("user.home")}/.tilawati/keystore.properties"
            def propsFile = new File(propsPath)
            if (propsFile.exists()) {
                def p = new Properties()
                propsFile.withInputStream { p.load(it) }
                storeFile file(p.getProperty("storeFile"))
                storePassword p.getProperty("storePassword")
                keyAlias p.getProperty("keyAlias")
                keyPassword p.getProperty("keyPassword")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    // Add a release signing config next to the debug one.
    g = g.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);
    // Point the release build type at it.
    g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, "$1signingConfig signingConfigs.release");
    if (!g.includes("signingConfig signingConfigs.release")) throw new Error("withReleaseSigning: could not find the release build type");
    cfg.modResults.contents = g;
    return cfg;
  });
};
