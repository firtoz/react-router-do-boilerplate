import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import type { Env } from "cloudflare-worker-config";
import { Hono } from "hono";

export class ExampleDO extends DurableObject implements DOWithHonoApp {
	app = new Hono().get("/", (c) => {
		return c.text("Hello World from ExampleDurable Object.");
	});

	constructor(ctx: DurableObjectState, env: unknown) {
		console.log("ExampleDO constructor");
		super(ctx, env);
	}

	override async fetch(request: Request) {
		return this.app.fetch(request);
	}
}

const app = new Hono().get("/", (c) => {
	return c.text("Hello World from ExampleDurable Object.");
});

export default class Server extends WorkerEntrypoint<Env> {
	override fetch(request: Request) {
		return app.fetch(request, this.env, this.ctx);
	}
}
