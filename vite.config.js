import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 1420,
        strictPort: false,
        // Polling avoids native file handles colliding with Rust DLL writes on Windows.
        watch: {
            usePolling: true,
            interval: 500,
            ignored: ["**/src-tauri/**", "**/target/**"],
        },
    },
    clearScreen: false,
    test: {
        include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        exclude: ["node_modules", "tests/e2e"],
    },
});
