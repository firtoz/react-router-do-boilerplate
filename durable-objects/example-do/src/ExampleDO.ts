import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "cloudflare-worker-config";
import Color from "color";
import { type Context, Hono, type TypedResponse } from "hono";
import { z } from "zod";
import type { ClientMessage, LiveParticipant, ServerMessage } from "./types";

export class WebsocketWrapper<TAttachment, TMessage> {
	public constructor(public webSocket: WebSocket) {}

	public send(message: TMessage) {
		this.webSocket.send(JSON.stringify(message));
	}

	public deserializeAttachment() {
		return this.webSocket.deserializeAttachment() as TAttachment;
	}

	public serializeAttachment(attachment: TAttachment) {
		this.webSocket.serializeAttachment(attachment);
	}
}

class ExampleDOWebsocket extends WebsocketWrapper<
	LiveParticipant,
	ServerMessage
> {}

const textDecoder = new TextDecoder();

type WebsocketSession = {
	ws: WebSocket;
	wrapper: ExampleDOWebsocket;
	data: LiveParticipant;
};

export class ExampleDO extends DurableObject<Env> implements DOWithHonoApp {
	app = new Hono<{
		Bindings: Env;
	}>()
		.get("/", (c) => {
			return c.text(
				`GET: Hello World from the Example Durable Object. Env: ${c.env.ENV}`,
			);
		})
		.post(
			"/test",
			zValidator(
				"json",
				z.object({
					/**
					 * This is a temporary name to test the data.
					 */
					name: z.string(),
				}),
			),
			async (
				c,
			): Promise<
				TypedResponse<{
					/**
					 * This is a temporary message to test the data.
					 */
					message: string;
				}>
			> => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return c.json({
					message: `POST: Hello ${c.req.valid("json").name} from the Example Durable Object.`,
				});
			},
		)
		.get("/websocket", async (c): Promise<Response> => {
			const { req } = c;
			if (req.header("Upgrade") !== "websocket") {
				console.error("Expected websocket");
				return c.text("Expected websocket", 400);
			}

			const pair = new WebSocketPair();

			try {
				await this.handleSession(c, pair[1]);
				return new Response(null, { status: 101, webSocket: pair[0] });
			} catch (error) {
				console.error(error);
				pair[1].accept();
				pair[1].send(
					JSON.stringify({
						error: "Uncaught exception during session setup.",
					}),
				);
				pair[1].close(1011, "Uncaught exception during session setup.");
				return new Response(null, { status: 101, webSocket: pair[0] });
			}
		});

	private sessions = new Map<WebSocket, WebsocketSession>();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const websockets = this.ctx.getWebSockets();
			for (const websocket of websockets) {
				const wrapper = new ExampleDOWebsocket(websocket);
				this.sessions.set(websocket, {
					ws: websocket,
					wrapper,
					data: wrapper.deserializeAttachment(),
				});
			}
		});
	}

	override async fetch(request: Request) {
		return this.app.fetch(request, this.env);
	}

	async handleSession(
		c: Context<{ Bindings: Env }>,
		ws: WebSocket,
	): Promise<void> {
		this.ctx.acceptWebSocket(ws);
		const wrapper = new ExampleDOWebsocket(ws);
		const data: LiveParticipant = {
			id: crypto.randomUUID(),
			color: Color.hsl(Math.random() * 360, 50, 50)
				.rgb()
				.string(),
			pointers: [],
		};
		wrapper.serializeAttachment(data);

		this.sessions.set(ws, {
			ws,
			wrapper,
			data,
		});
	}

	override async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		const session = this.sessions.get(ws);
		if (!session) {
			return;
		}

		let messageString: string;
		if (message instanceof ArrayBuffer) {
			messageString = textDecoder.decode(message);
		} else {
			messageString = message;
		}

		const parsed = JSON.parse(messageString) as ClientMessage;

		switch (parsed.type) {
			case "join": {
				this.broadcast(
					{
						type: "joined",
						participant: session.data,
					},
					session.data.id,
				);

				const welcomeMessage: ServerMessage = {
					type: "welcome",
					participants: Array.from(this.sessions.values())
						.filter((s) => s.data.id !== session.data.id)
						.map((s) => s.data),
				};

				session.wrapper.send(welcomeMessage);
				break;
			}
			case "pointerUpdate": {
				// Replace all pointers with the new ones
				session.data.pointers = parsed.pointers;

				this.broadcast(
					{
						type: "updated",
						participant: session.data,
					},
					session.data.id,
				);
				break;
			}
		}
	}

	override async webSocketClose(ws: WebSocket) {
		const session = this.sessions.get(ws);
		if (!session) {
			return;
		}

		this.handleClose(session);
	}

	private handleClose(session: WebsocketSession) {
		// Clear all pointers when the session closes
		session.data.pointers = [];

		this.broadcast(
			{
				type: "left",
				id: session.data.id,
			},
			session.data.id,
		);

		this.sessions.delete(session.ws);
	}

	override async webSocketError(ws: WebSocket, error: unknown) {
		const session = this.sessions.get(ws);
		if (!session) {
			ws.close(1011, "Error during session setup.");
			return;
		}

		console.error(`Error for session ${session.data.id}: ${error}`);

		this.handleClose(session);

		ws.close(1011, "Error during session.");
	}

	private broadcast(message: ServerMessage, sourceId: string) {
		for (const session of this.sessions.values()) {
			if (session.data.id === sourceId) {
				continue;
			}

			session.wrapper.send(message);
		}
	}
}

export default {
	fetch: new Hono().get("/", (c) => {
		return c.text("OK");
	}).fetch,
};
