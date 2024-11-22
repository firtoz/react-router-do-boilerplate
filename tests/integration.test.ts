import { expect, test, beforeAll, describe, afterAll } from "bun:test";

describe("Integration Tests", () => {
	let devServer: ReturnType<typeof Bun.spawn>;

	beforeAll(async () => {
		// Build the project before running tests
		// await $`bun build`;

		// Start the dev server
		devServer = Bun.spawn({ cmd: ["bun", "dev"] });
	});

	afterAll(async () => {
		// Stop the dev server after tests
		devServer.kill();
	});

	test(
		"Dev server is running",
		async () => {
			// Wait for the dev server to start
			await new Promise((resolve) => setTimeout(resolve, 5_000));

			// Check if the dev server is responding
			const response = await fetch("http://localhost:5173");
			expect(response.ok).toBe(true);
		},
		{
			timeout: 10_000,
		},
	); // Increase the timeout for this test
});
