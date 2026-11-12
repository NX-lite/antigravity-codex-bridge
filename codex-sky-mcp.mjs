#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

let CHATGPT_APP = process.env.CHATGPT_APP_PATH || "/Applications/ChatGPT.app";
let CUA_DIR = `${CHATGPT_APP}/Contents/Resources/cua_node`;
let CUA_NODE = `${CUA_DIR}/bin/node`;
let SKY_CLIENT_JS = `${CUA_DIR}/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/client.js`;
let SKY_CREATE_CLIENT_JS = `${CUA_DIR}/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/create_client.js`;
let defaultSkyApp = path.join(os.homedir(), ".codex/computer-use/Codex Computer Use.app");
let bundledSkyApp = `${CUA_DIR}/lib/node_modules/@oai/sky/Codex Computer Use.app`;
let SKY_APP_PATH = fs.existsSync(defaultSkyApp) ? defaultSkyApp : bundledSkyApp;

let hop = Number(process.env.CODEX_ANCESTRY_HOP || "0");
if (hop < 2) {
  let child = spawn(CUA_NODE, [process.argv[1], ...process.argv.slice(2)], {
    env: { ...process.env, CODEX_ANCESTRY_HOP: String(hop + 1), TMPDIR: "/tmp" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
} else {
  await runServer();
}

async function runServer() {
  let SCHEMAS = {"mcp":[{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"List the apps on this computer. Returns the set of apps that are currently running, as well as any that have been used in the last 14 days, including details on usage frequency","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"list_apps"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Start an app use session if needed, then get the state of the app's key window and return a screenshot and accessibility tree. This must be called once per assistant turn before interacting with the app","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"}},"required":["app"],"type":"object"},"name":"get_app_state"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Click an element by index or pixel coordinates from screenshot","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"click_count":{"description":"Number of clicks. Defaults to 1","type":"integer"},"element_index":{"description":"Element index to click","type":"string"},"mouse_button":{"description":"Mouse button to click. Defaults to left.","enum":["left","right","middle"],"type":"string"},"x":{"description":"X coordinate in screenshot pixel coordinates","type":"number"},"y":{"description":"Y coordinate in screenshot pixel coordinates","type":"number"}},"required":["app"],"type":"object"},"name":"click"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Invoke a secondary accessibility action exposed by an element","inputSchema":{"additionalProperties":false,"properties":{"action":{"description":"Secondary accessibility action name","type":"string"},"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"element_index":{"description":"Element identifier","type":"string"}},"required":["app","element_index","action"],"type":"object"},"name":"perform_secondary_action"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Set the value of a settable accessibility element","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"element_index":{"description":"Element identifier","type":"string"},"value":{"description":"Value to assign","type":"string"}},"required":["app","element_index","value"],"type":"object"},"name":"set_value"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Select text inside a text element, or place the text cursor before or after it. Provide text exactly as it appears in the accessibility tree, including any Markdown formatting. If the text is not unique, provide surrounding prefix or suffix text to disambiguate it.","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name or bundle identifier","type":"string"},"element_index":{"description":"Text element identifier","type":"string"},"prefix":{"description":"Optional text immediately before the target, used to disambiguate repeated matches","type":"string"},"selection":{"description":"Whether to select the text or place the cursor before or after it. Defaults to text.","enum":["text","cursor_before","cursor_after"],"type":"string"},"suffix":{"description":"Optional text immediately after the target, used to disambiguate repeated matches","type":"string"},"text":{"description":"Target text as shown in the accessibility tree","type":"string"}},"required":["app","element_index","text"],"type":"object"},"name":"select_text"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Scroll an element in a direction by a number of pages","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"direction":{"description":"Scroll direction: up, down, left, or right","type":"string"},"element_index":{"description":"Element identifier","type":"string"},"pages":{"description":"Number of pages to scroll. Fractional values are supported. Defaults to 1","type":"number"}},"required":["app","element_index","direction"],"type":"object"},"name":"scroll"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Drag from one point to another using pixel coordinates","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"from_x":{"description":"Start X coordinate","type":"number"},"from_y":{"description":"Start Y coordinate","type":"number"},"to_x":{"description":"End X coordinate","type":"number"},"to_y":{"description":"End Y coordinate","type":"number"}},"required":["app","from_x","from_y","to_x","to_y"],"type":"object"},"name":"drag"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Press a key or key-combination on the keyboard, including modifier and navigation keys.\n  - This supports xdotool's `key` syntax.\n  - Examples: \"a\", \"Return\", \"Tab\", \"super+c\", \"Up\", \"KP_0\" (for the numpad 0 key).","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"key":{"description":"Key or key combination to press","type":"string"}},"required":["app","key"],"type":"object"},"name":"press_key"},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Type literal text using keyboard input","inputSchema":{"additionalProperties":false,"properties":{"app":{"description":"App name, full app path, or unambiguous bundle identifier","type":"string"},"text":{"description":"Literal text to type","type":"string"}},"required":["app","text"],"type":"object"},"name":"type_text"}],"messages":[{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Find recent Messages chats by participant, chat name, date range, or unread status. When multiple participants are provided, every participant must belong to the chat. Returns each chat's unread_count and stable chat_guid for reuse with read_messages, search_messages, send_message, and count_message_activity. Within each response, each chats[].participants item references a participants[].local_ref.","inputSchema":{"additionalProperties":false,"properties":{"exact_participants":{"default":false,"description":"When true, requires participants and matches only chats containing exactly those participants. When false, chats may include additional participants.","type":"boolean"},"from":{"description":"Include messages at or after this ISO-8601 date-time.","format":"date-time","type":"string"},"limit":{"default":20,"maximum":100,"minimum":1,"type":"integer"},"name":{"description":"Exact or partial chat name, such as a named group chat.","type":"string"},"participants":{"description":"Names, phone numbers, or email addresses that must all participate in the chat. Names are resolved using macOS Contacts.","items":{"minLength":1,"type":"string"},"maxItems":20,"type":"array"},"to":{"description":"Include messages before this ISO-8601 date-time.","format":"date-time","type":"string"},"unread_only":{"default":false,"description":"When true, return only chats with unread messages.","type":"boolean"}},"type":"object"},"name":"find_chats","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"chats":{"items":{"additionalProperties":false,"properties":{"chat_guid":{"type":"string"},"display_name":{"type":"string"},"last_message_date":{"format":"date-time","type":"string"},"participants":{"items":{"type":"string"},"type":"array"},"service":{"type":"string"},"unread_count":{"minimum":0,"type":"integer"}},"required":["chat_guid","display_name","service","last_message_date","participants"],"type":"object"},"type":"array"},"has_more":{"description":"Whether additional matching chats exist beyond those returned.","type":"boolean"},"participants":{"items":{"additionalProperties":false,"properties":{"handle":{"type":"string"},"local_ref":{"type":"string"},"name":{"type":"string"},"service":{"type":"string"}},"required":["local_ref","handle"],"type":"object"},"type":"array"}},"required":["chats","participants","has_more"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Read messages from one exact chat, newest first. If the intended chat's chat_guid is already available, use it directly. This tool returns one page of messages at a time. When more messages are available, the response includes next_cursor; pass that value as cursor in the next read_messages call. Within each response, each messages[].chat references a chats[].local_ref, and each messages[].sender references a senders[].local_ref or is me (the current user) or unknown; do not reuse local_ref mappings across responses. Messages may include attachment metadata, but not attachment contents. Unread messages include is_unread: true.","inputSchema":{"additionalProperties":false,"properties":{"chat_guid":{"description":"The stable chat_guid of the chat.","type":"string"},"cursor":{"description":"The next_cursor returned by the preceding read_messages response. Use it unchanged to read the next page, with the same chat_guid, from, to, and unread_only values.","minLength":1,"type":"string"},"from":{"description":"Include messages at or after this ISO-8601 date-time.","format":"date-time","type":"string"},"limit":{"default":50,"maximum":100,"minimum":1,"type":"integer"},"to":{"description":"Include messages before this ISO-8601 date-time.","format":"date-time","type":"string"},"unread_only":{"default":false,"description":"When true, return only unread messages.","type":"boolean"}},"required":["chat_guid"],"type":"object"},"name":"read_messages","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"chats":{"items":{"additionalProperties":false,"properties":{"chat_guid":{"type":"string"},"display_name":{"type":"string"},"local_ref":{"type":"string"}},"required":["local_ref","chat_guid"],"type":"object"},"type":"array"},"messages":{"items":{"additionalProperties":false,"properties":{"attachments":{"items":{"additionalProperties":false,"properties":{"filename":{"type":"string"},"id":{"type":"string"},"mime_type":{"type":"string"},"size_bytes":{"minimum":0,"type":"integer"}},"required":["id"],"type":"object"},"type":"array"},"body":{"type":"string"},"chat":{"type":"string"},"date":{"format":"date-time","type":"string"},"is_unread":{"type":"boolean"},"sender":{"type":"string"}},"required":["chat","sender","date"],"type":"object"},"type":"array"},"next_cursor":{"type":"string"},"senders":{"items":{"additionalProperties":false,"properties":{"handle":{"type":"string"},"local_ref":{"type":"string"},"name":{"type":"string"},"service":{"type":"string"}},"required":["local_ref","handle"],"type":"object"},"type":"array"}},"required":["chats","senders","messages"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Search message-body text, newest first. Narrow large histories with chat_guids, participants, or ISO-8601 date filters. This tool returns one page of messages at a time. When more messages are available, the response includes next_cursor; pass that value as cursor in the next search_messages call. Each response's chats[] items include a stable chat_guid for reuse with read_messages and send_message. Within each response, each messages[].chat references a chats[].local_ref, and each messages[].sender references a senders[].local_ref or is me (the current user) or unknown; do not reuse local_ref mappings across responses. Messages may include attachment metadata, but not attachment contents. Unread messages include is_unread: true.","inputSchema":{"additionalProperties":false,"properties":{"chat_guids":{"description":"Optional stable chat_guid values for existing chats. When provided, searches only those chats.","items":{"minLength":1,"type":"string"},"maxItems":20,"type":"array"},"cursor":{"description":"The next_cursor returned by the preceding search_messages response. Use it unchanged to retrieve the next page, with the same text, chat_guids, participants, exact_participants, from, and to values.","minLength":1,"type":"string"},"exact_participants":{"default":false,"description":"When true, requires participants and matches only chats containing exactly those participants. When false, chats may include additional participants.","type":"boolean"},"from":{"description":"Include messages at or after this ISO-8601 date-time.","format":"date-time","type":"string"},"limit":{"default":50,"maximum":100,"minimum":1,"type":"integer"},"participants":{"description":"Optional names, phone numbers, or email addresses that must all participate in matched chats. Names are resolved using macOS Contacts.","items":{"minLength":1,"type":"string"},"maxItems":20,"type":"array"},"text":{"description":"Case-insensitive text to find in message bodies.","minLength":1,"type":"string"},"to":{"description":"Include messages before this ISO-8601 date-time.","format":"date-time","type":"string"}},"required":["text"],"type":"object"},"name":"search_messages","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"chats":{"items":{"additionalProperties":false,"properties":{"chat_guid":{"type":"string"},"display_name":{"type":"string"},"local_ref":{"type":"string"}},"required":["local_ref","chat_guid"],"type":"object"},"type":"array"},"messages":{"items":{"additionalProperties":false,"properties":{"attachments":{"items":{"additionalProperties":false,"properties":{"filename":{"type":"string"},"id":{"type":"string"},"mime_type":{"type":"string"},"size_bytes":{"minimum":0,"type":"integer"}},"required":["id"],"type":"object"},"type":"array"},"body":{"type":"string"},"chat":{"type":"string"},"date":{"format":"date-time","type":"string"},"is_unread":{"type":"boolean"},"sender":{"type":"string"}},"required":["chat","sender","date"],"type":"object"},"type":"array"},"next_cursor":{"type":"string"},"permission_filter_message":{"description":"Present only when permission_filtered is true. Explains why messages were omitted from this page.","type":"string"},"permission_filtered":{"description":"Present and true only when read permissions caused messages to be omitted from this page; absent otherwise. The page may contain fewer messages than the requested limit, including none, and still have a next_cursor.","type":"boolean"},"senders":{"items":{"additionalProperties":false,"properties":{"handle":{"type":"string"},"local_ref":{"type":"string"},"name":{"type":"string"},"service":{"type":"string"}},"required":["local_ref","handle"],"type":"object"},"type":"array"}},"required":["chats","senders","messages"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":true,"readOnlyHint":false},"description":"Send text, local file attachments, or both. Provide exactly one of chat_guid or recipients. The user may edit the message before approving, indicated by user_edited. Reactions, edits, and unsends are unsupported; use the Computer Use plugin for those UI operations.","inputSchema":{"additionalProperties":false,"anyOf":[{"required":["text"]},{"required":["attachments"]}],"oneOf":[{"required":["chat_guid"]},{"required":["recipients"]}],"properties":{"attachments":{"description":"Optional absolute paths to local files to attach. Directories are unsupported.","items":{"minLength":1,"type":"string"},"maxItems":10,"minItems":1,"type":"array"},"chat_guid":{"description":"The stable chat_guid of an existing direct or group chat.","type":"string"},"recipients":{"description":"One or more names, phone numbers, or email addresses. One recipient targets a direct chat; multiple recipients target an existing chat with exactly those participants or a new group chat.","items":{"minLength":1,"type":"string"},"maxItems":20,"minItems":1,"type":"array"},"text":{"description":"Optional plain-text message to send.","maxLength":10000,"minLength":1,"type":"string"}},"type":"object"},"name":"send_message"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Count Messages activity over time, either overall or per chat. Returns total message counts split into sent and received, optionally grouped by calendar interval. When the request names specific chats or people, first resolve the intended chats with find_chats, then pass the returned chat_guid values as chat_guids. Set breakdown to overall for combined activity or chat for ranked per-chat activity. When more chats are available, the response includes next_cursor; pass that value as cursor in the next count_message_activity call with the original filter arguments. If from or to was originally omitted, continue omitting it. Every counts_by_bucket object contains total, sent, and received arrays aligned by index with buckets, including intervals with no activity.","inputSchema":{"additionalProperties":false,"properties":{"breakdown":{"default":"overall","description":"Return combined overall activity or ranked, paginated per-chat activity.","enum":["overall","chat"],"type":"string"},"chat_guids":{"description":"Optional stable chat_guid values for existing chats. When provided, counts only those chats.","items":{"minLength":1,"type":"string"},"maxItems":20,"minItems":1,"type":"array"},"chat_limit":{"description":"For chat breakdowns, sets the maximum number of chats per page; defaults to 20.","maximum":100,"minimum":1,"type":"integer"},"chat_type":{"description":"Optional chat type filter. Omit to include both direct and group chats.","enum":["direct","group"],"type":"string"},"cursor":{"description":"The next_cursor returned by the preceding count_message_activity response. Use it unchanged to retrieve the next chat page, with the same from, to, interval, chat_type, chat_guids, breakdown, and rank_by values.","minLength":1,"type":"string"},"from":{"description":"Include activity at or after this ISO-8601 date-time. Omit to begin at the oldest matching activity.","format":"date-time","type":"string"},"interval":{"default":"total","description":"Calendar interval for buckets. total returns one bucket for a nonempty range; weeks begin Monday.","enum":["total","day","week","month","year"],"type":"string"},"rank_by":{"description":"For chat breakdowns, rank chats by total, sent, or received message count; defaults to total.","enum":["total","sent","received"],"type":"string"},"to":{"description":"Include activity before this ISO-8601 date-time. Omit to end at the first request's current time.","format":"date-time","type":"string"}},"type":"object"},"name":"count_message_activity","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"breakdown":{"const":"overall","type":"string"},"buckets":{"description":"Shared ordered half-open intervals aligned by index with every array in counts_by_bucket.","items":{"additionalProperties":false,"description":"One half-open activity bucket.","properties":{"from":{"format":"date-time","type":"string"},"to":{"format":"date-time","type":"string"}},"required":["from","to"],"type":"object"},"type":"array"},"interval":{"description":"Calendar interval used for the shared buckets array.","enum":["total","day","week","month","year"],"type":"string"},"matching_chat_count":{"description":"Exact number of chats with counted activity in the complete filtered range, not only this page.","minimum":0,"type":"integer"},"overall_activity":{"additionalProperties":false,"description":"Complete aggregate across every matching chat in the filtered range.","properties":{"counts_by_bucket":{"additionalProperties":false,"properties":{"received":{"description":"Received message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"},"sent":{"description":"Sent message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"},"total":{"description":"Total message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"}},"required":["total","sent","received"],"type":"object"},"received":{"description":"Messages received by the current user.","minimum":0,"type":"integer"},"sent":{"description":"Messages sent by the current user.","minimum":0,"type":"integer"},"total":{"description":"Total messages.","minimum":0,"type":"integer"}},"required":["total","sent","received","counts_by_bucket"],"type":"object"},"range":{"additionalProperties":false,"description":"The resolved complete half-open range. Omitted request bounds resolve to the oldest matching activity and the first page's request-start time, then remain frozen across continuation pages.","properties":{"from":{"format":"date-time","type":"string"},"to":{"format":"date-time","type":"string"}},"required":["from","to"],"type":"object"},"time_zone":{"description":"Time zone used for calendar bucket boundaries.","type":"string"}},"required":["breakdown","range","interval","time_zone","buckets","matching_chat_count","overall_activity"],"type":"object"},{"additionalProperties":false,"properties":{"breakdown":{"const":"chat","type":"string"},"buckets":{"description":"Shared ordered half-open intervals aligned by index with every array in counts_by_bucket.","items":{"additionalProperties":false,"description":"One half-open activity bucket.","properties":{"from":{"format":"date-time","type":"string"},"to":{"format":"date-time","type":"string"}},"required":["from","to"],"type":"object"},"type":"array"},"chats":{"description":"The current ranked page of matching chats.","items":{"additionalProperties":false,"properties":{"chat_guid":{"type":"string"},"counts_by_bucket":{"additionalProperties":false,"properties":{"received":{"description":"Received message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"},"sent":{"description":"Sent message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"},"total":{"description":"Total message counts aligned by index with the top-level buckets array.","items":{"minimum":0,"type":"integer"},"type":"array"}},"required":["total","sent","received"],"type":"object"},"display_name":{"type":"string"},"participants":{"description":"Page-local references to top-level participants[].local_ref values.","items":{"type":"string"},"type":"array"},"received":{"description":"Messages received by the current user.","minimum":0,"type":"integer"},"sent":{"description":"Messages sent by the current user.","minimum":0,"type":"integer"},"service":{"type":"string"},"total":{"description":"Total messages.","minimum":0,"type":"integer"},"type":{"enum":["direct","group"],"type":"string"}},"required":["chat_guid","display_name","service","type","participants","total","sent","received","counts_by_bucket"],"type":"object"},"type":"array"},"interval":{"description":"Calendar interval used for the shared buckets array.","enum":["total","day","week","month","year"],"type":"string"},"matching_chat_count":{"description":"Exact number of chats with counted activity in the complete filtered range, not only this page.","minimum":0,"type":"integer"},"next_cursor":{"description":"Opaque continuation for the next ranked chat page. Omitted on the final page.","type":"string"},"participants":{"description":"Participants referenced by chats in this page only.","items":{"additionalProperties":false,"properties":{"handle":{"type":"string"},"local_ref":{"type":"string"},"name":{"type":"string"},"service":{"type":"string"}},"required":["local_ref","handle"],"type":"object"},"type":"array"},"range":{"additionalProperties":false,"description":"The resolved complete half-open range. Omitted request bounds resolve to the oldest matching activity and the first page's request-start time, then remain frozen across continuation pages.","properties":{"from":{"format":"date-time","type":"string"},"to":{"format":"date-time","type":"string"}},"required":["from","to"],"type":"object"},"time_zone":{"description":"Time zone used for calendar bucket boundaries.","type":"string"}},"required":["breakdown","range","interval","time_zone","buckets","matching_chat_count","chats","participants"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Read an image attachment returned by read_messages or search_messages. Returns the image, which may be resized or compressed to limit transfer size.","inputSchema":{"additionalProperties":false,"properties":{"id":{"description":"The id from an attachment object returned by read_messages or search_messages.","type":"string"}},"required":["id"],"type":"object"},"name":"read_image"}],"calendar":[{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"List calendars. Returns each calendar's id for reuse with list_events, create_event, and update_event.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"list_calendars","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"calendars":{"items":{"additionalProperties":false,"properties":{"allows_content_modifications":{"type":"boolean"},"id":{"type":"string"},"is_default":{"type":"boolean"},"source":{"additionalProperties":false,"properties":{"id":{"type":"string"},"title":{"type":"string"}},"required":["id","title"],"type":"object"},"title":{"type":"string"}},"required":["id","title","source","allows_content_modifications","is_default"],"type":"object"},"type":"array"}},"required":["calendars"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"List events in a date range, optionally filtered by calendar. This tool returns one page of events at a time. When more events are available, the response includes next_cursor; pass that value as cursor in the next list_events call. Returns each event's id for reuse with get_event, update_event, and delete_event. Within each response, each events[].calendar references a calendars[].local_ref, and each events[].attendees item references an attendees[].local_ref; do not reuse local_ref mappings across responses. Notes are omitted; use get_event to retrieve them.","inputSchema":{"additionalProperties":false,"properties":{"calendar_ids":{"description":"Optional calendar IDs. When nonempty, returns only events from those calendars.","items":{"minLength":1,"type":"string"},"type":"array"},"cursor":{"description":"The next_cursor returned by the preceding list_events response. Use it unchanged to retrieve the next page, with the same start_date, end_date, and calendar_ids values.","minLength":1,"type":"string"},"end_date":{"description":"End of the requested range as an ISO-8601 date-time. Must not precede start_date or be more than 31 calendar days later. Equal dates query that day in the Mac's local timezone.","format":"date-time","type":"string"},"limit":{"default":20,"maximum":100,"minimum":1,"type":"integer"},"start_date":{"description":"Start of the requested range as an ISO-8601 date-time.","format":"date-time","type":"string"}},"required":["start_date","end_date"],"type":"object"},"name":"list_events","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"attendees":{"items":{"additionalProperties":false,"properties":{"email":{"type":"string"},"is_current_user":{"type":"boolean"},"local_ref":{"type":"string"},"name":{"type":"string"}},"required":["local_ref"],"type":"object"},"type":"array"},"calendars":{"items":{"additionalProperties":false,"properties":{"id":{"type":"string"},"local_ref":{"type":"string"}},"required":["local_ref","id"],"type":"object"},"type":"array"},"events":{"description":"Matching events ordered by start date, then end date.","items":{"additionalProperties":false,"properties":{"attendees":{"items":{"type":"string"},"type":"array"},"calendar":{"type":"string"},"current_user_participant_status":{"enum":["unknown","pending","accepted","declined","tentative","delegated","completed","inProcess"],"type":"string"},"end_date":{"format":"date-time","type":"string"},"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"is_all_day":{"type":"boolean"},"is_canceled":{"type":"boolean"},"is_editable":{"type":"boolean"},"location":{"type":"string"},"recurrence_rfc2445":{"type":"string"},"start_date":{"format":"date-time","type":"string"},"title":{"type":"string"},"url":{"type":"string"}},"required":["id","start_date","end_date","is_all_day","is_canceled","is_editable","attendees","calendar"],"type":"object"},"type":"array"},"next_cursor":{"description":"Opaque continuation for the next event page. Omitted on the final page.","type":"string"}},"required":["events","calendars","attendees"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Get one event occurrence by id. Use this to retrieve notes omitted by list_events. If the intended event's id is already available, use it directly.","inputSchema":{"additionalProperties":false,"properties":{"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"}},"required":["id"],"type":"object"},"name":"get_event","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"attendees":{"items":{"additionalProperties":false,"properties":{"email":{"type":"string"},"is_current_user":{"type":"boolean"},"name":{"type":"string"}},"required":[],"type":"object"},"type":"array"},"calendar_id":{"type":"string"},"current_user_participant_status":{"enum":["unknown","pending","accepted","declined","tentative","delegated","completed","inProcess"],"type":"string"},"end_date":{"format":"date-time","type":"string"},"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"is_all_day":{"type":"boolean"},"is_canceled":{"type":"boolean"},"is_editable":{"type":"boolean"},"location":{"type":"string"},"notes":{"type":"string"},"recurrence_rfc2445":{"type":"string"},"start_date":{"format":"date-time","type":"string"},"title":{"type":"string"},"url":{"type":"string"}},"required":["id","start_date","end_date","is_all_day","is_canceled","is_editable","attendees","calendar_id"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":true,"readOnlyHint":false},"description":"Create an event. Unless the user requests a specific calendar, omit calendar_id to use their default calendar. Returns the created event. Including attendees may send invitations.","inputSchema":{"additionalProperties":false,"properties":{"attendees":{"description":"Attendees with email addresses. Names are optional and are not resolved to email addresses. On update, replaces the attendees.","items":{"additionalProperties":false,"properties":{"email":{"minLength":1,"type":"string"},"name":{"type":"string"}},"required":["email"],"type":"object"},"type":"array"},"calendar_id":{"description":"If omitted, uses the user's default calendar.","minLength":1,"type":"string"},"end_date":{"description":"Event end as an ISO-8601 date-time. If omitted or earlier than start_date, uses the Calendar app's default event duration.","format":"date-time","type":"string"},"is_all_day":{"type":"boolean"},"location":{"type":"string"},"notes":{"type":"string"},"recurrence_rfc2445":{"description":"RFC 2445 recurrence rule without an RRULE prefix, such as FREQ=WEEKLY;COUNT=3. Empty or invalid rules are ignored.","type":"string"},"start_date":{"description":"Event start as an ISO-8601 date-time with a timezone offset.","format":"date-time","type":"string"},"title":{"minLength":1,"type":"string"},"url":{"type":"string"}},"required":["title","start_date","is_all_day"],"type":"object"},"name":"create_event","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"attendees":{"items":{"additionalProperties":false,"properties":{"email":{"type":"string"},"is_current_user":{"type":"boolean"},"name":{"type":"string"}},"required":[],"type":"object"},"type":"array"},"calendar_id":{"type":"string"},"current_user_participant_status":{"enum":["unknown","pending","accepted","declined","tentative","delegated","completed","inProcess"],"type":"string"},"end_date":{"format":"date-time","type":"string"},"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"is_all_day":{"type":"boolean"},"is_canceled":{"type":"boolean"},"is_editable":{"type":"boolean"},"location":{"type":"string"},"notes":{"type":"string"},"recurrence_rfc2445":{"type":"string"},"start_date":{"format":"date-time","type":"string"},"title":{"type":"string"},"url":{"type":"string"}},"required":["id","start_date","end_date","is_all_day","is_canceled","is_editable","attendees","calendar_id"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":true,"idempotentHint":false,"openWorldHint":true,"readOnlyHint":false},"description":"Update an event occurrence by id. Omitted fields remain unchanged. Clear title, location, notes, or URL with an empty string, and attendees with an empty list. Returns the updated event; use its returned id for subsequent operations. Changes may notify attendees.","inputSchema":{"additionalProperties":false,"properties":{"attendees":{"description":"Attendees with email addresses. Names are optional and are not resolved to email addresses. On update, replaces the attendees.","items":{"additionalProperties":false,"properties":{"email":{"minLength":1,"type":"string"},"name":{"type":"string"}},"required":["email"],"type":"object"},"type":"array"},"calendar_id":{"minLength":1,"type":"string"},"end_date":{"description":"Event end as an ISO-8601 date-time. If omitted when start_date is provided, preserves the original duration.","format":"date-time","type":"string"},"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"is_all_day":{"type":"boolean"},"location":{"type":"string"},"notes":{"type":"string"},"recurrence_rfc2445":{"description":"RFC 2445 recurrence rule without an RRULE prefix, such as FREQ=WEEKLY;COUNT=3. Empty or invalid rules are ignored.","type":"string"},"span":{"default":"thisEvent","description":"For recurring events, thisEvent affects only the specified occurrence; futureEvents affects the specified occurrence and all following occurrences.","enum":["thisEvent","futureEvents"],"type":"string"},"start_date":{"description":"Event start as an ISO-8601 date-time with a timezone offset.","format":"date-time","type":"string"},"title":{"type":"string"},"url":{"type":"string"}},"required":["id"],"type":"object"},"name":"update_event","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"attendees":{"items":{"additionalProperties":false,"properties":{"email":{"type":"string"},"is_current_user":{"type":"boolean"},"name":{"type":"string"}},"required":[],"type":"object"},"type":"array"},"calendar_id":{"type":"string"},"current_user_participant_status":{"enum":["unknown","pending","accepted","declined","tentative","delegated","completed","inProcess"],"type":"string"},"end_date":{"format":"date-time","type":"string"},"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"is_all_day":{"type":"boolean"},"is_canceled":{"type":"boolean"},"is_editable":{"type":"boolean"},"location":{"type":"string"},"notes":{"type":"string"},"recurrence_rfc2445":{"type":"string"},"start_date":{"format":"date-time","type":"string"},"title":{"type":"string"},"url":{"type":"string"}},"required":["id","start_date","end_date","is_all_day","is_canceled","is_editable","attendees","calendar_id"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}},{"annotations":{"destructiveHint":true,"idempotentHint":false,"openWorldHint":true,"readOnlyHint":false},"description":"Delete an event occurrence by id. Deletion may notify attendees.","inputSchema":{"additionalProperties":false,"properties":{"id":{"additionalProperties":false,"description":"The complete id object from an event returned by list_events, get_event, create_event, or update_event. Use it unchanged.","properties":{"end_date":{"type":"number"},"identifier":{"minLength":1,"type":"string"},"start_date":{"type":"number"}},"required":["identifier","start_date","end_date"],"type":"object"},"span":{"default":"thisEvent","description":"For recurring events, thisEvent affects only the specified occurrence; futureEvents affects the specified occurrence and all following occurrences.","enum":["thisEvent","futureEvents"],"type":"string"}},"required":["id"],"type":"object"},"name":"delete_event","outputSchema":{"oneOf":[{"additionalProperties":false,"properties":{"deleted":{"type":"boolean"}},"required":["deleted"],"type":"object"},{"additionalProperties":false,"properties":{"message":{"type":"string"}},"required":["message"],"type":"object"}],"type":"object"}}],"computerHistory":[{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":false},"description":"Temporarily pause Computer History without disabling it.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"computer_history_pause"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":false},"description":"Resume a paused Computer History recorder.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"computer_history_resume"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Get Computer History status and paths to recent activity files.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"computer_history_status"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Get all Computer History settings. Call this immediately before updating settings so unchanged fields can be preserved.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"computer_history_get_settings"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":false},"description":"Replace all Computer History settings. Preserve every setting the user did not ask to change by first calling computer_history_get_settings.","inputSchema":{"additionalProperties":false,"properties":{"observation":{"additionalProperties":false,"properties":{"allowlist":{"items":{"additionalProperties":false,"properties":{"bundleID":{"description":"Required only for app rules.","type":"string"},"scope":{"enum":["app","url"],"type":"string"},"urlDomain":{"description":"Required only for URL rules. Use a domain without a scheme or path.","type":"string"}},"required":["scope"],"type":"object"},"type":"array"},"blocklist":{"items":{"additionalProperties":false,"properties":{"bundleID":{"description":"Required only for app rules.","type":"string"},"scope":{"enum":["app","url"],"type":"string"},"urlDomain":{"description":"Required only for URL rules. Use a domain without a scheme or path.","type":"string"}},"required":["scope"],"type":"object"},"type":"array"},"defaultApplicationBehavior":{"enum":["observe","do_not_observe"],"type":"string"},"defaultURLBehavior":{"enum":["observe","do_not_observe"],"type":"string"}},"required":["defaultApplicationBehavior","defaultURLBehavior","allowlist","blocklist"],"type":"object"}},"required":["observation"],"type":"object"},"name":"computer_history_update_settings"}],"eventStream":[{"annotations":{"destructiveHint":false,"idempotentHint":false,"openWorldHint":false,"readOnlyHint":false},"description":"Start recording the user's actions for up to 30 minutes. If a recording is already active, return that active session instead of starting another one.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"event_stream_start"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"description":"Get the current or most recent Record & Replay recording status including paths to metadata and events during the recording.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"event_stream_status"},{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":false},"description":"Stop the active event stream recording if one is running and return status including paths to metadata and events during the recording.","inputSchema":{"additionalProperties":false,"properties":{},"type":"object"},"name":"event_stream_stop"}]};
  let rawMode = (process.argv[2] || "all").toLowerCase();
  let tools = [];
  if (rawMode === "mcp" || rawMode === "computer-use") {
    tools = SCHEMAS.mcp;
  } else if (rawMode === "computer-history" || rawMode === "skysight") {
    tools = SCHEMAS.computerHistory;
  } else if (rawMode === "event-stream" || rawMode === "record-and-replay") {
    tools = SCHEMAS.eventStream;
  } else if (rawMode === "calendar") {
    tools = SCHEMAS.calendar;
  } else if (rawMode === "messages") {
    tools = SCHEMAS.messages;
  } else {
    tools = [
      ...SCHEMAS.mcp,
      ...SCHEMAS.computerHistory,
      ...SCHEMAS.eventStream,
      ...SCHEMAS.calendar,
      ...SCHEMAS.messages,
    ];
  }

  let sessionId = "agy-sky-" + crypto.randomUUID();
  let turnCounter = 0;

  globalThis.nodeRepl = {
    env: {
      ...process.env,
      TMPDIR: "/tmp",
      NODE_REPL_DISABLE_ANALYTICS: "1",
      BROWSER_USE_DISABLE_AMBIENT_NETWORK: "1",
      SKY_CUA_SERVICE_PATH: SKY_APP_PATH,
    },
    requestMeta: {
      "x-codex-turn-metadata": {
        session_id: sessionId,
        turn_id: "turn-1",
      },
    },
    nativePipe: {
      createConnection: (sockPath) =>
        new Promise((resolve, reject) => {
          let s = net.createConnection(sockPath);
          s.once("connect", () => resolve(s));
          s.once("error", reject);
        }),
    },
    launchServices: {
      openApplication: async ({ applicationPath, bundleIdentifier }) => {
        execFileSync("/usr/bin/open", [
          "-g",
          ...(applicationPath ? ["-a", applicationPath] : ["-b", bundleIdentifier]),
        ]);
      },
    },
    createElicitation: async () => ({
      action: "accept",
      content: { source: "computer-use-persisted-state" },
    }),
    setResponseMeta: () => {},
  };

  let { client: ipcClient } = await import(SKY_CLIENT_JS);
  let { create_client } = await import(SKY_CREATE_CLIENT_JS);
  let skyClient = create_client({});

  function normalizeArgs(args = {}) {
    let out = { ...args };
    if (typeof out.element_index === "string" && /^\d+$/.test(out.element_index.trim())) {
      out.element_index = Number(out.element_index.trim());
    }
    return out;
  }

  function formatToolResponse(data) {
    if (typeof data === "string") {
      return { content: [{ type: "text", text: data }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data && typeof data === "object" && !Array.isArray(data) ? data : { result: data },
    };
  }

  async function handleToolCall(name, rawArgs = {}) {
    turnCounter++;
    globalThis.nodeRepl.requestMeta["x-codex-turn-metadata"] = {
      session_id: sessionId,
      turn_id: `turn-${turnCounter}`,
    };
    let args = normalizeArgs(rawArgs);

    switch (name) {
      // Computer Use
      case "list_apps": {
        let apps = await skyClient.list_apps();
        return { content: [{ type: "text", text: JSON.stringify(apps, null, 2) }] };
      }
      case "get_app_state": {
        let state = await skyClient.get_app_state(args);
        let content = [{ type: "text", text: state.text || "" }];
        return { content };
      }
      case "click":
        await skyClient.click(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "perform_secondary_action":
        await skyClient.perform_secondary_action(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "set_value":
        await skyClient.set_value(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "select_text":
        await skyClient.select_text(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "scroll":
        await skyClient.scroll(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "drag":
        await skyClient.drag(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "press_key":
        await skyClient.press_key(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");
      case "type_text":
        await skyClient.type_text(args);
        return formatToolResponse("Action completed. Call `get_app_state` to fetch the updated UI state.");

      // Computer History (Skysight)
      case "computer_history_pause":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCSkysightPauseRequest", {}, { timeoutSeconds: 10 }));
      case "computer_history_resume":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCSkysightResumeRequest", {}, { timeoutSeconds: 10 }));
      case "computer_history_status":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCSkysightStatusRequest", {}, { timeoutSeconds: 10 }));
      case "computer_history_get_settings":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCSkysightGetSettingsRequest", {}, { timeoutSeconds: 10 }));
      case "computer_history_update_settings":
        return formatToolResponse(
          await ipcClient.request(
            "ComputerUseIPCSkysightUpdateSettingsRequest",
            { settings: { observation: args.observation ?? args } },
            { timeoutSeconds: 10 }
          )
        );

      // Record & Replay (EventStream)
      case "event_stream_start":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCEventStreamStartRequest", {}, { timeoutSeconds: 15 }));
      case "event_stream_status":
        return formatToolResponse(await ipcClient.request("ComputerUseIPCEventStreamStatusRequest", {}, { timeoutSeconds: 10 }));
      case "event_stream_stop":
        return formatToolResponse(
          await ipcClient.request("ComputerUseIPCEventStreamStopRequest", { reason: "userRequested" }, { timeoutSeconds: 10 })
        );

      // Calendar
      case "list_calendars":
      case "list_events":
      case "get_event":
      case "create_event":
      case "update_event":
      case "delete_event": {
        let reqMap = {
          list_calendars: ["ComputerUseIPCCalendarListCalendarsRequest", {}],
          list_events: [
            "ComputerUseIPCCalendarListEventsRequest",
            {
              startDate: args.start_date,
              endDate: args.end_date,
              calendarIDs: args.calendar_ids,
              limit: args.limit,
              cursor: args.cursor,
            },
          ],
          get_event: ["ComputerUseIPCCalendarGetEventRequest", { id: args.id }],
          create_event: [
            "ComputerUseIPCCalendarCreateEventRequest",
            {
              title: args.title,
              startDate: args.start_date,
              endDate: args.end_date,
              isAllDay: args.is_all_day,
              calendarID: args.calendar_id,
              location: args.location,
              notes: args.notes,
              url: args.url,
              recurrenceRFC2445: args.recurrence_rfc2445,
              attendees: args.attendees,
            },
          ],
          update_event: [
            "ComputerUseIPCCalendarUpdateEventRequest",
            {
              id: args.id,
              span: args.span,
              title: args.title,
              startDate: args.start_date,
              endDate: args.end_date,
              isAllDay: args.is_all_day,
              calendarID: args.calendar_id,
              location: args.location,
              notes: args.notes,
              url: args.url,
              recurrenceRFC2445: args.recurrence_rfc2445,
              attendees: args.attendees,
            },
          ],
          delete_event: ["ComputerUseIPCCalendarDeleteEventRequest", { id: args.id, span: args.span }],
        };
        let [reqType, reqPayload] = reqMap[name];
        try {
          let res = await ipcClient.request(reqType, reqPayload, { timeoutSeconds: 4 });
          return formatToolResponse(res);
        } catch (err) {
          return formatToolResponse({
            message: `Calendar request could not complete (${err.message}). Ensure Calendar access is granted to Codex Computer Use.app in System Settings > Privacy & Security > Calendars.`,
          });
        }
      }

      // Messages
      case "find_chats":
      case "read_messages":
      case "search_messages":
      case "send_message":
      case "count_message_activity":
      case "read_image": {
        let reqMap = {
          find_chats: [
            "ComputerUseIPCMessagesFindChatsRequest",
            {
              participants: args.participants,
              exactParticipants: args.exact_participants,
              name: args.name,
              from: args.from,
              to: args.to,
              unreadOnly: args.unread_only,
              limit: args.limit,
            },
          ],
          read_messages: [
            "ComputerUseIPCMessagesReadMessagesRequest",
            {
              chatGUID: args.chat_guid,
              from: args.from,
              to: args.to,
              unreadOnly: args.unread_only,
              limit: args.limit,
              cursor: args.cursor,
            },
          ],
          search_messages: [
            "ComputerUseIPCMessagesSearchMessagesRequest",
            {
              text: args.text,
              chatGUIDs: args.chat_guids,
              participants: args.participants,
              exactParticipants: args.exact_participants,
              from: args.from,
              to: args.to,
              limit: args.limit,
              cursor: args.cursor,
            },
          ],
          count_message_activity: [
            "ComputerUseIPCMessagesCountActivityRequest",
            {
              breakdown: args.breakdown,
              chatGUIDs: args.chat_guids,
              chatLimit: args.chat_limit,
              chatType: args.chat_type,
              cursor: args.cursor,
              from: args.from,
              to: args.to,
              interval: args.interval,
              rankBy: args.rank_by,
            },
          ],
          read_image: ["ComputerUseIPCMessagesReadAttachmentRequest", { id: args.id }],
          send_message: [
            "ComputerUseIPCMessagesPrepareSendRequest",
            {
              chatGUID: args.chat_guid,
              recipients: args.recipients,
              text: args.text,
              attachments: args.attachments,
            },
          ],
        };
        let [reqType, reqPayload] = reqMap[name];
        try {
          let res = await ipcClient.request(reqType, reqPayload, { timeoutSeconds: 4 });
          return formatToolResponse(res);
        } catch (err) {
          return formatToolResponse({
            message: `Messages request could not complete (${err.message}). Ensure Full Disk Access, Contacts, and Automation permissions are granted to Codex Computer Use.app.`,
          });
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  function write(msg) {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }

  let rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    let trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (msg.method === "server/discover") {
      write({
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: { code: -32601, message: "Method not found" },
      });
      return;
    }
    if (msg.method === "initialize") {
      write({
        jsonrpc: "2.0",
        id: msg.id ?? null,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "codex-sky", version: "1.0.0" },
        },
      });
      return;
    }
    if (msg.method === "ping") {
      write({ jsonrpc: "2.0", id: msg.id ?? null, result: {} });
      return;
    }
    if (msg.method === "tools/list") {
      write({
        jsonrpc: "2.0",
        id: msg.id ?? null,
        result: { tools },
      });
      return;
    }
    if (msg.method === "tools/call") {
      try {
        let result = await handleToolCall(msg.params?.name, msg.params?.arguments);
        write({ jsonrpc: "2.0", id: msg.id ?? null, result });
      } catch (err) {
        write({
          jsonrpc: "2.0",
          id: msg.id ?? null,
          result: {
            content: [{ type: "text", text: err?.message || String(err) }],
            isError: true,
          },
        });
      }
      return;
    }
    if (msg.id !== undefined) {
      write({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32601, message: "Method not found" },
      });
    }
  });
}
