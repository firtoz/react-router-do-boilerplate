import fs from "node:fs";
import os from "node:os";
import TOML from "@iarna/toml";
import {
	type UnstableDevWorker,
	unstable_dev,
	getPlatformProxy,
} from "wrangler";
import path from "node:path";

export class WranglerTestSetup<Env> {
	private tempWranglerPath: string;
	private worker: UnstableDevWorker | null = null;
	private platformProxy: { env: Env } | null = null;

	constructor(
		private originalWranglerPath: string,
		private workerPath: string,
	) {
		this.tempWranglerPath = path.join(
			os.tmpdir(),
			`wrangler-${Date.now()}.toml`,
		);
	}

	async setup(
		abortSignal: AbortSignal,
		config: {
			environment?: string;
		} = {},
	): Promise<void> {
		const wranglerContent = fs.readFileSync(this.originalWranglerPath, "utf-8");
		const wranglerConfig = TOML.parse(wranglerContent);

		if (config.environment && config.environment.length > 0) {
			wranglerConfig.name =
				config.environment !== undefined && config.environment.length > 0
					? `${wranglerConfig.name}-${config.environment}`
					: wranglerConfig.name;
			fs.writeFileSync(this.tempWranglerPath, TOML.stringify(wranglerConfig));
		} else {
			fs.writeFileSync(this.tempWranglerPath, wranglerContent);
		}

		abortSignal.addEventListener("abort", () => this.cleanup(), { once: true });

		this.worker = await unstable_dev(this.workerPath, {
			experimental: { disableExperimentalWarning: true },
			local: true,
			env: config.environment,
			config: this.originalWranglerPath,
			persist: false,
		});

		this.platformProxy = await getPlatformProxy<Env>({
			configPath: this.tempWranglerPath,
			environment: config.environment,
			persist: false,
		});
	}

	get env(): Env {
		if (!this.platformProxy) {
			throw new Error(
				"WranglerTestSetup not initialized. Call await setup() first.",
			);
		}
		return this.platformProxy.env;
	}

	async cleanup(): Promise<void> {
		await this.worker?.stop();
		if (fs.existsSync(this.tempWranglerPath)) {
			fs.unlinkSync(this.tempWranglerPath);
		}
	}
}
