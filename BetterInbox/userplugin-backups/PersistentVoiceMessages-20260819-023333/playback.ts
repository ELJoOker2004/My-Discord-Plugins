/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AudioPlayerInterface,createAudioPlayer } from "@api/AudioPlayer";
import { FluxDispatcher, SelectedChannelStore, useEffect, useRef } from "@webpack/common";
import type { Dispatch, RefObject, SetStateAction } from "react";

type NativePlayingState = [boolean, Dispatch<SetStateAction<boolean>>];

interface ActivePlayback {
    cacheKey?: string;
    channelId?: string;
    duration: number;
    media?: HTMLAudioElement;
    player: AudioPlayerInterface;
    position: number;
    setNativePlaying?: Dispatch<SetStateAction<boolean>>;
    setNativePosition?: Dispatch<SetStateAction<number>>;
    src: string;
}

export interface PlaybackSnapshot {
    channelId?: string;
    duration: number;
    paused: boolean;
    position: number;
    speed: number;
    src: string;
}

let active: ActivePlayback | undefined;
let lastCacheSync = 0;
let stopping = false;

function syncPlaybackCache(current: ActivePlayback, force = false) {
    if (!current.cacheKey || current.duration <= 0) return;
    const now = Date.now();
    if (!force && now - lastCacheSync < 1000) return;
    lastCacheSync = now;
    FluxDispatcher.dispatch({
        type: "MEDIA_PLAYBACK_POSITION_UPDATE",
        cacheKey: current.cacheKey,
        position: current.position,
        duration: current.duration
    });
}

export function stopPlayback() {
    const current = active;
    if (!current) return;
    active = undefined;
    current.setNativePlaying?.(false);
    current.media?.pause();
    current.player.delete();
    if (current.cacheKey) {
        FluxDispatcher.dispatch({
            type: "MEDIA_PLAYBACK_POSITION_UPDATE",
            cacheKey: current.cacheKey,
            position: 0,
            duration: Math.max(current.duration, 1)
        });
    }
}

function createPersistentPlayback(media: HTMLAudioElement, src: string, cacheKey?: string) {
    stopPlayback();
    const player = createAudioPlayer(src, {
        persistent: true,
        preload: true,
        speed: media.playbackRate,
        volume: media.volume * 100,
        onEnded: () => {
            if (active?.src === src) stopPlayback();
        },
        onError: () => {
            if (active?.src === src) stopPlayback();
        }
    });
    active = {
        cacheKey,
        channelId: SelectedChannelStore.getChannelId(),
        duration: Number.isFinite(media.duration) ? media.duration : 0,
        media,
        player,
        position: media.currentTime,
        src
    };
    lastCacheSync = 0;
    return active;
}

function detach(media: HTMLAudioElement, wasPlaying: boolean) {
    const current = active;
    if (!current || current.media !== media) return;
    current.position = media.currentTime;
    if (Number.isFinite(media.duration)) current.duration = media.duration;
    current.media = undefined;
    current.setNativePlaying = undefined;
    current.setNativePosition = undefined;
    current.player.seek(current.position);
    current.player.speed = media.playbackRate;
    current.player.volume = media.volume * 100;
    media.muted ? current.player.mute() : current.player.unmute();
    wasPlaying ? current.player.play() : current.player.pause();
    syncPlaybackCache(current, true);
    media.pause();
}

