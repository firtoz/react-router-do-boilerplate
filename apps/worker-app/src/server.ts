import { Hono } from "hono";
import {
	type RequestHandler,
	createRequestHandler,
} from "@remix-run/cloudflare";

export { ExampleDO } from "example-do";

let _handleRemixRequest: RequestHandler | null = null;

const handleRemixRequest: RequestHandler = async (request, loadContext) => {
	if (!_handleRemixRequest) {
		const build = await import("remix-app").catch(() => {
			console.error("Failed to import remix-app");
			throw new Error("Failed to import remix-app");
		});
		_handleRemixRequest = createRequestHandler(build);
	}
	return _handleRemixRequest(request, loadContext);
};

const app = new Hono<{
	Bindings: Env;
}>()
	.all("*", async (c, next) => {
		const { req, env } = c;

		let response: Response | undefined;
		try {
			response = await env.ASSETS.fetch(
				req.url,
				req.raw.clone() as RequestInit,
			);
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
			response = await handleRemixRequest(req.raw, loadContext);
		} catch (error) {
			console.error("root error", error);
			response = c.text("An unexpected error occurred", { status: 500 });
		}

		return response;
	});

export default {
	fetch: app.fetch,
};
