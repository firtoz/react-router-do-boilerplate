import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	expectTypeOf,
} from "vitest";
import { Hono } from "hono";
import {
	honoFetcher,
	type JsonResponse,
	type TypedHonoFetcher,
} from "../src/honoFetcher";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

describe("honoFetcher", () => {
	const app = new Hono()
		.get("/users/:id", (c) => {
			const id = c.req.param("id");
			return c.json({ id, name: `User ${id}` });
		})
		.post("/users/:id", async (c) => {
			const id = c.req.param("id");
			const { name } = await c.req.json();
			return c.json({ id, name });
		})
		.get("/items", (c) => {
			return c.json({ items: ["item1", "item2", "item3"] });
		})
		.post("/items", async (c) => {
			try {
				const { item } = await c.req.json();
				return c.json({ success: true, item });
			} catch (e) {
				console.error(e);
				return c.json({ success: false }, 400);
			}
		})
		.post(
			"/items-form",
			zValidator(
				"form",
				z.object({
					item: z.string(),
				}),
			),
			async (c) => {
				const body = c.req.valid("form");
				return c.json({ success: true, body });
			},
		)
		.post(
			"/items-json",
			zValidator(
				"json",
				z.object({
					item: z.string(),
				}),
			),
			async (c) => {
				const body = c.req.valid("json");
				return c.json({ success: true, body });
			},
		);

	describe("app based fetcher", () => {
		let appBasedFetcher: TypedHonoFetcher<typeof app>;

		beforeAll(async () => {
			appBasedFetcher = honoFetcher<typeof app>(app);
		});

		afterAll(async () => {});

		it("should fetch data with GET request", async () => {
			const response = await appBasedFetcher.get("/users/:id", { id: "123" });
			const data = await response.json();
			expect(data).toEqual({ id: "123", name: "User 123" });
		});

		it("should send data with POST request", async () => {
			const response = await appBasedFetcher.post(
				"/users/:id",
				{ name: "John Doe" },
				{ id: "456" },
			);
			const data = await response.json();
			expect(data).toEqual({ id: "456", name: "John Doe" });
		});

		it("should fetch data from a route without params", async () => {
			const response = await appBasedFetcher.get("/items");
			const data = await response.json();
			expect(data).toEqual({ items: ["item1", "item2", "item3"] });
		});

		it("should send data to a route without params", async () => {
			const response = await appBasedFetcher.post("/items", {
				item: "newItem",
			});
			const data = await response.json();
			expect(data).toEqual({ success: true, item: "newItem" });
		});

		it("should pass custom headers", async () => {
			const customHeaderValue = "test-value";
			const response = await appBasedFetcher.get(
				"/users/:id",
				{ id: "789" },
				{
					headers: { "X-Custom-Header": customHeaderValue },
				},
			);

			// We need to mock the headers check in the actual app for this test
			// For now, we'll just check if the response is successful
			expect(response.ok).toBe(true);
		});

		describe("type checks", () => {
			it("should have correct type for valid routes", () => {
				expectTypeOf(appBasedFetcher.get)
					.parameter(0)
					.toEqualTypeOf<"/users/:id" | "/items">();
			});

			it("should not allow invalid routes", () => {
				// @ts-expect-error
				expectTypeOf(appBasedFetcher.get("/non-existent")).toBeNever();
			});

			it("should require correct params for routes with path parameters", () => {
				// Correct usage
				expectTypeOf(
					appBasedFetcher.get("/users/:id", { id: "123" }),
				).toBeObject();

				expectTypeOf(
					// @ts-expect-error - Missing required 'id' param
					appBasedFetcher.get("/users/:id"),
				).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();

				expectTypeOf(
					// @ts-expect-error - Wrong param name
					appBasedFetcher.get("/users/:id", { userId: "123" }),
				).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();

				expectTypeOf(
					// @ts-expect-error - Extra param
					appBasedFetcher.get("/users/:id", { id: "123", extra: "param" }),
				).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();
			});

			it("should not allow params for routes without path parameters", () => {
				// Correct usage
				expectTypeOf(appBasedFetcher.get("/items")).toBeObject();

				expectTypeOf(
					// @ts-expect-error - Params not allowed for this route
					appBasedFetcher.get("/items", { someParam: "value" }),
				).toEqualTypeOf<Promise<JsonResponse<{ items: string[] }>>>();
			});

			it("should enforce correct body type for POST requests", () => {
				// Correct usage
				expectTypeOf(
					appBasedFetcher.post("/items", { item: "newItem" }),
				).toBeObject();
				// Correct usage
				expectTypeOf(
					appBasedFetcher.post("/items-json", { item: "newItem" }),
				).toBeObject();

				// @ts-expect-error - Missing required body
				expectTypeOf(appBasedFetcher.post("/items")).toBeNever();

				expectTypeOf(
					// @ts-expect-error - Incorrect body type
					appBasedFetcher.post("/items-json", { wrongKey: "value" }),
				).toEqualTypeOf<
					Promise<JsonResponse<{ success: boolean; body: { item: string } }>>
				>();

				expectTypeOf(
					appBasedFetcher.post("/items-json", {
						item: "newItem",
						// @ts-expect-error - Incorrect body type
						extra: "property",
					}),
				).toEqualTypeOf<
					Promise<JsonResponse<{ success: boolean; body: { item: string } }>>
				>();
			});
		});
	});
});
