/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as attachments from "../attachments.js";
import type * as columns from "../columns.js";
import type * as comments from "../comments.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as paymentAttemptTypes from "../paymentAttemptTypes.js";
import type * as paymentAttempts from "../paymentAttempts.js";
import type * as tags from "../tags.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as workspaceHelpers from "../workspaceHelpers.js";
import type * as workspaceIndex from "../workspaceIndex.js";
import type * as workspaceMembers from "../workspaceMembers.js";
import type * as workspaces from "../workspaces.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  columns: typeof columns;
  comments: typeof comments;
  http: typeof http;
  migrations: typeof migrations;
  paymentAttemptTypes: typeof paymentAttemptTypes;
  paymentAttempts: typeof paymentAttempts;
  tags: typeof tags;
  tasks: typeof tasks;
  users: typeof users;
  workspaceHelpers: typeof workspaceHelpers;
  workspaceIndex: typeof workspaceIndex;
  workspaceMembers: typeof workspaceMembers;
  workspaces: typeof workspaces;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
