module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  rules: {
    // Disallow explicit 'any' (fix as needed with proper types)
    "@typescript-eslint/no-explicit-any": "warn",
    // Enforce exhaustive React hooks dependencies
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // React 17+ doesn't require React in scope
    "react/react-in-jsx-scope": "off",
    // Allow unused vars prefixed with _
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
  settings: {
    react: { version: "detect" },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: [".expo/", "node_modules/", "dist/"],
};
