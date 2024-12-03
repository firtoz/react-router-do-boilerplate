import { expect, test, beforeAll, describe, afterAll } from "bun:test";
import net from "node:net";

// @ts-expect-error CI is not defined in the global scope
describe.skipIf(process.env.CI === "true")("Integration Tests", () => {
	let devServer: ReturnType<typeof Bun.spawn>;
	const maxRetries = 3;
	const port = 5173;

	beforeAll(async () => {
		// Build the project before running tests
		// await $`bun build`;

		let retries = 0;
		while (retries < maxRetries) {
			try {
				// Start the dev server
				devServer = Bun.spawn({ cmd: ["bun", "dev"] });

				// Wait for the dev server to start
				await new Promise((resolve) => setTimeout(resolve, 5_000));

				// Check if the port is open
				const portOpen = await isPortOpen(port);
				if (portOpen) {
					break; // Server started successfully, exit the loop
				}
			} catch (error) {
				console.error(error);
				retries++;
				if (retries === maxRetries) {
					throw new Error("Dev server failed to start after multiple retries");
				}
			}

			// If the port is not open, restart the dev server
			devServer.kill("SIGKILL");
		}
	});

	afterAll(async () => {
		// Stop the dev server after tests
		devServer.kill("SIGKILL");
	});

	test("Dev server is running", async () => {
		const portOpen = await isPortOpen(port);
		expect(portOpen).toBe(true);
	});
});

// Helper function to check if a port is open
function isPortOpen(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", (err) => {
			if (err.message.includes("ECONNREFUSED")) {
				resolve(false);
			} else {
				resolve(false);
			}
		});
		socket.connect(port, "127.0.0.1");
	});
}
