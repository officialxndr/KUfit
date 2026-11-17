// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // HTML-entity escaping is a web/JSX-in-DOM concern; React Native <Text> renders ' and "
      // literally, so this rule only produces noise here.
      "react/no-unescaped-entities": "off",
    },
  },
]);
