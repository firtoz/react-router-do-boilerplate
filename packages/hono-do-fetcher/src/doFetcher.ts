import type { Hono, Schema } from "hono";
import type { ExtractSchema } from "hono/types";
import type { HttpMethod, ParsePathParams } from "./honoFetcher";

const DUMMY_URL = "http://dummy-url";

export type DOWithHonoApp<S extends Schema = Schema> = DurableObject & {
	// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass in any schema
	app: Hono<any, S>;
};

export type DOSchemaMap<T extends DOWithHonoApp> = T extends DOWithHonoApp
	? ExtractSchema<T["app"]>
	: never;

export type DOSchemaKeys<T extends DOWithHonoApp> = string &
	keyof DOSchemaMap<T>;

export type DOStubSchema<T extends DurableObjectStub> =
	T extends DurableObjectStub<infer S>
		? S extends DOWithHonoApp
			? {
					[M in HttpMethod]: {
						[K in DOSchemaKeys<S> as DOSchemaMap<S>[K] extends {
							[key in `$${M}`]: unknown;
						}
							? K
							: never]: DOSchemaMap<S>[K];
					};
				}
			: never
		: never;

type JsonResponse<T> = Omit<Response, "json"> & {
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

type TypedMethodFetcher<T extends DurableObjectStub, M extends HttpMethod> = <
	SchemaPath extends string & keyof DOStubSchema<T>[M],
>(
	url: SchemaPath,
	...args: M extends "get" | "delete"
		? FetcherParams<SchemaPath>
		: [
				body: DOStubSchema<T>[M][SchemaPath][`$${M}`]["input"]["json"],
				...rest: FetcherParams<SchemaPath>,
			]
) => Promise<JsonResponse<DOStubSchema<T>[M][SchemaPath][`$${M}`]["output"]>>;

type AvailableMethods<T extends DurableObjectStub> = {
	[M in HttpMethod]: keyof DOStubSchema<T>[M] extends never ? never : M;
}[HttpMethod];

export type TypedFetcher<T extends DurableObjectStub> = {
	[M in AvailableMethods<T>]: TypedMethodFetcher<T, M>;
};

const createMethodFetcher = <T extends DurableObjectStub, M extends HttpMethod>(
	durableObject: T,
	method: M,
): TypedMethodFetcher<T, M> => {
	return async (url: string, ...args) => {
		let finalUrl = url;
		// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass in any schema
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
			return await durableObject.fetch(`${DUMMY_URL}${finalUrl}`, {
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
	};
};

export const doFetcher = <const T extends DurableObjectStub>(
	durableObject: T,
): TypedFetcher<T> => {
	const methods = ["get", "post", "put", "delete", "patch"] as const;

	return methods.reduce(
		(acc, method) => {
			(
				acc as TypedFetcher<T> & {
					[M in typeof method]: TypedMethodFetcher<T, M>;
				}
			)[method] = createMethodFetcher(
				durableObject,
				method,
			) as TypedMethodFetcher<T, typeof method>;
			return acc;
		},
		{} as TypedFetcher<T>,
	);
};

export const doFetcherWithName = <
	const T extends Rpc.DurableObjectBranded | undefined = undefined,
>(
	namespace: DurableObjectNamespace<T>,
	name: string,
): TypedFetcher<DurableObjectStub<T>> => {
	return doFetcher(namespace.get(namespace.idFromName(name)));
};

export const doFetcherWithId = <
	const T extends Rpc.DurableObjectBranded | undefined = undefined,
>(
	namespace: DurableObjectNamespace<T>,
	id: string,
): TypedFetcher<DurableObjectStub<T>> => {
	return doFetcher(namespace.get(namespace.idFromString(id)));
};
