import fs from "node:fs";
import path from "node:path";
import { WranglerConfigHelper } from "@greybox/wrangler-config-helper";
import {
	cloudflareDevProxyVitePlugin,
	vitePlugin as remix,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const wranglerPath = path.resolve(__dirname, "../worker-app/wrangler.toml");

const wranglerEnvironment = "local";
const patchedWranglerConfigPath = new WranglerConfigHelper(
	wranglerPath,
).prepareEnvironmentConfig(wranglerEnvironment);

export default defineConfig({
	plugins: [
		cloudflareDevProxyVitePlugin({
			configPath: patchedWranglerConfigPath,
			environment: wranglerEnvironment,
			persist: {
				path: "../worker-app/.wrangler/state/v3",
			},
		}),
		remix({
			future: {
				v3_fetcherPersist: true,
				v3_relativeSplatPath: true,
				v3_throwAbortReason: true,
				v3_singleFetch: true,
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
