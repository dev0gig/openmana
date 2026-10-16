/*
 * Which recorded engine protocols today's app reads (prompt 48) - kept apart
 * from replay.ts (which re-exports it) so the match list, which loads with the
 * app, can say whether a recording can be replayed or reported without loading
 * the replay's checks (prompt 62).
 */
import { PROTOCOL_VERSION } from "@openmana/engine-protocol/generated/constants"

/**
 * Engine protocols whose recordings today's replay reads (prompt 48). Protocol
 * 10 only added messages (observations, their release, the settings), inputs
 * (observation.release, settings.change) and optional fields (landsUnlimited,
 * landRefusal); every message of a protocol-9 recording is a protocol-10
 * message but for the version number its game.started and engine.ready carry.
 * Such a recording is checked with that number read as today's and replayed
 * unchanged; nothing in it is rewritten. Older protocols stay exportable only.
 */
export const READABLE_PROTOCOLS: readonly number[] = [PROTOCOL_VERSION, 9]

export function readableProtocol(protocol: number): boolean {
  return READABLE_PROTOCOLS.includes(protocol)
}

/**
 * What the replay says about a recording of another protocol (replayFrames);
 * the report's button says the same where it is disabled (prompt 62).
 */
export const UNREADABLE_PROTOCOL = "Diese Aufzeichnung verwendet ein anderes Engine-Protokoll. JSON speichern bleibt verfügbar."
