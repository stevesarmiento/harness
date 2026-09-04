// Fork: apply the persisted Forma theme before anything else so the first
// paint matches the user's preferences (previously a separate html entry).
import "./themeBootstrap";
import { showBootError } from "./lib/bootError";

// Bundled dev can move UI code into shared chunks. Load it only after this
// entry runs the React refresh preamble, and catch failures before React mounts.
void import("./main").then(({ startup }) => startup).catch(showBootError);
