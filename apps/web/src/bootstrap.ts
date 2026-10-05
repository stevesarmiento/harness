// Fork: apply the persisted Forma theme before anything else paints. It runs
// from this single module entry; a second html entry breaks the bundled-dev
// React refresh preamble.
import "./themeBootstrap";
import { showBootError } from "./lib/bootError";

// Bundled dev can move UI code into shared chunks. Load it only after this
// entry runs the React refresh preamble, and catch failures before React mounts.
void import("./main").then(({ startup }) => startup).catch(showBootError);
