/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Match complete class tokens, never a hash or an incidental substring of another class.
const classes = (names: string[]) => names.flatMap(name => [
    `[class~="${name}"]`, `[class^="${name}_"]`, `[class*=" ${name}_"]`
]);
const group = (names: string[]) => `:is(${classes(names).join(",")})`;

export const blurOptions = {
    blurNames: { label: "People's names", description: "Usernames, display names, nicknames, and recipients." },
    blurAvatars: { label: "People's avatars", description: "User pictures and avatar stacks." },
    blurMessages: { label: "Message text", description: "Messages, replies, link preview text, biographies, and activity details." },
    blurPhotos: { label: "Photos and stickers", description: "Chat images, GIF images, stickers, and opened image attachments." },
    blurVideos: { label: "Videos", description: "Chat videos, animated video previews, and opened video attachments." },
    blurFiles: { label: "Files", description: "File names and download cards." },
    blurReactions: { label: "Reactions", description: "Reaction emoji and counts below messages." },
    blurServerNames: { label: "Server names", description: "Server and server folder names." },
    blurServerIcons: { label: "Server icons", description: "Server icons, monograms, and folder previews." },
    blurChannels: { label: "Channel names and topics", description: "Channel titles, topics, thread names, and voice player origins." },
    blurFriends: { label: "Friends list", description: "Apply the selected blur types in the Friends list. Turn off to keep this area clear." },
    blurDMs: { label: "DM list", description: "Apply the selected blur types in the direct message sidebar. Turn off to keep this area clear." },
    blurDMPreviews: { label: "DM message previews", description: "Blur the sender name and last-message text together in MessagePeek previews." },
    blurMembers: { label: "Member list", description: "Apply the selected blur types in server member lists. Turn off to keep this area clear." },
    blurProfiles: { label: "Profiles", description: "Apply the selected blur types in user profiles and profile popouts." },
    blurActivity: { label: "Active Now", description: "Apply the selected blur types in the Home activity panel." },
    blurVoice: { label: "Voice participants", description: "Apply the selected blur types to voice participant names and avatars." },
    blurEmbeds: { label: "Link previews", description: "Apply the selected text and media blur types inside link previews." },
    blurSearch: { label: "Search and suggestions", description: "Apply the selected blur types in search results and autocomplete suggestions." },
    blurNotifications: { label: "Notifications", description: "Apply the selected blur types in notification previews." },
    blurComposer: { label: "Unsent messages", description: "Blur the message editor and draft text." },
    blurTooltips: { label: "Tooltips", description: "Blur tooltips and suppress native hover titles while masking." },
    hideWindowTitle: { label: "Window title", description: "Blur the visible top-bar title and replace the system window title while masking." }
};

export type BlurOptions = Partial<Record<keyof typeof blurOptions, boolean>> & { blurOwnAccount?: boolean; };

const activity = group(["nowPlayingColumn", "nowPlayingSidebar"]);
const profiles = group(["userProfileOuter", "userProfileInner", "userPopoutOuter", "userPanelOuter", "profilePanel", "biteSizeOuter", "fullSizeOuter"]);
const messages = `:is([id^="chat-messages-"],[data-list-item-id^="chat-messages"],${classes(["message", "searchResult"]).join(",")},.vc-betterinbox-entry)`;
const viewer = group(["mediaViewer", "imageModal", "modalCarouselWrapper", "carouselModal"]);
const media = `:is(${messages},${viewer},${profiles})`;
const avatar = 'img[src*="/avatars/"],img[src*="/guilds/"][src*="/users/"],img[src*="/embed/avatars/"]';
const identityImage = `:is(${avatar},img[src*="/icons/"],${classes(["avatar", "avatarWrapper", "emoji"]).join(",")})`;
const windowTitle = '[data-window-chrome="true"] > div:nth-child(2):nth-last-child(2)';
const regions: [keyof BlurOptions, string][] = [
    ["blurFriends", group(["peopleColumn", "peopleList", "peopleListItem"])],
    ["blurDMs", `:is([data-list-item-id^="private-channels-"],a[href^="/channels/@me/"],${classes(["privateChannels"]).join(",")})`],
    ["blurDMPreviews", ".vc-message-peek-preview"],
    ["hideWindowTitle", windowTitle],
    ["blurMembers", `:is([data-list-item-id^="members-"],${classes(["membersWrap", "member", "membersGroup"]).join(",")})`],
    ["blurProfiles", profiles],
    ["blurActivity", activity],
    ["blurVoice", group(["voiceUser", "voiceUserSummary", "voiceCallAvatar"])],
    ["blurEmbeds", group(["embed"])],
    ["blurSearch", group(["searchResult", "searchResultsWrap", "autocompleteRow"])],
    ["blurNotifications", group(["notification", "notificationContent", "toast"])]
];

export const REVEAL_ATTRIBUTE = "data-vc-private-streaming-reveal";
export const HOVER_CONTROLS = ['[role="toolbar"]', ...classes([
    "buttons", "buttonsInner", "buttonContainer", "messageButtons", "hoverBar", "typingDots"
])].join(",");

