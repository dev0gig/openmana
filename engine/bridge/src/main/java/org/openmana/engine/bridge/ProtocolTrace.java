package org.openmana.engine.bridge;

import com.google.gson.JsonObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Passes every message through to the real host and fingerprints the ones
 * that carry decisions: game start, questions, withdrawals, rejections,
 * notices, game end.
 *
 * <p>State and event messages are left out on purpose. Their batching follows
 * a clock (state at most every 120 ms, events ride along), so it may differ
 * between runs. Everything fingerprinted here depends only on Forge and the
 * player's inputs: for the same seed and the same inputs the fingerprint is
 * the same on the JVM and in WebAssembly, question ids included. The Wasm
 * replay tests compare it.
 */
final class ProtocolTrace implements EngineHost {

    private final EngineHost host;
    private final MessageDigest digest;
    private int messages;

    ProtocolTrace(final EngineHost host) {
        this.host = host;
        this.digest = newDigest();
    }

    @Override
    public void emit(final JsonObject message) {
        final String type = message.get("type").getAsString();
        if (!Protocol.STATE.equals(type) && !Protocol.EVENTS.equals(type)) {
            digest.update(message.toString().getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '\n');
            messages++;
        }
        host.emit(message);
    }

    @Override
    public JsonObject awaitInput() {
        return host.awaitInput();
    }

    /** Number of fingerprinted messages. */
    int messages() {
        return messages;
    }

    /** SHA-256 over the fingerprinted messages, one JSON text per line. */
    String sha256() {
        return hex(digest.digest());
    }

    static String sha256(final String text) {
        return hex(newDigest().digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (final NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String hex(final byte[] bytes) {
        final StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (final byte b : bytes) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }
}
