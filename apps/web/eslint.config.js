import baseConfig from "@employeek/eslint-config";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"],
  },
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "18.0" },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use src/lib/http.ts instead of calling fetch directly.",
        },
      ],
    },
  },
  {
    files: ["src/lib/http.ts"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
  {
    files: ["test/**/*.{ts,tsx}"],
    plugins: {
      "testing-library": testingLibrary,
    },
    rules: {
      ...testingLibrary.configs.react.rules,
    },
  },
];
