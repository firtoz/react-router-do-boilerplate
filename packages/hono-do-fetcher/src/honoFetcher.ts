import type { Hono } from "hono";
import type { ExtractSchema } from "hono/types";

export type ParsePathParams<T extends string> =
	T extends `${infer _Start}/:${infer Param}/${infer Rest}`
		? { [K in Param | keyof ParsePathParams<`/${Rest}`>]: string }
		: T extends `${infer _Start}/:${infer Param}`
			? { [K in Param]: string }
			: never;

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export type HonoSchemaKeys<T extends Hono> = string & keyof ExtractSchema<T>;

type FilterKeysByMethod<T, M extends HttpMethod> = {
	[K in keyof T as T[K] extends { [key in `$${M}`]: unknown }
		? K
		: never]: T[K];
};

type HonoSchema<T extends Hono> = {
	[M in HttpMethod]: FilterKeysByMethod<ExtractSchema<T>, M>;
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

type TypedMethodFetcher<T extends Hono, M extends HttpMethod> = <
	SchemaPath extends string & keyof HonoSchema<T>[M],
>(
	url: SchemaPath,
	...args: M extends "get" | "delete"
		? FetcherParams<SchemaPath>
		: BodyParams<T, M, SchemaPath>
) => Promise<SchemaOutput<T, M, SchemaPath>>;

type SchemaOutput<
	T extends Hono,
	M extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<T>[M],
	DollarM extends `$${M}` & keyof HonoSchema<T>[M][SchemaPath] = `$${M}` &
		keyof HonoSchema<T>[M][SchemaPath],
> = "output" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]
	? JsonResponse<HonoSchema<T>[M][SchemaPath][DollarM]["output"]>
	: never;

type BodyParams<
	T extends Hono,
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

type AvailableMethods<T extends Hono> = {
	[M in HttpMethod]: keyof HonoSchema<T>[M] extends never ? never : M;
}[HttpMethod];

export type TypedHonoFetcher<T extends Hono> = {
	[M in AvailableMethods<T>]: TypedMethodFetcher<T, M>;
};

const createMethodFetcher = <T extends Hono, M extends HttpMethod>(
	fetcher: (request: string, init?: RequestInit) => ReturnType<T["request"]>,
	method: M,
): TypedMethodFetcher<T, M> => {
	return (async (url: string, ...args) => {
		let finalUrl = url;
		let body: unknown;
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
			return await fetcher(finalUrl, {
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

export const honoFetcher = <T extends Hono>(
	fetcher: (request: string, init?: RequestInit) => ReturnType<T["request"]>,
): TypedHonoFetcher<T> => {
	const methods = ["get", "post", "put", "delete", "patch"] as const;

	return methods.reduce(
		(acc, method) => {
			(
				acc as TypedHonoFetcher<T> & {
					[M in typeof method]: TypedMethodFetcher<T, M>;
				}
			)[method] = createMethodFetcher(fetcher, method) as TypedMethodFetcher<
				T,
				typeof method
			>;
			return acc;
		},
		{} as TypedHonoFetcher<T>,
	);
};
