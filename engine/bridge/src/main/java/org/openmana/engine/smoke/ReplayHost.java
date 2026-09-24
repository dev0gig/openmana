package org.openmana.engine.smoke;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.bridge.EngineHost;

import java.util.ArrayList;
import java.util.List;

/**
 * Plays back recorded inputs, one per {@link #awaitInput()}, and ignores what
 * the engine says. On the JVM it proves that a transcript describes the
 * player's decisions completely; the Wasm tests do the same through the
 * EngineClient and the SharedArrayBuffer input queue (engine/wasm/spike/replay.ts).
 * Running out of inputs means the game went differently: that fails loudly.
 */
public final class ReplayHost implements EngineHost {

    private final List<JsonObject> inputs = new ArrayList<>();
    private int next;

    public ReplayHost(final Iterable<? extends JsonElement> recorded) {
        for (final JsonElement e : recorded) {
            inputs.add(e.getAsJsonObject().deepCopy());
        }
    }

    @Override
    public void emit(final JsonObject message) {
        // the recorded decisions already contain everything
    }

    @Override
    public JsonObject awaitInput() {
        if (next >= inputs.size()) {
            throw new IllegalStateException("the engine waits for input #" + (next + 1)
                    + ", but the recording ends after " + inputs.size() + " inputs: the game went differently");
        }
        return inputs.get(next++).deepCopy();
    }

    /** Inputs handed to the engine so far. */
    public int used() {
        return next;
    }
}
