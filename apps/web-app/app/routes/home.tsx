import { honoDoFetcherWithName } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import { useLoaderData } from "react-router";
import { Welcome } from "~/welcome/welcome";
import type { Route } from "./+types/home";

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

	const response = await fetcher.get({
		url: "/",
	});

	return {
		message: await response.text(),
	};
};

export default function Index() {
	const { message } = useLoaderData<typeof loader>();

	return <Welcome message={message} />;
}
