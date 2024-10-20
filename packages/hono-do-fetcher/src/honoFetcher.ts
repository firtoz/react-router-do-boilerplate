import type { Hono, Schema } from "hono";
import type { ExtractSchema } from "hono/types";

type ParsePathParams<T extends string> =
	T extends `${infer _Start}/:${infer Param}/${infer Rest}`
		? { [K in Param | keyof ParsePathParams<`/${Rest}`>]: string }
		: T extends `${infer _Start}/:${infer Param}`
			? { [K in Param]: string }
			: never;

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type HonoSchemaMap<T extends Hono<any, any>> = ExtractSchema<T>;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type HonoSchemaKeys<T extends Hono<any, any>> = string & keyof HonoSchemaMap<T>;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type HonoSchema<T extends Hono<any, any>> = {
	[M in HttpMethod]: {
		[K in HonoSchemaKeys<T> as HonoSchemaMap<T>[K] extends {
			[key in `$${M}`]: unknown;
		}
			? K
			: never]: HonoSchemaMap<T>[K];
	};
};

export type JsonResponse<T> = Omit<Response, "json"> & {
	json: () => Promise<T>;
};

type RequestInitWithCf = RequestInit<CfProperties<unknown>>;

type HasPathParams<T extends string> = T extends `${string}:${string}`
	? true
	: false;

type FetcherParams<SchemaPath extends string> =
	HasPathParams<SchemaPath> extends true
		? [params: ParsePathParams<SchemaPath>, init?: RequestInitWithCf]
		: [init?: RequestInitWithCf];

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type TypedMethodFetcher<T extends Hono<any, any>, M extends HttpMethod> = <
	SchemaPath extends string & keyof HonoSchema<T>[M],
>(
	url: SchemaPath,
	...args: M extends "get" | "delete"
		? FetcherParams<SchemaPath>
		: BodyParams<T, M, SchemaPath>
) => Promise<SchemaOutput<T, M, SchemaPath>>;

type SchemaOutput<
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	T extends Hono<any, any>, //
	M extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<T>[M],
	DollarM extends `$${M}` & keyof HonoSchema<T>[M][SchemaPath] = `$${M}` &
		keyof HonoSchema<T>[M][SchemaPath],
> = "output" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]
	? JsonResponse<HonoSchema<T>[M][SchemaPath][DollarM]["output"]>
	: never;

type BodyParams<
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	T extends Hono<any, any>, //
	M extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<T>[M],
	DollarM extends `$${M}` & keyof HonoSchema<T>[M][SchemaPath] = `$${M}` &
		keyof HonoSchema<T>[M][SchemaPath],
> = [
	body: "input" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]
		? "json" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]["input"]
			? HonoSchema<T>[M][SchemaPath][DollarM]["input"]["json"]
			: unknown
		: never,
	...rest: FetcherParams<SchemaPath>,
];

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type AvailableMethods<T extends Hono<any, any>> = {
	[M in HttpMethod]: keyof HonoSchema<T>[M] extends never ? never : M;
}[HttpMethod];

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type TypedHonoFetcher<T extends Hono<any, any>> = {
	[M in AvailableMethods<T>]: TypedMethodFetcher<T, M>;
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const createMethodFetcher = <T extends Hono<any, any>, M extends HttpMethod>(
	app: T,
	method: M,
): TypedMethodFetcher<T, M> => {
	return (async (url: string, ...args) => {
		let finalUrl = url;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let body: any;
		let init: RequestInitWithCf = {};

		if (method === "get" || method === "delete") {
			const [params, initArg] = args;
			if (params && typeof params === "object") {
				finalUrl = Object.entries(params).reduce(
					(acc, [key, value]) => acc.replace(`:${key}`, value as string),
					finalUrl,
				);
			}
			init = initArg || {};
		} else {
			const [bodyArg, ...rest] = args;
			body = bodyArg;
			const [params, initArg] = rest;
			if (params && typeof params === "object") {
				finalUrl = Object.entries(params).reduce(
					(acc, [key, value]) => acc.replace(`:${key}`, value as string),
					finalUrl,
				);
			}
			init = initArg || {};
		}

		try {
			return await app.request(finalUrl, {
				method: method.toUpperCase(),
				body: body ? JSON.stringify(body) : undefined,
				headers: {
					...(body ? { "Content-Type": "application/json" } : {}),
					...init.headers,
				},
				...init,
			});
		} catch (error) {
			console.error(`Error ${method}ing`, error);
			throw new Error(`Failed to ${method} ${finalUrl}: ${error}`);
		}
	}) as TypedMethodFetcher<T, M>;
};
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const honoFetcher = <T extends Hono<any, any>>(
	app: T,
): TypedHonoFetcher<T> => {
	const methods = ["get", "post", "put", "delete", "patch"] as const;

	return methods.reduce(
		(acc, method) => {
			(
				acc as TypedHonoFetcher<T> & {
					[M in typeof method]: TypedMethodFetcher<T, M>;
				}
			)[method] = createMethodFetcher(app, method) as TypedMethodFetcher<
				T,
				typeof method
			>;
			return acc;
		},
		{} as TypedHonoFetcher<T>,
	);
};
