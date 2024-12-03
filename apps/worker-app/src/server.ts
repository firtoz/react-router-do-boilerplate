import { WorkerEntrypoint } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import type { Env } from "cloudflare-worker-config";
import { ExampleDO } from "example-do";
import { Hono } from "hono";
import { createRequestHandler } from "react-router";

console.log("ExampleDO", ExampleDO);

export { ExampleDO };

console.log("import meta env", import.meta.env);

const requestHandler = createRequestHandler(
	async () => {
		// @ts-expect-error - virtual module provided by React Router at build time
		return import("virtual:react-router/server-build").catch(() => {
			return null;
		});
	},
	import.meta.env?.MODE,
);

const app = new Hono<{
	Bindings: Env & {
		ASSETS: Fetcher;
	};
}>()
	.all("*", async (c, next) => {
		const { req, env } = c;

		console.log("env", env);

		if (env.ENV === "local") {
			const ExampleDO = env.EXAMPLE_DO;
			if (!ExampleDO) {
				throw new Error("EXAMPLE_DO is not defined?");
			}

			const fetcher = honoDoFetcherWithName(ExampleDO, "default");

			const response = await fetcher.get({
				url: "/",
			});
			return c.text(
				`Local environment, ${JSON.stringify(await response.text())}`,
			);
		}

		let response: Response | undefined;
		try {
			response = await env.ASSETS.fetch(req.url, req.raw.clone());
			response =
				response && response.status >= 200 && response.status < 400
					? new Response(response.body, response)
					: undefined;
		} catch {}

		if (!response) {
			return await next();
		}

		return response;
	})
	.all("*", async (c) => {
		const { req, env } = c;

		const waitUntil = c.executionCtx.waitUntil.bind(c.executionCtx);
		const passThroughOnException = c.executionCtx.passThroughOnException.bind(
			c.executionCtx,
		);

		let response: Response | undefined;
		try {
			const loadContext = {
				cloudflare: {
					cf: req.raw.cf,
					ctx: { waitUntil, passThroughOnException },
					caches,
					env,
				},
			};
			response = await requestHandler(req.raw, loadContext);
		} catch (error) {
			console.error("root error", error);
			response = c.text("An unexpected error occurred", { status: 500 });
		}

		return response;
	});

export default class Server extends WorkerEntrypoint<Env> {
	override fetch(request: Request) {
		return app.fetch(request, this.env, this.ctx);
	}
}

// export default {
// 	fetch: app.fetch,
// } satisfies ExportedHandler<Env>;
