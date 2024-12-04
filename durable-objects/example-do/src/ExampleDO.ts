import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
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

export default ExampleDO;
