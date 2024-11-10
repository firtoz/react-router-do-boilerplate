import type { ServerBuild } from "@remix-run/cloudflare";

declare module "remix-app" {
	export const mode: ServerBuild["mode"];
	export const entry: ServerBuild["entry"];
	export const routes: ServerBuild["routes"];
	export const assets: ServerBuild["assets"];
	export const basename: ServerBuild["basename"];
	export const publicPath: ServerBuild["publicPath"];
	export const assetsBuildDirectory: ServerBuild["assetsBuildDirectory"];
	export const future: ServerBuild["future"];
	export const isSpaMode: ServerBuild["isSpaMode"];
}
