/** `--import` から読み込み、`studio-alias-hooks.mjs` を解決フックとして登録する */
import { register } from "node:module";

register("./studio-alias-hooks.mjs", import.meta.url);
