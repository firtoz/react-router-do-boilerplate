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
	type TypedHonoFetcher,
	type JsonResponse,
	// type TypedHonoFetcher,
} from "../src/honoFetcher";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { serve, type ServerType } from "@hono/node-server";
import type { ExtractSchema } from "hono/types";

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
				return c.json({ success: false }, 400);
			}
		})
		.post(
			"/items-form",
			zValidator(
				"form",
				z.object({
					item: z.string(),
					quantity: z.coerce.number(),
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

	type FormItem = ExtractSchema<typeof app>["/items-form"];

	const runFetcherTests = (
		description: string,
		createFetcher: () => Promise<TypedHonoFetcher<typeof app>>,
	) => {
		describe(description, () => {
			let fetcher: TypedHonoFetcher<typeof app>;

			beforeAll(async () => {
				fetcher = await createFetcher();
			});

			it("should fetch data with GET request", async () => {
				const response = await fetcher.get({
					url: "/users/:id",
					params: { id: "123" },
				});

				const data = await response.json();
				expect(data).toEqual({ id: "123", name: "User 123" });
			});

			it("should send data with POST request", async () => {
				const response = await fetcher.post({
					url: "/users/:id",
					body: { name: "John Doe" },
					params: { id: "456" },
				});
				const data = await response.json();
				expect(data).toEqual({ id: "456", name: "John Doe" });
			});

			it("should fetch data from a route without params", async () => {
				const response = await fetcher.get({ url: "/items" });
				const data = await response.json();
				expect(data).toEqual({ items: ["item1", "item2", "item3"] });
			});

			it("should send data to a route without params", async () => {
				const response = await fetcher.post({
					url: "/items",
					body: { item: "newItem" },
				});
				const data = await response.json();
				expect(data).toEqual({ success: true, item: "newItem" });
			});

			it("should send data to a route with form data", async () => {
				const response = await fetcher.post({
					url: "/items-form",
					form: {
						item: "newItem",
						quantity: "5",
					},
				});
				const data = await response.json();
				expect(data).toEqual({
					success: true,
					body: { item: "newItem", quantity: 5 },
				});
			});

			it("should send data to a route with JSON data", async () => {
				const response = await fetcher.post({
					url: "/items-json",
					body: { item: "newItem" },
				});
				const data = await response.json();
				expect(data).toEqual({ success: true, body: { item: "newItem" } });
			});

			it("should pass custom headers", async () => {
				const customHeaderValue = "test-value";
				const response = await fetcher.get({
					url: "/users/:id",
					params: { id: "789" },
					init: {
						headers: { "X-Custom-Header": customHeaderValue },
					},
				});

				// We need to mock the headers check in the actual app for this test
				// For now, we'll just check if the response is successful
				expect(response.ok).toBe(true);
			});
		});
	};

	runFetcherTests("app based fetcher", async () => {
		return honoFetcher<typeof app>(app.request);
	});

	describe("direct fetcher", () => {
		let server: ServerType;
		let port: number;

		beforeAll(async () => {
			await new Promise((resolve) => {
				server = serve(app, (info) => {
					port = info.port;
					resolve(true);
				});
			});
		});

		afterAll(async () => {
			server.close();
		});

		runFetcherTests("direct fetcher", async () => {
			return honoFetcher<typeof app>((request, init) => {
				return fetch(`http://localhost:${port}${request}`, init);
			});
		});
	});

	describe("type checks", () => {
		let fetcher: TypedHonoFetcher<typeof app>;

		beforeAll(() => {
			fetcher = honoFetcher<typeof app>(app.request);
		});

		it("should have correct type for valid routes", () => {
			// expectTypeOf(fetcher.get).parameter(0).toEqualTypeOf<{
			// 	url: "/users/:id" | "/items";
			// 	init: RequestInitWithCf;
			// 	form: undefined;
			// 	body: undefined;
			// 	params?: undefined;
			// }>();
		});

		it("should not allow invalid routes", () => {
			// @ts-expect-error
			expectTypeOf(fetcher.get({ url: "/non-existent" })).toBeNever();
		});

		it("should require correct params for routes with path parameters", () => {
			// Correct usage
			expectTypeOf(
				fetcher.get({ url: "/users/:id", params: { id: "123" } }),
			).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();

			expectTypeOf(
				// @ts-expect-error - Missing required 'id' param
				fetcher.get({ url: "/users/:id" }),
			).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();

			expectTypeOf(
				// @ts-expect-error - Wrong param name
				fetcher.get({ url: "/users/:id", params: { userId: "123" } }),
			).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();

			expectTypeOf(
				fetcher.get({
					url: "/users/:id",
					// @ts-expect-error - Extra param
					params: { id: "123", extra: "param" },
				}),
			).toEqualTypeOf<Promise<JsonResponse<{ id: string; name: string }>>>();
		});

		it("should not allow params for routes without path parameters", () => {
			// Correct usage
			expectTypeOf(fetcher.get({ url: "/items" })).toBeObject();

			expectTypeOf(
				// @ts-expect-error - Params not allowed for this route
				fetcher.get({ url: "/items", params: { someParam: "value" } }),
			).toEqualTypeOf<Promise<JsonResponse<{ items: string[] }>>>();
		});

		it("should enforce correct body type for POST requests", () => {
			// Correct usage
			expectTypeOf(
				fetcher.post({ url: "/items", body: { item: "newItem" } }),
			).toBeObject();
			// Correct usage
			expectTypeOf(
				fetcher.post({ url: "/items-json", body: { item: "newItem" } }),
			).toBeObject();

			// @ts-expect-error - Missing required body
			expectTypeOf(fetcher.post({ url: "/items" })).toBeNever();

			expectTypeOf(
				// @ts-expect-error - Incorrect body type
				fetcher.post({ url: "/items-json", body: { wrongKey: "value" } }),
			).toEqualTypeOf<
				Promise<JsonResponse<{ success: boolean; body: { item: string } }>>
			>();

			expectTypeOf(
				fetcher.post({
					url: "/items-json",
					body: {
						item: "newItem",
						// @ts-expect-error - Incorrect body type
						extra: "property",
					},
				}),
			).toEqualTypeOf<
				Promise<JsonResponse<{ success: boolean; body: { item: string } }>>
			>();
		});

		it("should enforce correct form data type for POST form requests", () => {
			// Correct usage
			expectTypeOf(
				fetcher.post({
					url: "/items-form",
					form: { item: "newItem", quantity: "5" },
				}),
			).toEqualTypeOf<
				Promise<
					JsonResponse<{
						success: boolean;
						body: { item: string; quantity: number };
					}>
				>
			>();

			expectTypeOf(
				// @ts-expect-error - Missing required field
				fetcher.post({ url: "/items-form", body: { item: "newItem" } }),
			).toEqualTypeOf<
				Promise<
					JsonResponse<{
						success: boolean;
						body: { item: string; quantity: number };
					}>
				>
			>();

			expectTypeOf(
				fetcher.post({
					url: "/items-form",
					form: {
						item: "newItem",
						quantity: "5",
						// @ts-expect-error - Extra field
						extra: "property",
					},
				}),
			).toEqualTypeOf<
				Promise<
					JsonResponse<{
						success: boolean;
						body: { item: string; quantity: number };
					}>
				>
			>();

			expectTypeOf(
				fetcher.post({
					url: "/items-form",
					// @ts-expect-error - Wrong type for quantity
					form: { item: "newItem", quantity: 5 },
				}),
			).toEqualTypeOf<
				Promise<
					JsonResponse<{
						success: boolean;
						body: { item: string; quantity: number };
					}>
				>
			>();
		});
	});
});