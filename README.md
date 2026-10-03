# Discord Plugins

Custom plugins I wanted to use but didn't find for [Vencord](https://vencord.dev) and [Equicord](https://github.com/Equicord/Equicord), so I just created them.

## Plugins

### [BetterInbox](./BetterInbox)
Replaces Discord's default inbox with a fully custom notification panel featuring four tabs — All, Mentions, Reactions, and Activity — with per-tab unread badges and paged loading (scroll or "Load More" fetches the next batch). Captures replies, reactions, thread activity, pins, edits, and more. Includes configurable filters to ignore bots, muted servers, and role mentions, with persistent storage and per-entry read/delete controls.

### [FakeDeafen](./Fake-Def)
Adds a toggle button to your user area that lets you appear deafened in voice channels while still being able to hear. Patches WebSocket packets to spoof `self_deaf` and `self_mute` status before they're sent to Discord.

### [MultiForward](./multiforward)
Lets you select multiple messages and forward them all at once. Includes configurable per-message delays, cooldown bursts, and jitter to avoid rate limits.

### [PersistentVoiceMessages](./PersistentVoiceMessages)
Keeps voice messages playing when you switch channels or direct messages. Adds a responsive mini player to Discord's channel toolbar with live progress, play/pause, seeking, playback speed, source-chat navigation, and synchronized native waveform animation when you return.

### [PrivateStreaming](./PrivateStreaming)
Protects private Discord content while sharing, with two modes:

- **Window hiding:** excludes Discord and its popout windows from supported Windows captures while keeping your own view clear. Requires a desktop client on Windows 10 version 2004 or later, including Windows 11. The plugin checks whether Windows confirms capture protection and reports the result in its settings.
- **Content masking:** blurs selected content when window hiding is off or unavailable. Includes adjustable blur strength, a complete-hiding option, and a configurable reveal key and hover delay. Masking and anything you reveal are visible to both you and your viewers.

By default, protection activates only while you screen share in Discord. You can also activate it with Discord Streamer Mode, or choose **Always** for external recording and screenshots. Both window hiding and masking follow this setting.

Choose which content to mask: names, avatars, messages, photos, stickers, videos, files, reactions, server names and icons, channel names and topics, drafts, and tooltips. Separate area switches cover friends, DMs, members, profiles, activity, voice participants, link previews, search, and notifications. Your own account panel is excluded by default and can be included separately.

- **Window title** blurs the visible top-bar title and replaces the system window title while masking.
- **DM message previews** masks both the sender name and last-message text added by MessagePeek. Turning off the **DM list** area switch also keeps these previews clear.

| Default shortcut | Action |
| --- | --- |
| `Ctrl+Alt+P` | Toggle window hiding. Turning it off while active also pauses masking so Discord can appear normally in captures. |
| `Ctrl+Alt+B` | Pause or resume masking while blur mode is active. Leaves whole-window capture protection enabled. |
| Hold `Shift` and hover | Reveal the hovered item in blur mode after a short delay; releasing the key hides it again. |

Shortcuts work while Discord is focused. Both toggle shortcuts can be changed or disabled, and the reveal key is configurable. To share a blurred Discord window, turn off **Hide Discord windows** in the plugin settings and leave **Enable blur** enabled. Check the result with your capture tool, since window exclusion depends on its support for Windows capture protection.

## Installation

1. Copy the desired plugin folder into your Vencord/Equicord source checkout's `src/userplugins` directory. Copy the entire folder, including any native helper files.
2. Rebuild your client mod using its build instructions.
3. Fully restart Discord, enable the plugin in your client mod's plugin settings, and restart again if prompted.

For PrivateStreaming, open its settings to choose when protection activates and review the window-hiding status while active. A full Discord restart is required after installing or updating its native helper; a renderer reload alone does not load it.
