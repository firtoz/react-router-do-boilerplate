import type { Hono } from "hono";
import ky from "ky";
import { honoFetcher, type TypedHonoFetcher } from "./honoFetcher";

export const kyHonoFetcher = <T extends Hono>(
	baseUrl: string,
): TypedHonoFetcher<T> => {
	const kyInstance = ky.create({ prefixUrl: baseUrl });

	return honoFetcher<T>((request, init) => {
		// Remove the leading slash from the request URL
		const url = request.startsWith("/") ? request.slice(1) : request;
		return kyInstance(url, init) as ReturnType<T["request"]>;
	});
};
