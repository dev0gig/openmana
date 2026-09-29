package org.openmana.engine;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.ScriptedHuman;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.testng.Assert.fail;

/**
 * A game of a differential fixture played like the scripted player, with
 * every message the bridge sends recorded and the inputs in between
 * ("sent" pseudo messages, so the order is kept); a subclass may take over
 * an input (override). Shared by the engine tests of prompts 17 and 18,
 * with the helpers they read the recording with.
 */
class Recorder implements EngineHost {
    final ScriptedHuman player;
    final List<JsonObject> messages = new ArrayList<>();
    /** The inputs sent, numbered like the bridge sees them. */
    final List<JsonObject> inputs = new ArrayList<>();
    final Map<Long, JsonObject> open = new LinkedHashMap<>();
    /** The seqs of the inputs this recorder sent itself (override). */
    final List<Long> own = new ArrayList<>();
    JsonObject state;
    JsonObject result;
    private int seq;

    Recorder(final ScriptedHuman player) {
        this.player = player;
    }

    @Override
    public void emit(final JsonObject message) {
        messages.add(message);
        switch (type(message)) {
            case Protocol.STATE -> state = message;
            case Protocol.QUESTION -> open.put(message.get("id").getAsLong(), message);
            case Protocol.QUESTION_ANSWERED, Protocol.QUESTION_WITHDRAWN -> open.remove(message.get("id").getAsLong());
            default -> { }
        }
        player.emit(message);
    }

    JsonObject override() {
        return null;
    }

    @Override
    public JsonObject awaitInput() {
        final JsonObject mine = override();
        final JsonObject input = mine != null ? mine : player.awaitInput();
        input.addProperty("seq", ++seq);
        if (mine != null) {
            own.add((long) seq);
        }
        inputs.add(input.deepCopy());
        messages.add(marker(input));
        return input;
    }

    Recorder play(final JsonObject request) {
        result = HumanMatch.play(this, request);
        return this;
    }

    boolean stepOpen(final String purpose) {
        return open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_BUTTONS, purpose));
    }

    boolean selectionOpen() {
        return open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_SELECT, null));
    }

    /** An input as a pseudo message in the recording ("sent"), so the order of inputs and messages is kept. */
    private static JsonObject marker(final JsonObject input) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", "sent");
        o.add("input", input.deepCopy());
        return o;
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────────

    /** engine/fixtures (-Dopenmana.fixtures, set by build-jvm.sh). */
    static Path fixtures() {
        final String dir = System.getProperty("openmana.fixtures");
        if (dir == null || dir.isEmpty() || dir.startsWith("${")) {
            fail("-Dopenmana.fixtures is not set; run engine/scripts/build-jvm.sh");
        }
        return Paths.get(dir);
    }

    static JsonObject fixture(final String name) throws IOException {
        return JsonParser.parseString(Files.readString(fixtures().resolve("differential").resolve(name + ".json"), StandardCharsets.UTF_8)).getAsJsonObject();
    }

    /** The fixture's match request with its decks read in. */
    static JsonObject request(final JsonObject fixture) throws IOException {
        final JsonObject match = fixture.getAsJsonObject("match").deepCopy();
        for (final String seat : new String[]{"human", "ai"}) {
            final JsonObject spec = match.getAsJsonObject(seat);
            final String deck = spec.get("deck").getAsString();
            spec.add("deck", JsonParser.parseString(Files.readString(fixtures().resolve("decks").resolve(deck + ".json"), StandardCharsets.UTF_8)));
        }
        return match;
    }

    // ── Reading a recording ───────────────────────────────────────────────────────

    static String type(final JsonObject message) {
        return message.get("type").getAsString();
    }

    static boolean isQuestion(final JsonObject message, final String kind, final String purpose) {
        return Protocol.QUESTION.equals(type(message)) && kind.equals(message.get("kind").getAsString())
                && (purpose == null || (message.has("purpose") && purpose.equals(message.get("purpose").getAsString())));
    }

    static JsonObject player(final JsonObject state, final boolean me) {
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("me").getAsBoolean() == me) {
                return p.getAsJsonObject();
            }
        }
        throw new AssertionError("no such player: " + state);
    }

    static JsonObject player(final JsonObject state, final int id) {
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("id").getAsInt() == id) {
                return p.getAsJsonObject();
            }
        }
        throw new AssertionError("no player " + id + ": " + state);
    }

    /** The first state after message index {@code from}, or null. */
    static JsonObject nextState(final List<JsonObject> messages, final int from) {
        for (int i = from + 1; i < messages.size(); i++) {
            if (Protocol.STATE.equals(type(messages.get(i)))) {
                return messages.get(i);
            }
        }
        return null;
    }

    /** The rejection of the input with this seq, if the bridge sent one. */
    static JsonObject rejectionOf(final List<JsonObject> messages, final long seq) {
        for (final JsonObject m : messages) {
            if (Protocol.INPUT_REJECTED.equals(type(m)) && m.get("seq").getAsLong() == seq) {
                return m;
            }
        }
        return null;
    }

    static int count(final Recorder recorder, final String key) {
        return recorder.player.counters().getOrDefault(key, 0);
    }
}
