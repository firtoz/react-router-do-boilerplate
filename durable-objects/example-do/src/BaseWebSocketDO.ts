import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import type { Env } from "cloudflare-worker-config";
import { type Context, Hono } from "hono";
import type { BaseSession, SessionClientMessage } from "./BaseSession";

const textDecoder = new TextDecoder();

export abstract class BaseWebSocketDO<TSession extends BaseSession>
	extends DurableObject<Env>
	implements DOWithHonoApp
{
	protected sessions = new Map<WebSocket, TSession>();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const websockets = this.ctx.getWebSockets();
			for (const websocket of websockets) {
				const session = this.createSession(websocket);
				session.resume();
				this.sessions.set(websocket, session);
			}
		});
	}

	protected getBaseApp() {
		return new Hono<{ Bindings: Env }>().get(
			"/websocket",
			async (ctx): Promise<Response> => {
				const { req } = ctx;
				if (req.header("Upgrade") !== "websocket") {
					console.error("Expected websocket");
					return ctx.text("Expected websocket", 400);
				}

				const pair = new WebSocketPair();

				try {
					await this.handleSession(ctx, pair[1]);
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
			},
		);
	}

	abstract app: Hono<{ Bindings: Env }>;

	protected abstract createSession(websocket: WebSocket): TSession;

	async handleSession(
		ctx: Context<{ Bindings: Env }>,
		ws: WebSocket,
	): Promise<void> {
		this.ctx.acceptWebSocket(ws);
		const session = this.createSession(ws);
		session.startFresh(ctx);
		this.sessions.set(ws, session);
	}

	override async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		const session = this.sessions.get(ws);
		if (!session) return;

		let messageString: string;
		if (message instanceof ArrayBuffer) {
			messageString = textDecoder.decode(message);
		} else {
			messageString = message;
		}

		const parsed = JSON.parse(messageString) as SessionClientMessage<TSession>;
		await session.handleMessage(parsed);
	}

	override async webSocketClose(ws: WebSocket) {
		const session = this.sessions.get(ws);
		if (!session) return;

		await this.#handleClose(session);
	}

	override async webSocketError(ws: WebSocket, error: unknown) {
		const session = this.sessions.get(ws);
		if (!session) {
			ws.close(1011, "Error during session setup.");
			return;
		}

		console.error(`Error for session: ${error}`);
		await this.#handleClose(session);
		ws.close(1011, "Error during session.");
	}

	async #handleClose(session: TSession) {
		await session.handleClose();
		this.sessions.delete(session.websocket);
	}

	override fetch(request: Request): Response | Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}
