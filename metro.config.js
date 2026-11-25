// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The listener models and the Quran reference ship as raw assets (copied to disk at first launch).
config.resolver.assetExts.push("onnx", "txt");
// @tilawa/core is ESM-only and resolved through package "exports".
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
