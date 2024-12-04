import { honoDoFetcherWithName } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import { Await, useLoaderData } from "react-router";
import { Welcome } from "~/welcome/welcome";
import type { Route } from "./+types/home";
import React from "react";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "New React Router App" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const ExampleDO = context.cloudflare.env.EXAMPLE_DO;
	if (!ExampleDO) {
		throw new Error("EXAMPLE_DO is not defined?");
	}

	const fetcher = honoDoFetcherWithName(ExampleDO, "default");

	return {
		getMessage: fetcher
			.get({
				url: "/",
			})
			.then((r) => r.text()),
		postMessage: fetcher
			.post({
				url: "/test",
				body: {
					name: "John Doe",
				},
			})
			.then((r) => r.text()),
	};
};

export default function Index() {
	const { getMessage, postMessage } = useLoaderData<typeof loader>();

	return (
		<Welcome
			message={
				<React.Fragment>
					<React.Suspense fallback={<div>GET: ...</div>}>
						<Await resolve={getMessage}>
							{(message) => <div>{message}</div>}
						</Await>
					</React.Suspense>
					<React.Suspense fallback={<div>POST: ...</div>}>
						<Await resolve={postMessage}>
							{(message) => <div>{message}</div>}
						</Await>
					</React.Suspense>
				</React.Fragment>
			}
		/>
	);
}
