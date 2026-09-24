package org.openmana.engine.wasm;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import org.graalvm.webimage.api.JS;
import org.openmana.engine.bridge.EngineHost;

/**
 * The bridge's host inside the browser worker.
 *
 * <ul>
 *   <li>{@link #emit}: the worker posts the message to the page
 *       ({@code postMessage}); never blocks.</li>
 *   <li>{@link #awaitInput}: the worker tells the page it waits, then blocks
 *       with {@code Atomics.wait} on a SharedArrayBuffer until the page has
 *       written the next input. Forge's Java stack stays where it is, which is
 *       the whole point: the single Wasm thread waits inside Forge's input
 *       just like the game thread does on the JVM.</li>
 * </ul>
 * The JavaScript side is engine/wasm/host/worker-host.ts; the queue layout is
 * engine/protocol/src/input-queue.ts.
 */
final class WasmEngineHost implements EngineHost {

    @JS.Coerce
    @JS(args = {"json"}, value = "globalThis.__openmanaHost.emit('protocol', json);")
    private static native void emitProtocol(String json);

    @JS.Coerce
    @JS("return globalThis.__openmanaHost.awaitInput();")
    private static native String awaitInputJson();

    @Override
    public void emit(final JsonObject message) {
        emitProtocol(message.toString());
    }

    /**
     * The client only writes JSON objects (JSON.stringify of a validated
     * input). Anything else means the input queue is broken: the game must not
     * go on, the engine call ends with an exception (technical abort).
     */
    @Override
    public JsonObject awaitInput() {
        final String text = awaitInputJson();
        try {
            final JsonElement parsed = JsonParser.parseString(text);
            if (parsed.isJsonObject()) {
                return parsed.getAsJsonObject();
            }
        } catch (final JsonSyntaxException e) {
            // reported below
        }
        final String shown = text == null ? "null" : text.length() > 200 ? text.substring(0, 200) + "..." : text;
        throw new IllegalStateException("the input queue delivered something that is not a JSON object: " + shown);
    }
}
