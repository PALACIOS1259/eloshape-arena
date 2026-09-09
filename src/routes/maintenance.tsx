import { createFileRoute } from "@tanstack/react-router";

import { PreLaunchPage } from "../components/launch/PreLaunchPage";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: PreLaunchPage,
});
