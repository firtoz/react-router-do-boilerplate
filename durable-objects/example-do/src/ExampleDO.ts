import { DurableObject } from "cloudflare:workers";

export class ExampleDO extends DurableObject {
	constructor(ctx: DurableObjectState, env: unknown) {
		console.log("ExampleDO constructor");
		super(ctx, env);
	}

	override async fetch(request: Request) {
		const url = new URL(request.url);
		const path = url.pathname.slice(1); // Remove the leading slash

		return new Response(`Hello ${path || "World"}`);
	}
}

export default ExampleDO;
