package org.openmana.engine;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.bridge.RunningInput;
import org.openmana.engine.smoke.ReplayHost;
import org.openmana.engine.smoke.ScriptedHuman;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.fail;

/**
 * Prompt 17: targets and cost payment through the bridge (protocol 6), in the
 * real game of the differential fixture {@code targets-payment} (Rakdos
 * spells with player targets, two targets, Dark Ritual's floating mana,
 * Phyrexian mana, modes, X, kicker, a sacrifice) against Forge's AI, with
 * every message the bridge sends recorded:
 * <ul>
 *   <li>a player is marked selectable only where Forge's running input would
 *       take them (a selection, a payment), and every player.tap on a marked
 *       player is taken - Forge's highlight or the payment changes;</li>
 *   <li>a player.tap or mana.use Forge would not take is refused loudly
 *       (no-effect), without touching the game;</li>
 *   <li>the payment in progress is in the state exactly while Forge's
 *       payment runs, its cost is what Forge's prompt shows, the pool's
 *       colours Forge lists are taken (mana.use pays), life pays Phyrexian
 *       mana;</li>
 *   <li>a selection's bounds are Forge's own - players count too.</li>
 * </ul>
 */
public class TargetPaymentTest {

    private static final Pattern COST = Pattern.compile("^(0|(\\{[^{}]+\\})+)$");

    private Path fixtures;
    private Recorder game;

    /** Plays like the scripted player and records every message; a subclass may take over an input. */
    private static class Recorder implements EngineHost {
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
    }

