import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import type { Env } from "cloudflare-worker-config";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

export class ExampleDO extends DurableObject<Env> implements DOWithHonoApp {
	app = new Hono<{
		Bindings: Env;
	}>()
		.get("/", (c) => {
			return c.text(
				`GET: Hello World from the Example Durable Object. Env: ${c.env.ENV}`,
			);
		})
		.post(
			"/test",
			zValidator(
				"json",
				z.object({
					name: z.string(),
				}),
			),
			async (c) => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return c.text(
					`POST: Hello ${c.req.valid("json").name} from the Example Durable Object.`,
				);
			},
		);

	constructor(ctx: DurableObjectState, env: Env) {
		console.log("ExampleDO constructor");
		super(ctx, env);
	}

	override async fetch(request: Request) {
		return this.app.fetch(request, this.env);
	}
}

export default {
	fetch: new Hono().get("/", (c) => {
		return c.text("Worker loaded.");
	}).fetch,
};
