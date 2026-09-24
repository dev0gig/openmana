package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.smoke.ReplayHost;
import org.openmana.engine.smoke.ScriptedHuman;
import org.openmana.engine.trace.EngineTrace;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.fail;

/**
 * Prompt 05: the engine trace, the structured record the differential tests
 * compare between the JVM and WebAssembly. Games from the differential test
 * fixtures (engine/fixtures), played here on the JVM:
 * <ul>
 *   <li>recording the trace does not change the game;</li>
 *   <li>the same seed and inputs give the same trace (a replay reproduces it);</li>
 *   <li>the trace is complete (a checkpoint before every input, the last one
 *       at the end) and has no words, only ids, keys, enum names and numbers;</li>
 *   <li>the scripted player's block assignment and a Commander game work
 *       through the bridge (the Commander fixture found a game that could not
 *       end: HeadlessGuiBase.showImageDialog).</li>
 * </ul>
 */
public class EngineTraceTest {

    /** Field names that would carry Forge's words: none of them may appear anywhere in a trace. */
    private static final Set<String> WORDS = Set.of("text", "label", "name", "title", "message", "description", "detail", "yesLabel", "noLabel");

    private Path fixtures;
    private JsonObject request3;
    private Traced traced3;

    /** A game played by a scripted player whose host keeps the trace entries. */
    private static final class Traced {
        final ScriptedHuman human;
        final JsonArray trace = new JsonArray();
        JsonObject result;

        Traced(final ScriptedHuman human) {
            this.human = human;
        }

        EngineHost host(final EngineHost player) {
            return new EngineHost() {
                @Override
                public void emit(final JsonObject message) {
                    if (EngineTrace.MESSAGE_TYPE.equals(message.get("type").getAsString())) {
                        trace.add(message.deepCopy());
                    } else {
                        player.emit(message);
                    }
                }

                @Override
                public JsonObject awaitInput() {
                    return player.awaitInput();
                }
            };
        }
    }

    @BeforeClass
    public void boot() throws Exception {
        EngineTestSupport.boot();
        final String dir = System.getProperty("openmana.fixtures");
        if (dir == null || dir.isEmpty() || dir.startsWith("${")) {
            fail("-Dopenmana.fixtures is not set; run engine/scripts/build-jvm.sh");
        }
        fixtures = Paths.get(dir);
        request3 = request("human-3");
        traced3 = play("human-3", request3);
    }

    private JsonObject fixture(final String name) throws IOException {
        return JsonParser.parseString(Files.readString(fixtures.resolve("differential").resolve(name + ".json"), StandardCharsets.UTF_8)).getAsJsonObject();
    }

    /** The fixture's match request with its decks read from fixtures/decks (as engine/wasm/test/fixtures.ts resolves it). */
    private JsonObject request(final String name) throws IOException {
        final JsonObject match = fixture(name).getAsJsonObject("match").deepCopy();
        for (final String seat : new String[]{"human", "ai"}) {
            final JsonObject spec = match.getAsJsonObject(seat);
            final String deck = spec.get("deck").getAsString();
            spec.add("deck", JsonParser.parseString(Files.readString(fixtures.resolve("decks").resolve(deck + ".json"), StandardCharsets.UTF_8)));
        }
        match.addProperty("trace", true);
        return match;
    }

    private Traced play(final String fixtureName, final JsonObject request) throws IOException {
        final JsonObject policy = fixture(fixtureName).has("player") ? fixture(fixtureName).getAsJsonObject("player") : new JsonObject();
        final Traced game = new Traced(ScriptedHuman.fromPolicy(policy));
        game.result = HumanMatch.play(game.host(game.human), request);
        return game;
    }

    @Test
    public void recordingTheTraceDoesNotChangeTheGame() throws IOException {
        final JsonObject untraced = request3.deepCopy();
        untraced.remove("trace");
        final ScriptedHuman human = ScriptedHuman.fromPolicy(fixture("human-3").getAsJsonObject("player"));
        final JsonObject result = HumanMatch.play(human, untraced);
        assertFalse(result.has("trace"), "an untraced match reports no trace");
        for (final String key : new String[]{"logSha256", "protocolSha256", "inputs", "turns", "result", "forgeCallbacks"}) {
            assertEquals(traced3.result.get(key), result.get(key), key);
        }
        assertEquals(human.inputs(), traced3.human.inputs(), "the same decisions");
    }

    @Test
    public void theSameInputsGiveTheSameTrace() {
        final JsonArray inputs = new JsonArray();
        traced3.human.inputs().forEach(inputs::add);
        final Traced replay = new Traced(null);
        replay.result = HumanMatch.play(replay.host(new ReplayHost(inputs)), request3);
        assertEquals(replay.trace.size(), traced3.trace.size(), "trace entries");
        for (int i = 0; i < replay.trace.size(); i++) {
            assertEquals(replay.trace.get(i), traced3.trace.get(i), "trace entry " + (i + 1));
        }
        assertEquals(replay.result.get("trace"), traced3.result.get("trace"));
    }

