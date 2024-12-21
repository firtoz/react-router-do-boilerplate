import type { Env } from "cloudflare-worker-config";
import type { Context } from "hono";
import { WebsocketWrapper } from "./WebsocketWrapper";

export type SessionClientMessage<TSession extends BaseSession> =
	TSession extends BaseSession<unknown, unknown, infer TClientMessage>
		? TClientMessage
		: never;

export abstract class BaseSession<
	TData = unknown,
	TServerMessage = unknown,
	TClientMessage = unknown,
> {
	private _data!: TData;

	public get data(): TData {
		return this._data;
	}

	private set data(data: TData) {
		this._data = data;
	}

	private readonly wrapper: WebsocketWrapper<TData, TServerMessage>;

	constructor(
		public websocket: WebSocket,
		protected sessions: Map<
			WebSocket,
			BaseSession<TData, TServerMessage, TClientMessage>
		>,
	) {
		this.wrapper = new WebsocketWrapper<TData, TServerMessage>(websocket);
	}

	public startFresh(ctx: Context<{ Bindings: Env }>) {
		this.data = this.createData(ctx);
		this.wrapper.serializeAttachment(this.data);
	}

	public resume() {
		const existingData = this.wrapper.deserializeAttachment();
		if (existingData) {
			this.data = existingData;
		} else {
			throw new Error("No data to resume");
		}
	}

	public update() {
		this.wrapper.serializeAttachment(this.data);
	}

	protected abstract createData(ctx: Context<{ Bindings: Env }>): TData;

	protected broadcast(message: TServerMessage, excludeSelf = false) {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			session.send(message);
		}
	}

	protected send(message: TServerMessage) {
		this.wrapper.send(message);
	}

	abstract handleMessage(message: TClientMessage): Promise<void>;
	abstract handleClose(): Promise<void>;
}
