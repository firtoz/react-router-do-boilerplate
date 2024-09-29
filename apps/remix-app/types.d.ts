import type { ServerBuild } from "@remix-run/cloudflare";

declare module "./build/server" {
  const server: ServerBuild;
  export = server;
}

