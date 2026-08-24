// HealPoint – Metro configuration (Expo SDK 54)
//
// ROOT-CAUSE FIX #1 — Metro crashed at startup on this machine with:
//
//   Error: Cannot combine blockList patterns, because they have different flags:
//   - Pattern 0: /.expo/[\]types/
//   - Pattern 2: /HealPointNative/[\]/].*/i
//
// Metro (metro/src/node-haste/DependencyGraph/createFileMap.js -> getIgnorePattern)
// throws as soon as the resolver.blockList array mixes regexps with different
// `.flags`. The Expo default blockList entries (e.g. /.expo/[\]types/) carry NO
// flag, while the previous version of this file created its own exclusion
// patterns with the `i` flag (`new RegExp(re.source, 'i')`). The next
// `npx expo start` died inside Metro before the bundler could start.
//
// ROOT-CAUSE FIX #2 — after #1 was fixed, bundling failed to resolve
// `whatwg-fetch`'s `main` file. The old `/dist[\\/].*/` exclusion was NOT
// anchored, so it also matched `node_modules\whatwg-fetch\dist\fetch.umd.js`
// and hid a real package file from Metro's file map.
//
// FIX: every exclusion below is anchored to the absolute project root, and all
// regexps use the SAME (empty) flags as the Expo defaults. We also pin a
// deterministic cacheVersion; bumping it cleanly invalidates the on-disk Metro
// transformer cache (default "1.0") instead of trying to deserialize a stale /
// half-written cache file – the documented source of the "Unable to deserialize
// cloned data" / "falling back to full crawl" warnings on Windows.
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Escape the Windows/Unix project path so it can be embedded in a RegExp.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const root = escapeRegExp(projectRoot);

// Regex source for a path-separator class matching "\" or "/". The literal
// needs FOUR backslashes in the template so the compiled regex source is [\\/].
const sep = '[\\\\/]';

// Folders Metro does NOT need to watch/index/cache. None of these are source
// files imported by the app, so excluding them removes noise from the file map.
// All patterns are anchored to the absolute project root and kept flag-free.
const blockList = [
  new RegExp(`${root}${sep}HealPointNative${sep}.*`),
  new RegExp(`${root}${sep}dist${sep}.*`),
  new RegExp(`${root}${sep}android${sep}build${sep}.*`),
  new RegExp(`${root}${sep}android${sep}\\.gradle${sep}.*`),
  new RegExp(`${root}${sep}\\.expo${sep}.*`),
  // `node_modules\react-native-razorpay\sampleApps` ships demo sources that
  // are never imported; keeping them out of the file map avoids stray requires.
  /node_modules[\\/]react-native-razorpay[\\/]sampleApps[\\/].*/,
];

const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [];
config.resolver.blockList = [
  ...existingBlockList,
  ...blockList,
];

// Deterministic cache version. Bumping this cleanly invalidates Metro's on-disk
// bundler cache instead of deserializing a stale/half-written cache file.
config.cacheVersion = 'healpoint-v3';

module.exports = config;
