# Remix Durable Objects Boilerplate

This project is a boilerplate for creating a Remix application with Cloudflare Durable Objects. It's set up as a monorepo using Yarn and Turborepo for efficient management and building.

## Project Structure

The project is organized as follows:

- `apps/remix-app`: Contains the Remix application
- `apps/worker-app`: Contains the Cloudflare Worker configuration
- `durable-objects/example-do`: Contains the Example Durable Object
- `packages`: Contains shared configurations and types

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [Yarn](https://yarnpkg.com/) (v4 or later)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (v3 or later)

While this project is set up to use Yarn and Turborepo, it may be possible to use npm, though this is not officially supported.

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   yarn
   ```

## Available Scripts

In the project directory, you can run:

### `yarn dev`

Runs the app in development mode.
Open [http://localhost:5137](http://localhost:5137) to view it in your browser.

### `yarn build`

Builds the app for production.

### `yarn start`

Runs the app in a mock production environment using the results from `yarn build`.

### `yarn lint`

Runs the linter across the project.

### `yarn deploy`

Deploys the app to Cloudflare in the production configuration.

## Learn More

To learn more about Remix and Durable Objects, check out the following resources:

- [Remix Documentation](https://remix.run/docs)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
