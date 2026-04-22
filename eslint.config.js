import config from "@employeek/eslint-config";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "legacy/**",
      "openspec/**",
      ".husky/**",
      "pnpm-lock.yaml",
      "**/*.d.ts",
      "**/*.js.map",
      "**/*.d.ts.map",
    ],
  },
  ...config,
];
