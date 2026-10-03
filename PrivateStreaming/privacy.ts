/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type BlurOptions, HOVER_CONTROLS, makeStyle, makeTargetSelector, REVEAL_ATTRIBUTE } from "./targets";

export interface PrivacyOptions extends BlurOptions {
    revealKey: string;
    blur: number;
    opaque: boolean;
    revealDelay: number;
    accountPanelSelector?: string;
}

const PRIVATE_TITLE = "Discord | Private Streaming";
const EDITABLE = 'input,textarea,[contenteditable="true"],[role="textbox"]';

export function createPrivacy(options: PrivacyOptions) {
    let active = false;
    let stopped = false;
    let point: { x: number; y: number; } | undefined;
    let revealed: Element | null = null;
    let pending: Element | null = null;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let originalTitle = document.title;
    let targetSelector: string;
    const held = new Set<string>();
    const titles = new Map<Element, string>();
    const events = new AbortController();
    const style = document.createElement("style");
    const previousStyle = document.createElement("span").style;
    style.id = "vc-private-streaming-style";
    // Discord rewrites html.className when focus/theme changes. Gate the stylesheet we own.
    style.media = "not all";
    document.head.append(style);

    function clearReveal() {
        clearTimeout(revealTimer);
        revealTimer = undefined;
        pending = null;
        revealed?.removeAttribute(REVEAL_ATTRIBUTE);
        revealed = null;
    }

    function disarm() {
        held.clear();
        clearReveal();
    }

    function loseFocus() {
        point = undefined;
        disarm();
    }

    function getTarget() {
        if (!point || !document.hasFocus() || document.hidden) return null;
        const hit = document.elementFromPoint(point.x, point.y);
        if (!hit || !document.body.contains(hit)) return null;
        if (document.activeElement?.closest(EDITABLE) && hit.closest(EDITABLE)) return null;
        let target = hit.closest(targetSelector);
        // A parent's filter cannot be undone on a child. Reveal only that outermost item.
        for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
            if (parent.matches(targetSelector)) target = parent;
        }
        return target;
    }

    function updateReveal() {
        if (!active || !held.size) return clearReveal();
        const target = getTarget();
        if (target === revealed || target === pending) return;
        clearReveal();
        if (!target) return;
        pending = target;
        revealTimer = setTimeout(() => {
            revealTimer = undefined;
            pending = null;
            if (!active || !held.size || getTarget() !== target) return;
            revealed = target;
            target.setAttribute(REVEAL_ATTRIBUTE, "");
        }, Math.max(0, Math.min(1000, options.revealDelay)));
    }

    function matchesKey(event: KeyboardEvent) {
        return options.revealKey === "Shift"
            ? event.code === "ShiftLeft" || event.code === "ShiftRight"
            : event.code === options.revealKey;
    }

    function onlyRevealModifier(event: KeyboardEvent | PointerEvent) {
        if (event.metaKey) return false;
        if (options.revealKey.startsWith("Shift")) return event.shiftKey && !event.ctrlKey && !event.altKey;
        if (options.revealKey.startsWith("Control")) return event.ctrlKey && !event.shiftKey && !event.altKey;
        return event.altKey && !event.shiftKey && !event.ctrlKey;
    }

    function keyDown(event: KeyboardEvent) {
        if (!active) return;
        if (event.key === "Escape" || event.isComposing || event.getModifierState("AltGraph")) return disarm();
        // Screenshot and window-switching chords revoke a peek, including Win+Shift+S.
        if (!matchesKey(event) || !onlyRevealModifier(event)) return disarm();
        // Repeat keydowns cannot re-arm a peek after a focus change or shortcut.
        if (event.repeat) return;
        held.add(event.code);
        // A capital letter must not expose a parked pointer. An explicit mouse move can peek outside the editor.
        if (document.activeElement?.closest(EDITABLE)) return clearReveal();
        updateReveal();
    }

    function keyUp(event: KeyboardEvent) {
        held.delete(event.code);
        if (!held.size) clearReveal();
    }

    function pointerMove(event: PointerEvent) {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return loseFocus();
        point = { x: event.clientX, y: event.clientY };
        if (!onlyRevealModifier(event)) disarm();
        if (event.buttons) return clearReveal();
        updateReveal();
    }

    function focusIn() {
        if (document.activeElement?.closest(EDITABLE)) disarm();
    }

    function pointerOut(event: PointerEvent) {
        if (!event.relatedTarget) loseFocus();
    }

    function scroll(event: Event) {
        const candidate = revealed ?? pending;
        if (!candidate) return;
        if (event.target instanceof Element && !event.target.contains(candidate)) return;
        clearReveal();
    }

    function hoverControl(node: Node) {
        const element = node instanceof Element ? node : node.parentElement;
        return Boolean(element?.closest(HOVER_CONTROLS));
    }

    function changesContent(record: MutationRecord, candidate: Element) {
        if (Array.from(record.removedNodes).some(node => node.contains(candidate))) return true;
        if (!candidate.contains(record.target) || hoverControl(record.target)) return false;
        if (record.type === "attributes") {
            if (record.attributeName === "title" || record.attributeName === "class") return false;
            if (record.attributeName !== "style") return true;
            if (!(record.target instanceof HTMLElement || record.target instanceof SVGElement)) return false;
            previousStyle.cssText = record.oldValue ?? "";
            const currentStyle = record.target.style;
            return ["background-image", "content", "list-style-image", "border-image-source", "mask-image"].some(
                property => previousStyle.getPropertyValue(property) !== currentStyle.getPropertyValue(property)
            );
        }
        if (record.type === "childList") {
            return [...record.addedNodes, ...record.removedNodes].some(node => !hoverControl(node));
        }
        return true;
    }

    function hideTitle(element: Element) {
        if (options.blurTooltips === false) return;
        const title = element.getAttribute("title");
        if (!title) return;
        titles.set(element, title);
        element.setAttribute("title", "");
    }

    function hideTitles(root: Element) {
        if (root.matches("[title]")) hideTitle(root);
        root.querySelectorAll("[title]").forEach(hideTitle);
    }

    function removeStaleReveals(root: Element) {
        if (root !== revealed) root.removeAttribute(REVEAL_ATTRIBUTE);
        root.querySelectorAll(`[${REVEAL_ATTRIBUTE}]`).forEach(element => {
            if (element !== revealed) element.removeAttribute(REVEAL_ATTRIBUTE);
        });
    }

    function hideDocumentTitle() {
        if (options.hideWindowTitle === false) return;
        if (document.title === PRIVATE_TITLE) return;
        originalTitle = document.title;
        document.title = PRIVATE_TITLE;
    }

    function restoreTitles() {
        for (const [element, title] of titles) {
            if (element.getAttribute("title") === "") element.setAttribute("title", title);
        }
        titles.clear();
        if (document.title === PRIVATE_TITLE) document.title = originalTitle;
    }

    function onMutations(records: MutationRecord[]) {
        const candidate = revealed ?? pending;
        if (candidate && records.some(record => changesContent(record, candidate))) clearReveal();
        for (const record of records) {
            if (record.type === "attributes" && record.attributeName === "title"
                && record.target instanceof Element && document.body.contains(record.target)) {
                hideTitle(record.target);
            }
            for (const node of record.addedNodes) {
                if (node instanceof Element && document.body.contains(node)) {
                    removeStaleReveals(node);
                    hideTitles(node);
                }
            }
        }
        for (const [element, title] of titles) {
            if (element.isConnected) continue;
            if (element.getAttribute("title") === "") element.setAttribute("title", title);
            titles.delete(element);
        }
        hideDocumentTitle();
        // New overlays, recycled list rows, and layout changes must never inherit a reveal.
        if ((revealed || pending) && getTarget() !== (revealed ?? pending)) clearReveal();
    }

    const observer = new MutationObserver(onMutations);
    const listenerOptions = { capture: true, signal: events.signal };
    window.addEventListener("keydown", keyDown, listenerOptions);
    window.addEventListener("keyup", keyUp, listenerOptions);
    window.addEventListener("blur", loseFocus, listenerOptions);
    window.addEventListener("pagehide", loseFocus, listenerOptions);
    window.addEventListener("resize", clearReveal, listenerOptions);
    document.addEventListener("visibilitychange", loseFocus, listenerOptions);
    document.addEventListener("pointermove", pointerMove, listenerOptions);
    document.addEventListener("pointerout", pointerOut, listenerOptions);
    document.addEventListener("pointerleave", loseFocus, { signal: events.signal });
    document.addEventListener("pointercancel", loseFocus, listenerOptions);
    document.addEventListener("scroll", scroll, listenerOptions);
    document.addEventListener("wheel", clearReveal, { ...listenerOptions, passive: true });
    document.addEventListener("focusin", focusIn, listenerOptions);
    document.addEventListener("compositionstart", disarm, listenerOptions);
    document.addEventListener("dragstart", disarm, listenerOptions);
    document.addEventListener("contextmenu", disarm, listenerOptions);

    function configure(next: PrivacyOptions) {
        const wasActive = active;
        if (wasActive) setActive(false);
        disarm();
        options = next;
        targetSelector = makeTargetSelector(options, options.accountPanelSelector);
        style.textContent = makeStyle(options.blur, options.opaque, targetSelector);
        if (wasActive) setActive(true);
    }

    function setActive(next: boolean) {
        if (stopped || active === next) return;
        disarm();
        active = next;
        removeStaleReveals(document.documentElement);
        style.media = active ? "all" : "not all";
        if (active) {
            hideDocumentTitle();
            hideTitles(document.body);
            observer.observe(document.documentElement, {
                subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true,
                attributeFilter: ["title", "class", "id", "src", "srcset", "poster", "style", "href", "data-list-item-id", "data-user-id", "data-channel-id", "data-guild-id"]
            });
        } else {
            observer.disconnect();
            restoreTitles();
        }
    }

    configure(options);
    return {
        configure,
        setActive,
        stop() {
            if (stopped) return;
            setActive(false);
            stopped = true;
            events.abort();
            observer.disconnect();
            disarm();
            style.remove();
        }
    };
}
