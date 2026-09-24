package org.openmana.engine.bridge;

import com.google.gson.JsonObject;

/**
 * Where the bridge talks to: the UI side of the engine.
 *
 * <p>Both calls happen on Forge's single game thread. In the browser the host
 * is the Dedicated Worker ({@code WasmEngineHost}): {@link #emit} posts to the
 * page, {@link #awaitInput} blocks the worker with {@code Atomics.wait} until
 * the page has written the next input into a SharedArrayBuffer. On the JVM,
 * tests provide a scripted host.
 */
public interface EngineHost {

    /** Engine to UI: one protocol message. Must not block. */
    void emit(JsonObject message);

    /**
     * UI to engine: blocks until the next input message is available and
     * returns it. Called only when Forge waits for the human.
     */
    JsonObject awaitInput();
}
