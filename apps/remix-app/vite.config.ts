import { defineConfig } from "vite";
import {
	vitePlugin as remix,
	cloudflareDevProxyVitePlugin,
} from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { WranglerConfigHelper } from "wrangler-config-helper";

const wranglerPath = path.resolve(__dirname, "../worker-app/wrangler.toml");

const devConfigPath = new WranglerConfigHelper(
	wranglerPath,
).prepareEnvironmentConfig("dev");

export default defineConfig({
	plugins: [
		cloudflareDevProxyVitePlugin({
			configPath: devConfigPath,
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
