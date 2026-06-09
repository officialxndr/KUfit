// Conditionally exclude the on-device AI native module from a build.
//
// `llama.rn` autolinks from package.json, so stripping its config plugin alone wouldn't
// keep the native llama.cpp out of the binary. Setting its platforms to null here disables
// autolinking entirely when AI=0 — no C++ compiled in, smaller app, simpler signing — while
// the JS stays bundled (it never touches the now-absent native module; AI_ENABLED guards it).
//
//   On-device-AI-free build:   AI=0 npx expo prebuild --clean && AI=0 npx expo run:ios --device
//   Default build (AI on):     npx expo prebuild --clean  (links llama.rn normally)
module.exports =
  process.env.AI === '0'
    ? { dependencies: { 'llama.rn': { platforms: { ios: null, android: null } } } }
    : {};