    @Test
    public void theTraceIsCompleteAndHasNoWords() {
        final JsonArray trace = traced3.trace;
        assertTrue(trace.size() > 100, "entries: " + trace.size());
        int inputCheckpoints = 0;
        int events = 0;
        final Set<String> kinds = EngineTrace.eventKinds();
        for (int i = 0; i < trace.size(); i++) {
            final JsonObject entry = trace.get(i).getAsJsonObject();
            assertEquals(entry.get("n").getAsInt(), i + 1, "numbered without gaps");
            final String at = entry.get("at").getAsString();
            assertTrue(EngineTrace.CHECKPOINTS.contains(at), at);
            if (EngineTrace.AT_INPUT.equals(at)) {
                inputCheckpoints++;
            }
            for (final JsonElement e : entry.getAsJsonArray("events")) {
                events++;
                assertTrue(kinds.contains(e.getAsJsonObject().get("e").getAsString()), e.toString());
            }
            final String word = findWord(entry, "");
            if (word != null) {
                fail("entry " + (i + 1) + " carries Forge's words at " + word);
            }
        }
        assertEquals(inputCheckpoints, traced3.result.get("inputs").getAsInt(), "a checkpoint before every input Forge read");
        assertEquals(trace.get(trace.size() - 1).getAsJsonObject().get("at").getAsString(), EngineTrace.AT_END);
        final JsonObject summary = traced3.result.getAsJsonObject("trace");
        assertEquals(summary.get("entries").getAsInt(), trace.size());
        assertEquals(summary.get("events").getAsInt(), events);
        // the complete game: the hidden AI hand and both libraries, by id and English key
        final JsonObject first = trace.get(0).getAsJsonObject().getAsJsonObject("snapshot");
        final JsonObject ai = first.getAsJsonArray("players").get(1).getAsJsonObject();
        assertEquals(ai.getAsJsonArray("hand").size(), 7, "the AI's opening hand, which the UI never sees");
        assertTrue(ai.getAsJsonArray("hand").get(0).getAsJsonObject().has("key"));
        assertEquals(ai.getAsJsonArray("library").size(), 53, "60 cards, 7 in the hand");
    }

    private static String findWord(final JsonElement e, final String path) {
        if (e.isJsonObject()) {
            for (final Map.Entry<String, JsonElement> field : e.getAsJsonObject().entrySet()) {
                if (WORDS.contains(field.getKey())) {
                    return path + "." + field.getKey();
                }
                final String inner = findWord(field.getValue(), path + "." + field.getKey());
                if (inner != null) {
                    return inner;
                }
            }
        } else if (e.isJsonArray()) {
            int i = 0;
            for (final JsonElement item : e.getAsJsonArray()) {
                final String inner = findWord(item, path + "[" + i++ + "]");
                if (inner != null) {
                    return inner;
                }
            }
        }
        return null;
    }

    /** Fixture blocks-multi: the player makes an attacker current by tapping it, then taps a blocker for it - twice in one combat. */
    @Test
    public void blockersAreAssignedToSeveralAttackers() throws IOException {
        final Traced game = play("blocks-multi", request("blocks-multi"));
        final int human = game.trace.get(0).getAsJsonObject().getAsJsonObject("snapshot").get("human").getAsInt();
        int multi = 0;
        for (final JsonElement entry : game.trace) {
            for (final JsonElement e : entry.getAsJsonObject().getAsJsonArray("events")) {
                final JsonObject event = e.getAsJsonObject();
                if (!"blockers".equals(event.get("e").getAsString()) || event.get("player").getAsInt() != human) {
                    continue;
                }
                int blocked = 0;
                for (final JsonElement b : event.getAsJsonArray("blocks")) {
                    blocked += b.getAsJsonObject().getAsJsonArray("blockers").isEmpty() ? 0 : 1;
                }
                multi += blocked >= 2 ? 1 : 0;
            }
        }
        assertTrue(multi >= 1, "two attackers blocked in one combat");
        assertTrue(game.human.counters().getOrDefault("tap:block-attacker", 0) >= 1, game.human.counters().toString());
        assertEquals(game.human.counters().getOrDefault("rejected:no-effect", 0).intValue(), 0, "Forge took every tap: " + game.human.rejections());
        assertEquals(game.result.getAsJsonArray("forgeErrors").size(), 0, game.result.toString());
    }

    /** Fixture commander: cast from the command zone, back to it, cast again with tax, commander damage, and the game ends. */
    @Test
    public void aCommanderGameIsPlayedToItsEnd() throws IOException {
        final Traced game = play("commander", request("commander"));
        assertNotNull(game.human.end(), "game.end");
        assertEquals(game.result.getAsJsonArray("forgeErrors").size(), 0, game.result.toString());
        final JsonObject last = game.trace.get(game.trace.size() - 1).getAsJsonObject().getAsJsonObject("snapshot");
        JsonObject me = null;
        for (final JsonElement p : last.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("id").getAsInt() == last.get("human").getAsInt()) {
                me = p.getAsJsonObject();
            }
        }
        assertNotNull(me, "the human seat is a player of the snapshot");
        final JsonObject commander = me.getAsJsonArray("commanders").get(0).getAsJsonObject();
        assertTrue(commander.get("cast").getAsInt() >= 2, "cast again, with tax: " + commander);
        assertTrue(commander.getAsJsonObject("damage").size() > 0, "commander damage: " + commander);
        boolean returned = false;
        for (final JsonElement entry : game.trace) {
            for (final JsonElement e : entry.getAsJsonObject().getAsJsonArray("events")) {
                final JsonObject event = e.getAsJsonObject();
                returned |= "move".equals(event.get("e").getAsString()) && event.get("to") != null && !event.get("to").isJsonNull()
                        && event.get("to").getAsString().equals("Command:" + last.get("human").getAsInt())
                        && !event.get("from").getAsString().startsWith("Command");
            }
        }
        assertTrue(returned, "the commander went back to the command zone");
        assertEquals(me.get("life").getAsInt() > 0, true, "the player won at 40 life: " + me);
    }
}