export function usePersistentPlayback(
    nativeState: NativePlayingState,
    mediaRef: RefObject<HTMLAudioElement | null>,
    src: string,
    cacheKey: string | undefined,
    setNativePosition: Dispatch<SetStateAction<number>>
) {
    const [nativePlaying, setNativePlaying] = nativeState;
    const nativePlayingRef = useRef(nativePlaying);
    nativePlayingRef.current = nativePlaying;

    useEffect(() => {
        const media = mediaRef.current;
        if (!media) return;

        const onPlay = () => {
            nativePlayingRef.current = true;
            const current = active?.src === src ? active : createPersistentPlayback(media, src, cacheKey);
            const previousMedia = current.media;
            const previousSetter = current.setNativePlaying;
            current.media = media;
            current.setNativePlaying = setNativePlaying;
            current.setNativePosition = setNativePosition;
            current.position = media.currentTime;
            if (Number.isFinite(media.duration)) current.duration = media.duration;
            if (previousMedia && previousMedia !== media) {
                previousSetter?.(false);
                previousMedia.pause();
            }
            current.player.seek(current.position);
            current.player.speed = media.playbackRate;
            current.player.volume = media.volume * 100;
            current.player.mute();
            current.player.play();
            syncPlaybackCache(current, true);
        };
        const onPause = () => {
            const current = active;
            queueMicrotask(() => {
                if (!current || active !== current || current.media !== media) return;
                if (!media.isConnected && nativePlayingRef.current && !stopping) {
                    detach(media, true);
                    return;
                }
                nativePlayingRef.current = false;
                current.position = media.currentTime;
                current.player.seek(current.position);
                current.player.pause();
                syncPlaybackCache(current, true);
            });
        };
        const onEnded = () => stopPlayback();
        const onSeeking = () => {
            const current = active;
            if (!current || current.media !== media) return;
            current.position = media.currentTime;
            current.player.seek(current.position);
            setNativePosition(current.position);
            syncPlaybackCache(current, true);
        };
        const onTimeUpdate = () => {
            const current = active;
            if (!current || current.media !== media) return;
            current.position = media.currentTime;
            if (Number.isFinite(media.duration)) current.duration = media.duration;
            syncPlaybackCache(current);
        };
        const onRateChange = () => {
            if (active?.media === media) active.player.speed = media.playbackRate;
        };
        const onVolumeChange = () => {
            if (active?.media === media) active.player.volume = media.volume * 100;
        };

        media.addEventListener("play", onPlay);
        media.addEventListener("pause", onPause);
        media.addEventListener("ended", onEnded);
        media.addEventListener("seeking", onSeeking);
        media.addEventListener("timeupdate", onTimeUpdate);
        media.addEventListener("ratechange", onRateChange);
        media.addEventListener("volumechange", onVolumeChange);

        const current = active?.src === src && !active.media ? active : undefined;
        if (current) {
            current.media = media;
            current.setNativePlaying = setNativePlaying;
            current.setNativePosition = setNativePosition;
            const { paused, time } = current.player;
            if (time && paused) {
                Promise.all([time, paused]).then(([position, isPaused]) => {
                    if (active !== current || current.media !== media) return;
                    current.position = position;
                    media.currentTime = position;
                    setNativePosition(position);
                    if (!isPaused) setNativePlaying(true);
                });
            }
        }

        return () => {
            media.removeEventListener("play", onPlay);
            media.removeEventListener("pause", onPause);
            media.removeEventListener("ended", onEnded);
            media.removeEventListener("seeking", onSeeking);
            media.removeEventListener("timeupdate", onTimeUpdate);
            media.removeEventListener("ratechange", onRateChange);
            media.removeEventListener("volumechange", onVolumeChange);
            if (active?.media === media) detach(media, nativePlayingRef.current && !stopping);
        };
    }, [cacheKey, mediaRef, setNativePlaying, setNativePosition, src]);

    return nativeState;
}

export async function readPlaybackSnapshot(): Promise<PlaybackSnapshot | undefined> {
    const current = active;
    if (!current) return;

    let duration: number;
    let paused: boolean;
    let position: number;
    if (current.media) {
        duration = current.media.duration;
        paused = current.media.paused;
        position = current.media.currentTime;
    } else {
        [duration, paused, position] = await Promise.all([
            current.player.duration ?? Promise.resolve(current.duration),
            current.player.paused ?? Promise.resolve(true),
            current.player.time ?? Promise.resolve(current.position)
        ]);
    }
    if (active !== current) return;

    current.duration = Number.isFinite(duration) ? duration : current.duration;
    current.position = Number.isFinite(position) ? position : current.position;
    syncPlaybackCache(current);
    return {
        channelId: current.channelId,
        duration: current.duration,
        paused,
        position: current.position,
        speed: current.media?.playbackRate ?? current.player.speed,
        src: current.src
    };
}

export async function togglePlayback() {
    const current = active;
    if (!current) return;
    if (current.media && current.setNativePlaying) {
        current.setNativePlaying(current.media.paused);
        return;
    }
    const paused = await current.player.paused;
    if (active !== current || paused == null) return;
    paused ? current.player.play() : current.player.pause();
}

export function seekPlayback(position: number) {
    const current = active;
    if (!current) return;
    const target = Math.max(0, Math.min(position, current.duration || position));
    current.position = target;
    current.player.seek(target);
    if (current.media) current.media.currentTime = target;
    current.setNativePosition?.(target);
    syncPlaybackCache(current, true);
}

export function setPlaybackSpeed(speed: number) {
    const current = active;
    if (!current) return;
    current.player.speed = speed;
    if (current.media) current.media.playbackRate = speed;
    FluxDispatcher.dispatch({
        type: "MEDIA_PLAYBACK_RATE_UPDATE",
        playbackType: "voice_message",
        rate: speed
    });
}

export function startPlaybackService() {
    stopping = false;
}

export function stopPlaybackService() {
    stopping = true;
    stopPlayback();
}