    /** An input as a pseudo message in the recording ("sent"), so the order of inputs and messages is kept. */
    private static JsonObject marker(final JsonObject input) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", "sent");
        o.add("input", input.deepCopy());
        return o;
    }

    @BeforeClass
    public void playGame() throws Exception {
        EngineTestSupport.boot();
        final String dir = System.getProperty("openmana.fixtures");
        if (dir == null || dir.isEmpty() || dir.startsWith("${")) {
            fail("-Dopenmana.fixtures is not set; run engine/scripts/build-jvm.sh");
        }
        fixtures = Paths.get(dir);
        final JsonObject fixture = fixture("targets-payment");
        game = new Recorder(ScriptedHuman.fromPolicy(fixture.getAsJsonObject("player"))).play(request(fixture));
    }

    private JsonObject fixture(final String name) throws IOException {
        return JsonParser.parseString(Files.readString(fixtures.resolve("differential").resolve(name + ".json"), StandardCharsets.UTF_8)).getAsJsonObject();
    }

    private JsonObject request(final JsonObject fixture) throws IOException {
        final JsonObject match = fixture.getAsJsonObject("match").deepCopy();
        for (final String seat : new String[]{"human", "ai"}) {
            final JsonObject spec = match.getAsJsonObject(seat);
            final String deck = spec.get("deck").getAsString();
            spec.add("deck", JsonParser.parseString(Files.readString(fixtures.resolve("decks").resolve(deck + ".json"), StandardCharsets.UTF_8)));
        }
        return match;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private static String type(final JsonObject message) {
        return message.get("type").getAsString();
    }

    private static boolean isQuestion(final JsonObject message, final String kind, final String purpose) {
        return Protocol.QUESTION.equals(type(message)) && kind.equals(message.get("kind").getAsString())
                && (purpose == null || (message.has("purpose") && purpose.equals(message.get("purpose").getAsString())));
    }

    private static JsonObject player(final JsonObject state, final boolean me) {
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("me").getAsBoolean() == me) {
                return p.getAsJsonObject();
            }
        }
        throw new AssertionError("no such player: " + state);
    }

    private static JsonObject player(final JsonObject state, final int id) {
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("id").getAsInt() == id) {
                return p.getAsJsonObject();
            }
        }
        throw new AssertionError("no player " + id + ": " + state);
    }

    /** The first state after message index {@code from}, or null. */
    private static JsonObject nextState(final List<JsonObject> messages, final int from) {
        for (int i = from + 1; i < messages.size(); i++) {
            if (Protocol.STATE.equals(type(messages.get(i)))) {
                return messages.get(i);
            }
        }
        return null;
    }

    /** The rejection of the input with this seq, if the bridge sent one. */
    private static JsonObject rejectionOf(final List<JsonObject> messages, final long seq) {
        for (final JsonObject m : messages) {
            if (Protocol.INPUT_REJECTED.equals(type(m)) && m.get("seq").getAsLong() == seq) {
                return m;
            }
        }
        return null;
    }

    private static int count(final Recorder recorder, final String key) {
        return recorder.player.counters().getOrDefault(key, 0);
    }

    // ── Players ───────────────────────────────────────────────────────────────────

    /**
     * Players are marked selectable only while Forge's running input takes a
     * player (a selection of targets or cards, a payment), never at priority
     * or in combat; and every player.tap the scripted player sent on a
     * marked player was taken: in a selection Forge's highlight turned on,
     * in a payment the cost changed (Phyrexian mana paid with life).
     */
    @Test
    public void playersAreSelectableOnlyWhereForgeTakesThemAndTheirTapsAreTaken() {
        int selectable = 0;
        int targetTaps = 0;
        int lifeTaps = 0;
        JsonObject state = null;
        final Map<Long, JsonObject> open = new LinkedHashMap<>();
        for (int i = 0; i < game.messages.size(); i++) {
            final JsonObject m = game.messages.get(i);
            switch (type(m)) {
                case Protocol.STATE -> {
                    state = m;
                    for (final JsonElement p : m.getAsJsonArray("players")) {
                        if (p.getAsJsonObject().has("selectable")) {
                            selectable++;
                        }
                    }
                }
                case Protocol.QUESTION -> open.put(m.get("id").getAsLong(), m);
                case Protocol.QUESTION_ANSWERED, Protocol.QUESTION_WITHDRAWN -> open.remove(m.get("id").getAsLong());
                case "sent" -> {
                    final JsonObject input = m.getAsJsonObject("input");
                    // The state the player acts on: a marked player only while a selection or a payment is open.
                    if (state != null && open.values().stream().noneMatch(q -> q.get("blocking").getAsBoolean())) {
                        final boolean takesPlayers = open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_SELECT, null)
                                || isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PAYMENT));
                        for (final JsonElement p : state.getAsJsonArray("players")) {
                            assertTrue(takesPlayers || !p.getAsJsonObject().has("selectable"), "a player marked selectable at " + open.values());
                        }
                    }
                    if (!Protocol.PLAYER_TAP.equals(type(input))) {
                        continue;
                    }
                    assertNotNull(state);
                    final int id = input.get("player").getAsInt();
                    final JsonObject before = player(state, id);
                    assertTrue(before.has("selectable"), "the scripted player tapped a player Forge did not mark: " + before);
                    assertEquals(rejectionOf(game.messages, input.get("seq").getAsLong()), null, "a tap on a marked player was refused");
                    final boolean inSelection = open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_SELECT, null));
                    final JsonObject after = nextState(game.messages, i);
                    assertNotNull(after, "no state after the player tap");
                    if (inSelection) {
                        targetTaps++;
                        assertTrue(player(after, id).has("highlighted") || !player(after, id).has("selectable"),
                                "Forge took the player as a target but neither highlights them nor stops the selection: " + after);
                    } else {
                        assertTrue(open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PAYMENT)),
                                "a player tap outside a selection and a payment");
                        lifeTaps++;
                        final JsonObject paymentBefore = state.getAsJsonObject("payment");
                        assertNotNull(paymentBefore, "the payment is not in the state");
                        final JsonObject paymentAfter = after.has("payment") ? after.getAsJsonObject("payment") : null;
                        assertTrue(paymentAfter == null || !paymentAfter.get("cost").equals(paymentBefore.get("cost")),
                                "life for mana changed nothing: " + paymentBefore + " -> " + paymentAfter);
                    }
                }
                default -> { }
            }
        }
        assertTrue(selectable > 0, "Forge never took a player");
        assertTrue(targetTaps >= 2, targetTaps + " players chosen as targets");
        assertTrue(lifeTaps >= 1, lifeTaps + " life payments");
    }

    /**
     * A player.tap or mana.use Forge's running input would not take is
     * refused (no-effect) and changes nothing: at the first priority the
     * player taps the opponent and asks for red mana from an empty pool; the
     * game then goes on as the scripted player plays it.
     */
    @Test
    public void tapsForgeWouldNotTakeAreRefused() throws Exception {
        final int[] step = {0};
        final Recorder refused = new Recorder(ScriptedHuman.fromPolicy(fixture("targets-payment").getAsJsonObject("player"))) {
            @Override
            JsonObject override() {
                final boolean priority = open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PRIORITY));
                if (!priority || state == null || step[0] >= 2) {
                    return null;
                }
                final JsonObject o = new JsonObject();
                if (step[0]++ == 0) {
                    o.addProperty("type", Protocol.PLAYER_TAP);
                    o.addProperty("player", player(state, false).get("id").getAsInt());
                } else {
                    o.addProperty("type", Protocol.MANA_USE);
                    o.addProperty("color", "R");
                }
                return o;
            }
        }.play(request(fixture("targets-payment")));
        assertEquals(step[0], 2);
        assertEquals(refused.own.size(), 2);
        for (final long seq : refused.own) {
            final JsonObject rejection = rejectionOf(refused.messages, seq);
            assertNotNull(rejection, "input " + seq + " was not refused");
            assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_NO_EFFECT, rejection.toString());
        }
        assertNotNull(refused.result, "the game went on to its end");
    }

    // ── Payment ───────────────────────────────────────────────────────────────────

    /**
     * The payment is in the state exactly while Forge's payment runs (its
     * Auto/Cancel buttons are open), its cost is Forge's mana symbols and
     * the very text of Forge's prompt; every colour of the pool Forge lists
     * is one the player has floating; the scripted player's mana.use were
     * all taken and paid (the cost or the pool changed).
     */
    @Test
    public void thePaymentIsInTheStateWhileForgePays() {
        final Map<Long, JsonObject> open = new LinkedHashMap<>();
        String prompt = null;
        int payments = 0;
        int poolUses = 0;
        JsonObject state = null;
        for (int i = 0; i < game.messages.size(); i++) {
            final JsonObject m = game.messages.get(i);
            switch (type(m)) {
                case Protocol.QUESTION -> open.put(m.get("id").getAsLong(), m);
                case Protocol.QUESTION_ANSWERED, Protocol.QUESTION_WITHDRAWN -> open.remove(m.get("id").getAsLong());
                case Protocol.MESSAGE -> {
                    if ("prompt".equals(m.get("kind").getAsString())) {
                        prompt = m.get("text").getAsString();
                    }
                }
                case Protocol.STATE -> {
                    state = m;
                    if (m.has("payment")) {
                        payments++;
                        final JsonObject payment = m.getAsJsonObject("payment");
                        final String cost = payment.get("cost").getAsString();
                        assertTrue(COST.matcher(cost).matches(), cost);
                        final JsonObject mana = player(m, true).getAsJsonObject("mana");
                        for (final char color : payment.get("pool").getAsString().toCharArray()) {
                            assertTrue(mana.get(String.valueOf(color)).getAsInt() > 0, "Forge lists " + color + " but nothing of it floats: " + mana);
                        }
                    }
                }
                case "sent" -> {
                    final JsonObject input = m.getAsJsonObject("input");
                    if (Protocol.MANA_USE.equals(type(input))) {
                        poolUses++;
                        assertNotNull(state);
                        assertTrue(state.has("payment") && state.getAsJsonObject("payment").get("pool").getAsString().contains(input.get("color").getAsString()),
                                "mana.use of a colour the payment does not list");
                        assertEquals(rejectionOf(game.messages, input.get("seq").getAsLong()), null, "mana from the pool was refused");
                        final JsonObject after = nextState(game.messages, i);
                        assertNotNull(after);
                        assertFalse(after.has("payment") && after.get("payment").equals(state.get("payment"))
                                && player(after, true).get("mana").equals(player(state, true).get("mana")), "mana.use changed nothing");
                    }
                }
                default -> { }
            }
            // Before every input: the payment is in the state exactly while Forge's payment buttons are open.
            if ("sent".equals(type(m)) && state != null) {
                final boolean paying = open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PAYMENT));
                final boolean blocking = open.values().stream().anyMatch(q -> q.get("blocking").getAsBoolean());
                if (!blocking) {
                    assertEquals(state.has("payment"), paying, "payment in the state " + state.get("payment") + " while open: " + open.values());
                }
                if (paying && state.has("payment") && prompt != null) {
                    final String cost = state.getAsJsonObject("payment").get("cost").getAsString();
                    assertTrue(prompt.contains(cost), "Forge's prompt '" + prompt + "' does not show the cost " + cost);
                }
            }
        }
        assertTrue(payments > 3, payments + " states during payments");
        assertTrue(poolUses >= 1, "floating mana was never used");
        assertTrue(count(game, "tap:player-life") >= 1, game.player.counters().toString());
    }

    // ── Asking changes nothing ────────────────────────────────────────────────────

    /**
     * Asking Forge's running input (which player a click would take, what is
     * still to pay, which floating mana it would take) must not change the
     * game - like looking at a card (prompt 16). The very inputs of the
     * recorded games are replayed without asking: Forge's game log is the
     * same, entry for entry (its hash), in the game of this prompt and in the
     * long Commander game.
     */
    @Test
    public void askingForgesRunningInputChangesNothing() throws Exception {
        final JsonObject commanderFixture = fixture("commander");
        final Recorder commander = new Recorder(ScriptedHuman.fromPolicy(commanderFixture.getAsJsonObject("player"))).play(request(commanderFixture));
        for (final Recorder recorded : List.of(game, commander)) {
            final JsonObject request = recorded == game ? request(fixture("targets-payment")) : request(commanderFixture);
            final com.google.gson.JsonArray inputs = new com.google.gson.JsonArray();
            recorded.inputs.forEach(inputs::add);
            final JsonObject unasked;
            RunningInput.setAskingForTests(false);
            try {
                unasked = HumanMatch.play(new ReplayHost(inputs), request);
            } finally {
                RunningInput.setAskingForTests(true);
            }
            assertEquals(unasked.get("logSha256"), recorded.result.get("logSha256"), "Forge's game log differs without asking");
            assertEquals(unasked.get("turns"), recorded.result.get("turns"));
            assertEquals(unasked.get("inputs"), recorded.result.get("inputs"));
        }
    }

    // ── Selections ────────────────────────────────────────────────────────────────

    /** A selection's bounds are Forge's own: where players count too, max may exceed the cards listed (Arc Trail: two targets). */
    @Test
    public void aSelectionsBoundsAreForgesOwn() {
        boolean beyondCards = false;
        for (final JsonObject m : game.messages) {
            if (!isQuestion(m, Protocol.KIND_SELECT, null)) {
                continue;
            }
            final int min = m.get("min").getAsInt();
            final int max = m.get("max").getAsInt();
            assertTrue(min <= max, m.toString());
            if (max > m.getAsJsonArray("items").size()) {
                beyondCards = true;
            }
        }
        assertTrue(beyondCards, "no selection whose bounds count players");
    }
}
