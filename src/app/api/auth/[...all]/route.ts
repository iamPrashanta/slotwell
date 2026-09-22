import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@server/auth.mjs";

export const { GET, POST } = toNextJsHandler(auth);
