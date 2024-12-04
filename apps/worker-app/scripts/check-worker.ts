import process from "node:process";

async function checkWorkers(): Promise<boolean> {
	try {
		const response = await fetch("http://localhost:8787/check-worker", {
			method: "HEAD",
		});

		if (response.ok) {
			return true;
		}
	} catch (error) {
		console.error("Error fetching workers.");
	}
	return false;
}

async function pollWorkers(intervalMs = 1000): Promise<void> {
	while (true) {
		console.log("Checking workers...");
		if (await checkWorkers()) {
			console.log("Workers are ready!");
			process.exit(0);
		}
		console.log(
			`Workers are not ready yet... Trying again in ${intervalMs / 1000} second${
				intervalMs / 1000 === 1 ? "" : "s"
			}.`,
		);
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

pollWorkers();
