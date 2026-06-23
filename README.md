# Discord Plugins

Custom plugins I wanted to use but didn't find for [Vencord](https://vencord.dev) and [Equicord](https://github.com/Equicord/Equicord), so I just created them.

## Plugins

### [BetterInbox](./BetterInbox)
Replaces Discord's default inbox with a fully custom notification panel featuring four tabs — All, Mentions, Reactions, and Activity. Captures replies, reactions, thread activity, pins, edits, and more. Includes configurable filters to ignore bots, muted servers, and role mentions, with persistent storage and per-entry read/delete controls.

### [FakeDeafen](./Fake-Def)
Adds a toggle button to your user area that lets you appear deafened in voice channels while still being able to hear. Patches WebSocket packets to spoof `self_deaf` and `self_mute` status before they're sent to Discord.

### [MultiForward](./multiforward)
Lets you select multiple messages and forward them all at once. Includes configurable per-message delays, cooldown bursts, and jitter to avoid rate limits.

## Installation
Copy the plugin folder into your Vencord/Equicord `src/userplugins` directory and rebuild.
