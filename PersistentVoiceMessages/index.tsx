/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";

import { startPlaybackService, stopPlaybackService, usePersistentPlayback } from "./playback";
import { PersistentVoicePlayer, VoiceMessageIcon } from "./player";

const WrappedPersistentVoicePlayer = ErrorBoundary.wrap(PersistentVoicePlayer, { noop: true });

export default definePlugin({
    name: "PersistentVoiceMessages",
    description: "Keeps voice messages playing across chats with a synchronized mini player.",
    authors: [{ name: "ELJoOker", id: 605894319408283678n }],
    tags: ["Voice", "Media", "Chat"],
    dependencies: ["AudioPlayerAPI", "HeaderBarAPI"],

    patches: [{
        find: "#{intl::PAUSE_VOICE_MESSAGE_A11Y_LABEL}",
        replacement: {
            match: /(\{src:(\i).{0,200}?playbackCacheKey:(\i)\}=\i,(\i)=\i\.useRef\(null\).{0,300}?\[\i,(\i)\]=\i\.useState\(\i\),.{0,120}?)(\[\i,\i\]=)(\i\.useState\(!1\))(?=,\[\i,\i\]=\i\.useState\(!1\),\[\i,\i\]=\i\.useState\(!1\),\[\i,\i\]=\i\.useState\("none"\))/,
            replace: "$1$6$self.usePersistentPlayback($7,$4,$2,$3,$5)"
        }
    }],

    headerBarButton: {
        icon: VoiceMessageIcon,
        location: "channeltoolbar",
        priority: 30,
        render: () => <WrappedPersistentVoicePlayer />
    },

    usePersistentPlayback,
    start: startPlaybackService,
    stop: stopPlaybackService
});
