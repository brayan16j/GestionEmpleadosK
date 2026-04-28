import config from "@employeek/eslint-config";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "openspec/**",
      ".husky/**",
      "pnpm-lock.yaml",
      "**/*.d.ts",
      "**/*.js.map",
      "**/*.d.ts.map",
      "packages/api-types/src/generated.ts",
    ],
  },
  ...config,
];
