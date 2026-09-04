/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses from "../analyses.js";
import type * as crons from "../crons.js";
import type * as dailyNotes from "../dailyNotes.js";
import type * as data from "../data.js";
import type * as installations from "../installations.js";
import type * as link from "../link.js";
import type * as memories from "../memories.js";
import type * as memoryLogic from "../memoryLogic.js";
import type * as objectives from "../objectives.js";
import type * as records from "../records.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  crons: typeof crons;
  dailyNotes: typeof dailyNotes;
  data: typeof data;
  installations: typeof installations;
  link: typeof link;
  memories: typeof memories;
  memoryLogic: typeof memoryLogic;
  objectives: typeof objectives;
  records: typeof records;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
