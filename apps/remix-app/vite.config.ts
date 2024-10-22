import path from "node:path";
import { WranglerConfigHelper } from "@greybox/wrangler-config-helper";
import {
	cloudflareDevProxyVitePlugin,
	vitePlugin as remix,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

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
