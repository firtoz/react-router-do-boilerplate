import { defineConfig } from "vite";
import {
	vitePlugin as remix,
	cloudflareDevProxyVitePlugin,
} from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";

import fs from "node:fs";
import * as TOML from "@iarna/toml";
import path from "node:path";

// Read the original wrangler.toml
const wranglerPath = path.resolve(__dirname, "../worker-app/wrangler.toml");
const wranglerContent = fs.readFileSync(wranglerPath, "utf-8");
const wranglerConfig = TOML.parse(wranglerContent);

// Modify the name
wranglerConfig.name = `${wranglerConfig.name}-dev`;

// Write the new wrangler.dev.toml
const devWranglerPath = path.resolve(
	__dirname,
	"../worker-app/wrangler.dev.toml",
);
fs.writeFileSync(devWranglerPath, TOML.stringify(wranglerConfig));

export default defineConfig({
	plugins: [
		cloudflareDevProxyVitePlugin({
			configPath: devWranglerPath,
			environment: "dev",
			persist: {
				path: "../worker-app/.wrangler/state/v3",
			},
		}),
		remix({
			future: {
				v3_fetcherPersist: true,
				v3_relativeSplatPath: true,
				v3_throwAbortReason: true,
			},
		}),
		tsconfigPaths(),
	],
	ssr: {
		resolve: {
			conditions: ["workerd", "worker", "browser"],
		},
	},
	resolve: {
		mainFields: ["browser", "module", "main"],
	},
	build: {
		minify: true,
	},
});
