// Fork: apply the persisted Forma theme before anything else paints. It runs
// from this single module entry; a second html entry breaks the bundled-dev
// React refresh preamble.
import "./themeBootstrap";
import { showBootError } from "./lib/bootError";

// Shared dev chunks need the React refresh preamble first. Catch failures before React mounts.
void import("./main").then(({ startup }) => startup).catch(showBootError);
