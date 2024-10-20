import { Hono } from "hono";
import type { DOWithHonoApp } from "../src/doFetcher";
import { DurableObject } from "cloudflare:workers";

export type TestEnv = {
	TEST: DurableObjectNamespace<TestDurableObject>;
};

export type TestHonoEnv = {
	Bindings: TestEnv;
};

export class TestDurableObject
	extends DurableObject<TestEnv>
	implements DOWithHonoApp
{
	app = new Hono<TestHonoEnv>()
		.get("/test", (c) => {
			console.log("GET /test", this.ctx.id);
			return c.json({ method: "GET", id: this.ctx.id });
		})
		.post("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "POST", body, id: this.ctx.id });
		})
		.put("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "PUT", body, id: this.ctx.id });
		})
		.delete("/test", (c) => c.json({ method: "DELETE", id: this.ctx.id }))
		.patch("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "PATCH", body, id: this.ctx.id });
		});

	constructor(ctx: DurableObjectState, env: TestEnv) {
		super(ctx, env);
		console.log("TestDurableObject constructor", this.ctx.id);
	}

	override async fetch(request: Request) {
		return this.app.fetch(request);
	}
}

console.log("worker.ts");

const worker = new Hono<TestHonoEnv>()
	.get("/test/:id/*", async (c) => {
		const id = c.req.param("id");
		const namespace = c.env.TEST;
		const stub = namespace.get(namespace.idFromString(id));
		return stub.fetch(c.req.raw);
	})
	.post("/test/:id/*", async (c) => {
		const id = c.req.param("id");
		const namespace = c.env.TEST;
		const stub = namespace.get(namespace.idFromString(id));
		return stub.fetch(c.req.raw);
	})
	.all("*", (c) => c.text(`Interesting path: ${c.req.url}`));

// console.log("worker", worker);

// throw new Error("test");
export default worker;

// export default {
// 	fetch(request: Request, env: TestEnv, ctx: ExecutionContext) {
// 		console.log("fetch", request, env, ctx);
// 		return new Response("Hello World");
// 	},
// };
