type Env = {
	ASSETS: Fetcher;

	EXAMPLE_DO: DurableObjectNamespace<
		import("../../durable-objects/example-do/src/ExampleDO").ExampleDO
	>;
};
