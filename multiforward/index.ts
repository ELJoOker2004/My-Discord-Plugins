/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { MessageStore, showToast, Toasts, useState } from "@webpack/common";

interface ForwardSelection {
    channelId: string;
    ids: string[];
}

interface ForwardOptions {
    onlyAttachmentIds?: string[];
    onlyEmbedIndices?: number[];
    withMessage?: string;
    [key: string]: unknown;
}

interface ForwardActions {
    sendForwards(message: Message, destinations: string[], options?: ForwardOptions): Promise<PromiseSettledResult<unknown>[]>;
}

const logger = new Logger("MultiForward");
const settings = definePluginSettings({
    baseDelay: {
        type: OptionType.NUMBER,
        description: "The delay between forwarding each message in milliseconds.",
        default: 2500
    },
    randomizeDelay: {
        type: OptionType.NUMBER,
        description: "Adds or subtracts a random delay up to this many milliseconds.",
        default: 500
    },
    cooldownCount: {
        type: OptionType.NUMBER,
        description: "Pause after this many messages. Set to 0 to disable.",
        default: 5
    },
    cooldownDelay: {
        type: OptionType.NUMBER,
        description: "The additional cooldown delay in milliseconds.",
        default: 5000
    }
});

let selectedRange: ForwardSelection | null = null;
let preserveSelection = false;
let lifecycle: AbortController | undefined;

function readSelection(): ForwardSelection | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const messages = Array.from(document.querySelectorAll('[id^="chat-messages-"]'))
        .filter(element => range.intersectsNode(element))
        .map(element => element.id.match(/^chat-messages-(\d+)-(\d+)$/))
        .filter((match): match is RegExpMatchArray => match !== null);
    const channelId = messages[0]?.[1];
    if (!channelId || messages.some(match => match[1] !== channelId)) return null;
    const ids = [...new Set(messages.map(match => match[2]))]
        .sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
    return ids.length > 1 ? { channelId, ids } : null;
}

function selectionChanged() {
    const selection = readSelection();
    if (selection || !preserveSelection) selectedRange = selection;
}

function pointerDown(event: PointerEvent) {
    const { target } = event;
    preserveSelection = event.button === 2 || target instanceof Element && !!target.closest('button, [role="button"], [role="menu"], [role="menuitem"], [role="dialog"]');
    selectedRange = preserveSelection ? readSelection() ?? selectedRange : null;
}

function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        selectedRange = null;
        preserveSelection = false;
    } else if (event.key === "Tab") {
        preserveSelection = true;
    }
}

function wait(ms: number, signal: AbortSignal) {
    signal.throwIfAborted();
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        function abort() {
            clearTimeout(timer);
            reject(signal.reason);
        }
        signal.addEventListener("abort", abort, { once: true });
    });
}

export default definePlugin({
    name: "MultiForward",
    description: "Highlight multiple messages, then use Forward on a message in the selection to forward them in order.",
    authors: [EquicordDevs.ELJoOker],
    settings,
    patches: [{
        find: "customValidateDestination:",
        group: true,
        replacement: [
            {
                match: /(?<=function \i\((\i)\)\{)(?=let\{[^}]{0,350}customValidateDestination:)/,
                replace: "const multiForward=$self.useSelection($1);"
            },
            {
                match: /(\i)\.sendForwards\(/,
                replace: "$self.forwardMessages($1,multiForward,"
            },
            {
                match: /(?<=[{,]title:)(\i)(?=\?\?)/,
                replace: "$self.getTitle($1,multiForward)"
            }
        ]
    }],

    useSelection({ message, customSendHandler }: { message?: Message; customSendHandler?: unknown; }) {
        const [selection] = useState(() => {
            const range = readSelection() ?? selectedRange;
            return !customSendHandler && message && range?.channelId === message.channel_id && range.ids.includes(message.id)
                ? range : null;
        });
        return selection;
    },

    getTitle(title: string | undefined, selection: ForwardSelection | null) {
        return title ?? (selection ? `Forward ${selection.ids.length} messages` : undefined);
    },

    async forwardMessages(actions: ForwardActions, selection: ForwardSelection | null, message: Message, destinations: string[], options?: ForwardOptions) {
        const signal = lifecycle?.signal;
        if (!selection || !signal || signal.aborted) return actions.sendForwards(message, destinations, options);
        selectedRange = null;
        const { ids, channelId } = selection;
        const { baseDelay, randomizeDelay, cooldownCount, cooldownDelay } = settings.store;
        let sent = 0;
        showToast(`Forwarding ${ids.length} selected messages...`, Toasts.Type.MESSAGE);
        const results = await Promise.allSettled(destinations.map(async destination => {
            let value: unknown;
            for (let index = 0; index < ids.length; index++) {
                signal.throwIfAborted();
                const id = ids[index];
                const selected = MessageStore.getMessage(channelId, id) ?? (id === message.id ? message : undefined);
                if (!selected) throw new Error("A selected message is no longer available.");
                const nextOptions = { ...options };
                if (id !== message.id) {
                    delete nextOptions.onlyAttachmentIds;
                    delete nextOptions.onlyEmbedIndices;
                }
                if (index < ids.length - 1) delete nextOptions.withMessage;
                const [result] = await actions.sendForwards(selected, [destination], nextOptions);
                if (result.status === "rejected") throw result.reason;
                value = result.value;
                sent++;
                if (index < ids.length - 1) {
                    const jitter = Math.max(0, Number(randomizeDelay) || 0);
                    const offset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
                    const cooldown = cooldownCount > 0 && (index + 1) % cooldownCount === 0 ? Math.max(0, Number(cooldownDelay) || 0) : 0;
                    await wait(Math.max(0, (Number(baseDelay) || 0) + offset) + cooldown, signal);
                }
            }
            return value;
        }));
        if (!signal.aborted) {
            if (results.every(result => result.status === "fulfilled")) {
                showToast(`Forwarded ${sent} messages.`, Toasts.Type.SUCCESS);
            } else {
                const status = `Forwarded ${sent} of ${ids.length * destinations.length} messages. Forwarding stopped for failed destinations.`;
                logger.error(status);
                showToast(status, Toasts.Type.FAILURE);
            }
        }
        return results;
    },

    start() {
        lifecycle = new AbortController();
        selectedRange = null;
        preserveSelection = false;
        document.addEventListener("selectionchange", selectionChanged);
        document.addEventListener("pointerdown", pointerDown, true);
        document.addEventListener("keydown", keyDown, true);
    },

    flux: {
        CHANNEL_SELECT() {
            selectedRange = null;
            preserveSelection = false;
        }
    },

    stop() {
        lifecycle?.abort();
        document.removeEventListener("selectionchange", selectionChanged);
        document.removeEventListener("pointerdown", pointerDown, true);
        document.removeEventListener("keydown", keyDown, true);
        selectedRange = null;
        preserveSelection = false;
        lifecycle = undefined;
    }
});
