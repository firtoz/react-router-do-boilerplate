import { expect, test, describe, beforeAll, afterAll } from "vitest";
import {
	doFetcherWithName,
	doFetcherWithId,
	type TypedFetcher,
} from "../src/doFetcher";

import type { TestDurableObject, TestEnv } from "./worker";
import path from "node:path";
import { WranglerTestSetup } from "./WranglerTestSetup";

describe("doFetcher with mock worker", () => {
	let wranglerSetup: WranglerTestSetup<TestEnv>;
	let abortController: AbortController;

	beforeAll(async () => {
		const originalWranglerPath = path.resolve(__dirname, "wrangler.toml");
		const workerPath = path.resolve(__dirname, "worker.ts");
		wranglerSetup = new WranglerTestSetup(originalWranglerPath, workerPath, {
			environment: "dev",
		});
		abortController = new AbortController();
		await wranglerSetup.setup(abortController.signal);
	});

	afterAll(async () => {
		abortController.abort();
	});

	describe("doFetcherWithName", () => {
		let fetcher: TypedFetcher<DurableObjectStub<TestDurableObject>>;

		beforeAll(() => {
			fetcher = doFetcherWithName(wranglerSetup.env.TEST, "test-name");
		});

		test("GET request", async () => {
			const response = await fetcher.get("/test");
			const data = await response.json();
			expect(data).toEqual({
				method: "GET",
				id: expect.any(String),
			});
		});

		test("POST request", async () => {
			const response = await fetcher.post("/test", { foo: "bar" });
			const data = await response.json();
			expect(data).toEqual({
				method: "POST",
				body: { foo: "bar" },
				id: expect.any(String),
			});
		});

		test("PUT request", async () => {
			const response = await fetcher.put("/test", { baz: "qux" });
			const data = await response.json();
			expect(data).toEqual({
				method: "PUT",
				body: { baz: "qux" },
				id: expect.any(String),
			});
		});

		test("DELETE request", async () => {
			const response = await fetcher.delete("/test");
			const data = await response.json();
			expect(data).toEqual({
				method: "DELETE",
				id: expect.any(String),
			});
		});

		test("PATCH request", async () => {
			const response = await fetcher.patch("/test", { update: "value" });
			const data = await response.json();
			expect(data).toEqual({
				method: "PATCH",
				body: { update: "value" },
				id: expect.any(String),
			});
		});
	});

	describe("doFetcherWithId", () => {
		let fetcher: TypedFetcher<DurableObjectStub<TestDurableObject>>;

		beforeAll(() => {
			fetcher = doFetcherWithId(
				wranglerSetup.env.TEST,
				wranglerSetup.env.TEST.idFromName("test-id").toString(),
			);
		});

		test("GET request", async () => {
			const response = await fetcher.get("/test");
			const data = await response.json();
			expect(data).toEqual({
				method: "GET",
				id: expect.any(String),
			});
		});

		test("POST request", async () => {
			const response = await fetcher.post("/test", { foo: "bar" });
			const data = await response.json();
			expect(data).toEqual({
				method: "POST",
				body: { foo: "bar" },
				id: expect.any(String),
			});
		});

		test("PUT request", async () => {
			const response = await fetcher.put("/test", { baz: "qux" });
			const data = await response.json();
			expect(data).toEqual({
				method: "PUT",
				body: { baz: "qux" },
				id: expect.any(String),
			});
		});

		test("DELETE request", async () => {
			const response = await fetcher.delete("/test");
			const data = await response.json();
			expect(data).toEqual({
				method: "DELETE",
				id: expect.any(String),
			});
		});

		test("PATCH request", async () => {
			const response = await fetcher.patch("/test", { update: "value" });
			const data = await response.json();
			expect(data).toEqual({
				method: "PATCH",
				body: { update: "value" },
				id: expect.any(String),
			});
		});
	});
});
