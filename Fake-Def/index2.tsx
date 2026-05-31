import "./style.css";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { UserAreaButton } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

import style from "./style.css?managed";

const settings = definePluginSettings({
    oldIcon: {
        type: OptionType.BOOLEAN,
        description: "Use the old icon style before Discord icon redesign",
        default: false
    },
    iconState: {
        type: OptionType.BOOLEAN,
        description: "Control the icon state",
        default: false,
        hidden: true
    }
});

function Icon({ className }: { className?: string; }) {
    const { oldIcon, iconState } = settings.use(["oldIcon", "iconState"]);
    const enabled = iconState;

    const redLinePath = !oldIcon
        ? "M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z"
        : "M23 2.27 21.73 1 1 21.73 2.27 23 23 2.27Z";

    const maskBlackPath = !oldIcon
        ? "M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z"
        : "M23.27 4.54 19.46.73 .73 19.46 4.54 23.27 23.27 4.54Z";

    return (
        <div className="icon-container">
            <svg className={className} width="20" height="20" viewBox="0 0 24 24">
                <path
                    fill={!enabled && !oldIcon ? "var(--status-danger)" : "currentColor"}
                    mask={!enabled ? "url(#fakeDeafenMask)" : undefined}
                    d="M6 10H6.75C7.44036 10 8 10.5596 8 11.25V14.75C8 15.4404 7.44036 16 6.75 16H6C4.34315 16 3 14.6569 3 13C3 11.3431 4.34315 10 6 10ZM6 10V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9V10M18 10H17.25C16.5596 10 16 10.5596 16 11.25V14.75C16 15.4404 16.5596 16 17.25 16H18M18 10C19.6569 10 21 11.3431 21 13C21 14.6569 19.6569 16 18 16M18 16L17.3787 18.4851C17.1561 19.3754 16.3562 20 15.4384 20H13"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                {!enabled && (
                    <>
                        <path fill="var(--status-danger)" d={redLinePath} />
                        <mask id="fakeDeafenMask">
                            <rect fill="white" x="0" y="0" width="24" height="24" />
                            <path fill="black" d={maskBlackPath} />
                        </mask>
                    </>
                )}
            </svg>
        </div>
    );
}

// --- LOGIC ---
let originalSend: any;
const getVoiceUtils = () => Vencord.Webpack.findByProps('toggleSelfDeaf');
const getVoiceState = () => Vencord.Webpack.findByProps('isSelfDeaf');

function patchWebSocket() {
    if (!originalSend) {
        originalSend = WebSocket.prototype.send;
    }

    WebSocket.prototype.send = function (data) {
        // CASE 1: Binary Data
        if (data instanceof ArrayBuffer) {
            const decoded = textDecoder.decode(data);
            if (decoded.includes("self_deaf")) {
                console.log("[Fake Deafen] Intercepted BINARY packet. Spoofing...");
                // Flexible regex that handles spaces: "self_mute" : true
                let modified = decoded
                    .replace(/"self_mute"\s*:\s*true/g, '"self_mute":false')
                    .replace(/"self_deaf"\s*:\s*true/g, '"self_deaf":false');
                data = textEncoder.encode(modified).buffer;
            }
        } 
        // CASE 2: Text Data (JSON String)
        else if (typeof data === "string") {
            if (data.includes("self_deaf")) {
                console.log("[Fake Deafen] Intercepted TEXT packet. Spoofing...");
                // Flexible regex that handles spaces
                data = data
                    .replace(/"self_mute"\s*:\s*true/g, '"self_mute":false')
                    .replace(/"self_deaf"\s*:\s*true/g, '"self_deaf":false');
            }
        }
        
        return originalSend.apply(this, [data]);
    };
    console.log("[Fake Deafen] Patches applied.");
}

function unpatchWebSocket() {
    if (originalSend && WebSocket.prototype.send !== originalSend) {
        WebSocket.prototype.send = originalSend;
        console.log("[Fake Deafen] Patches removed.");
    }
}

function GameActivityToggleButton({ iconForeground }: { iconForeground?: string }) {
    const { iconState } = settings.use(["iconState"]);

    return (
        <UserAreaButton
            label="Fake Deafen"
            tooltipText={iconState ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={<Icon className={iconForeground} />}
            role="switch"
            aria-checked={iconState}
            redGlow={!iconState}
            onClick={() => {
                if (iconState) {
                    unpatchWebSocket();
                } else {
                    const channelId = Vencord.Webpack.findByProps('getVoiceChannelId').getVoiceChannelId();
                    if (!channelId) {
                        console.warn("[Fake Deafen] Not in voice channel.");
                        return;
                    }

                    // 1. Ensure user is not deafened initially
                    if (!getVoiceState().isSelfDeaf()) {
                        getVoiceUtils().toggleSelfDeaf();
                    }
                    
                    // 2. Start intercepting
                    patchWebSocket();
                    
                    // 3. Do the flip
                    setTimeout(() => {
                        getVoiceUtils().toggleSelfDeaf();
                        if (!getVoiceState().isSelfMute()) getVoiceUtils().toggleSelfMute();
                    }, 1000);
                }
                settings.store.iconState = !iconState;
            }}
        />
    );
}

export default definePlugin({
    name: "Fake Deafen",
    description: "Fakes your deafen status",
    authors: [{ name: "ELJoOker", id: 605894319408283678n }],
    dependencies: ["UserSettingsAPI"],
    settings,
    
    userAreaButton: {
        icon: Icon,
        render: ErrorBoundary.wrap(GameActivityToggleButton, { noop: true })
    },

    start() {
        enableStyle(style);
        settings.store.iconState = false;
    },
    stop() {
        disableStyle(style);
        unpatchWebSocket();
    }
});