import type { Env } from "cloudflare-worker-config";
import Color from "color";
import type { Context } from "hono";
import { BaseSession } from "./BaseSession";
import type { ClientMessage, LiveParticipant, ServerMessage } from "./types";

export class ExampleSession extends BaseSession<
	LiveParticipant,
	ServerMessage,
	ClientMessage
> {
	protected createData(_ctx: Context<{ Bindings: Env }>): LiveParticipant {
		return {
			id: crypto.randomUUID(),
			color: Color.hsl(Math.random() * 360, 50, 50)
				.rgb()
				.string(),
			pointers: [],
		};
	}

	async handleMessage(message: ClientMessage): Promise<void> {
		switch (message.type) {
			case "join": {
				this.broadcast(
					{
						type: "joined",
						participant: this.data,
					},
					true,
				);

				const welcomeMessage: ServerMessage = {
					type: "welcome",
					participants: Array.from(this.sessions.values())
						.filter((s) => s !== this)
						.map((s) => s.data),
				};

				this.send(welcomeMessage);
				break;
			}
			case "pointerUpdate": {
				this.data.pointers = message.pointers;

				this.update();

				this.broadcast(
					{
						type: "updated",
						participant: this.data,
					},
					true,
				);
				break;
			}
		}
	}

	async handleClose(): Promise<void> {
		this.data.pointers = [];

		this.broadcast(
			{
				type: "left",
				id: this.data.id,
			},
			true,
		);
	}
}