export function makeTargetSelector(options: BlurOptions, accountPanelSelector = "") {
    const targets: string[] = [];
    const add = (key: keyof BlurOptions, selectors: string[]) => {
        if (options[key] !== false) targets.push(...selectors);
    };
    const wholeItems: (keyof BlurOptions)[] = [
        "blurNames", "blurAvatars", "blurMessages", "blurPhotos", "blurVideos", "blurFiles", "blurReactions",
        "blurServerNames", "blurServerIcons", "blurChannels", "blurComposer", "blurTooltips",
        "blurEmbeds", "blurProfiles", "blurFriends", "blurMembers", "blurDMs", "blurDMPreviews", "blurVoice", "blurSearch", "blurNotifications", "blurActivity"
    ];
    if (wholeItems.every(key => options[key] !== false)) targets.push(
        messages, profiles,
        ...classes(["member", "peopleListItem", "voiceUser", "voiceUserSummary", "searchResult", "autocompleteRow", "notification", "notificationContent", "toast"])
    );
    add("blurNames", [
        ...classes(["username", "displayName", "nickname", "nameTag", "userTag", "recipient", "recipientName", "participantName"]),
        `${activity} ${group(["headerTitle", "headerText", "headerFull", "headerName", "partyMember"])}`,
        `${group(["peopleListItem", "member", "voiceUser", "userInfo", "userInfoSection"])} ${group(["name", "nameText"])}`,
        `${group(["peopleListItem", "member", "voiceUser"])}:not(:has(*))`,
        'a[href^="/channels/@me/"]:not(:has(*))',
        `[data-list-item-id^="private-channels-"] ${group(["name", "nameText"])}`,
        ".vc-betterinbox-plain-name"
    ]);
    add("blurAvatars", [
        avatar, 'svg:has(image[href*="/avatars/"])',
        ...classes(["avatar", "avatarWrapper", "avatarStack", "voiceCallAvatar"]),
        ".vc-betterinbox-plain-avatar"
    ]);
    add("blurMessages", [
        '[id^="message-content-"]',
        ...classes(["messageContent", "repliedTextContent", "embedTitle", "embedDescription", "embedFieldName", "embedFieldValue", "embedFooterText",
            "markup", "userBio", "customStatusText", "activityDetails", "activityState", "typing"]),
        `${group(["repliedMessage", "embed", "searchResult", "autocompleteRow", "notification", "notificationContent", "toast"])}:not(:has(*))`,
        `${group(["notificationContent", "searchResult", "autocompleteRow"])} ${group(["content", "description", "text", "searchAnswer", "searchFilter"])}`,
        `${profiles} :is(p,${classes(["aboutMe", "pronouns", "statusText"]).join(",")})`,
        `${activity} ${group(["activityDetails", "sectionTitle", "voiceSectionDetails", "textContent"])}`,
        ".vc-betterinbox-plain-text",
        ".vc-betterinbox-entry:not(:has(*))", ".vc-betterinbox-plain:not(:has(*))"
    ]);
    add("blurPhotos", [
        `${media} img:not(${identityImage}):not(${group(["avatarWrapper", "avatarStack"])} img)`,
        `${media} ${group(["imageWrapper", "stickerAsset"])}:not(:has(video)):not(:has(${identityImage}))`,
        `${media} canvas`
    ]);
    add("blurVideos", [
        `${media} video`,
        `${media} ${group(["video", "videoWrapper", "videoContainer"])}`
    ]);
    add("blurFiles", [...classes(["file", "fileName", "fileWrapper"]), `${group(["attachment"])}:not(:has(img,video))`]);
    add("blurReactions", classes(["reaction"]));
    add("blurServerNames", [
        ...classes(["guildName", "folderName"]),
        `nav header ${group(["name", "headerText"])}`,
        `${group(["headerContent"])} ${group(["name"])}`,
        `${activity} ${group(["activityName"])}`
    ]);
    add("blurServerIcons", [
        ...Array.from({ length: 10 }, (_, digit) => `[data-list-item-id^="guildsnav___${digit}"]`),
        'img[src*="cdn.discordapp.com/icons/"]', 'img[src*="media.discordapp.net/icons/"]',
        'svg:has(image[href*="cdn.discordapp.com/icons/"])',
        ...classes(["guildIcon", "folderPreview", "folderIcon", "expandedFolderIconWrapper"])
    ]);
    add("blurChannels", [
        ...classes(["channelName", "threadName", "topic"]),
        'a[href^="/channels/"]:not([href^="/channels/@me"]):not(:has(*))',
        `[data-list-item-id^="channels___"] ${group(["name", "linkTop"])}`,
        `${group(["chat", "chatContent", "subtitleContainer"])} ${group(["titleWrapper", "titleText"])}`,
        `${activity} ${group(["channelInfo"])}`, ".vc-pvm-origin"
    ]);
    add("blurComposer", ['[data-slate-editor="true"]', ...classes(["channelTextArea"])]);
    add("blurTooltips", ['[role="tooltip"]']);
    add("blurDMPreviews", [".vc-message-peek-preview > span:not(.vc-message-peek-icon)"]);
    add("hideWindowTitle", [windowTitle]);

    const clear = [
        ...classes(["pictureInPicture", "pictureInPictureWindow"]),
        ...regions.filter(([key]) => options[key] === false).map(([, selector]) => selector)
    ];
    if (!options.blurOwnAccount) clear.push(
        ...classes(["accountPopoutButtonWrapper", "accountPopoutButton"]),
        ...(accountPanelSelector ? [accountPanelSelector] : [])
    );
    if (!targets.length) return ":not(*)";
    const excluded = clear.join(",");
    // Use the same exclusions for CSS and pointer hit testing; never reset native filters.
    return `:is(${targets.join(",")}):not(:is(${excluded})):not(:is(${excluded}) *)`;
}

export function makeStyle(blur: number, opaque: boolean, target: string) {
    const radius = Number.isFinite(blur) ? Math.min(32, Math.max(12, blur)) : 16;
    return `
body ${target}:not(${target} ${target}):not([${REVEAL_ATTRIBUTE}]:hover) {
    filter: ${opaque ? "opacity(0)" : `blur(${radius}px)`} !important;
    transition: none !important;
    user-select: none !important;
    -webkit-user-drag: none !important;
}
`;
}
