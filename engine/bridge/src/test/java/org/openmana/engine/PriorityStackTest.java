package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.ScriptedHuman;
import org.openmana.engine.smoke.SmokeDecks;
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
import java.util.Set;
import java.util.TreeSet;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.fail;

/**
 * Prompt 16: priority, stack and phases through the bridge (protocol 5), in
 * real games against Forge's AI with every message the bridge sends recorded:
 * <ul>
 *   <li>Forge asks the player at priority only where it found something the
 *       player can do (APINA, YIELD_AUTO_PASS_NO_ACTIONS): the state before
 *       every priority question says so ({@code canAct}) and marks a card
 *       playable - in the player's own turn and in the opponent's;</li>
 *   <li>the buttons of the priority step say what they do (pass, end turn,
 *       undo), and Forge's two second buttons do what they say: End Turn
 *       passes priority until the end of the turn (the attack of that turn
 *       is left out) but still stops for the opponent's spell or attack,
 *       Undo takes a mana ability back;</li>
 *   <li>stack items carry their card (a spell's own card, an ability's
 *       source), never marked usable, and say whether they are abilities;</li>
 *   <li>asking what a tap would do never touches the opponent's cards during
 *       priority and payment (prompt 05, §7.2);</li>
 *   <li>a selection names only the ids of cards the player may see.</li>
 * </ul>
 */
public class PriorityStackTest {

    /** The reference game of prompt 02 (spells with targets, a trigger, scry); the player attacks in several turns. */
    private static final long SEED_A = 3;
    /** Adventure, discarding two, two scrys. */
    private static final long SEED_B = 11;

    private Path fixtures;
    private Recorder gameA;
    private Recorder gameB;
    private Recorder respond;

    /**
     * Plays like the scripted player and records every message the bridge
     * sends. A subclass may take over an input ({@link #override()}); inputs
     * are numbered here, so the scripted player's own numbering does not
     * matter.
     */
    private static class Recorder implements EngineHost {
        final ScriptedHuman player;
        final List<JsonObject> messages = new ArrayList<>();
        /** The questions open right now, by id. */
        final Map<Long, JsonObject> open = new LinkedHashMap<>();
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

        /** An input of this host's own instead of the scripted player's, or null. */
        JsonObject override() {
            return null;
        }

        @Override
        public JsonObject awaitInput() {
            final JsonObject own = override();
            final JsonObject input = own != null ? own : player.awaitInput();
            input.addProperty("seq", ++seq);
            return input;
        }

        /** The open priority question, or null. */
        JsonObject openPriority() {
            JsonObject latest = null;
            for (final JsonObject q : open.values()) {
                if (isPriority(q)) {
                    latest = q;
                }
            }
            return latest;
        }

        Recorder play(final JsonObject request) {
            result = HumanMatch.play(this, request);
            return this;
        }
    }

    @BeforeClass
    public void playGames() throws Exception {
        EngineTestSupport.boot();
        final String dir = System.getProperty("openmana.fixtures");
        if (dir == null || dir.isEmpty() || dir.startsWith("${")) {
            fail("-Dopenmana.fixtures is not set; run engine/scripts/build-jvm.sh");
        }
        fixtures = Paths.get(dir);
        gameA = new Recorder(new ScriptedHuman()).play(SmokeDecks.humanMatchRequest(SEED_A));
        gameB = new Recorder(new ScriptedHuman()).play(SmokeDecks.humanMatchRequest(SEED_B));
        final JsonObject fixture = fixture("priority-respond");
        respond = new Recorder(ScriptedHuman.fromPolicy(fixture.getAsJsonObject("player"))).play(request(fixture));
    }

    private JsonObject fixture(final String name) throws IOException {
        return JsonParser.parseString(Files.readString(fixtures.resolve("differential").resolve(name + ".json"), StandardCharsets.UTF_8)).getAsJsonObject();
    }

    /** The fixture's match request with its decks read from fixtures/decks (as engine/wasm/test/fixtures.ts resolves it). */
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

    private static boolean isPriority(final JsonObject message) {
        return isQuestion(message, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PRIORITY);
    }

    private static JsonObject me(final JsonObject state) {
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("me").getAsBoolean()) {
                return p.getAsJsonObject();
            }
        }
        throw new AssertionError("no player is me: " + state);
    }

    private static boolean myTurn(final JsonObject state) {
        return !state.get("activePlayer").isJsonNull() && state.get("activePlayer").equals(state.get("me"));
    }

    private static String where(final JsonObject state) {
        return "turn " + state.get("turn") + " " + state.get("phase") + (myTurn(state) ? " (own turn)" : " (AI's turn)");
    }

    /** Every visible card of the state: all zones of all players. */
    private static List<JsonObject> visibleCards(final JsonObject state) {
        final List<JsonObject> cards = new ArrayList<>();
        for (final JsonElement p : state.getAsJsonArray("players")) {
            final JsonObject zones = p.getAsJsonObject().getAsJsonObject("zones");
            for (final String zone : zones.keySet()) {
                for (final JsonElement c : zones.getAsJsonArray(zone)) {
                    if (!c.getAsJsonObject().has("hidden")) {
                        cards.add(c.getAsJsonObject());
                    }
                }
            }
        }
        return cards;
    }

    private static JsonObject button(final JsonObject question, final int nr) {
        for (final JsonElement b : question.getAsJsonArray("buttons")) {
            if (b.getAsJsonObject().get("nr").getAsInt() == nr) {
                return b.getAsJsonObject();
            }
        }
        throw new AssertionError("no button " + nr + ": " + question);
    }

    private static String meaning(final JsonObject question, final int nr) {
        final JsonObject b = button(question, nr);
        return b.has("meaning") ? b.get("meaning").getAsString() : null;
    }

    private static JsonObject pressButton(final JsonObject question, final int nr) {
        final JsonObject a = new JsonObject();
        a.addProperty("type", Protocol.ANSWER);
        a.addProperty("question", question.get("id").getAsLong());
        a.addProperty("kind", Protocol.KIND_BUTTONS);
        a.addProperty("button", nr);
        return a;
    }

    private static JsonObject tap(final int card) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.CARD_TAP);
        o.addProperty("card", card);
        return o;
    }

    private static int count(final Recorder game, final String key) {
        return game.player.counters().getOrDefault(key, 0);
    }

    // ── APINA ─────────────────────────────────────────────────────────────────────

    /**
     * Forge's own auto-pass stays in charge (Bible §6 "Reduce meaningless
     * interaction"): a priority in which Forge finds nothing the player can
     * do never reaches the UI. Before every priority question the state
     * shows Forge's finding (canAct) and Forge's marker on at least one card.
     * The player who holds answers gets priority in the AI's turn too.
     */
    @Test
    public void forgeAsksAtPriorityOnlyWhereThePlayerCanAct() {
        int asked = 0;
        int inOpponentsTurn = 0;
        for (final Recorder game : List.of(gameA, gameB, respond)) {
            JsonObject state = null;
            for (final JsonObject m : game.messages) {
                if (Protocol.STATE.equals(type(m))) {
                    state = m;
                    continue;
                }
                if (!isPriority(m)) {
                    continue;
                }
                assertNotNull(state, "a priority question before the first state");
                asked++;
                final JsonObject me = me(state);
                assertTrue(me.get("canAct").getAsBoolean(), "Forge asked at priority without finding an action: " + where(state));
                assertTrue(visibleCards(state).stream().anyMatch(c -> c.has("playable")), "no card marked playable at priority: " + where(state));
                if (!myTurn(state)) {
                    inOpponentsTurn++;
                }
            }
        }
        assertTrue(asked >= 30, asked + " priority questions");
        assertTrue(inOpponentsTurn >= 3, "the player holding answers got priority in the AI's turn " + inOpponentsTurn + " times");
        assertTrue(count(respond, "priority:stack-empty") > 0 && count(respond, "pass") > 0, respond.player.counters().toString());
    }

    // ── Buttons of the priority step ──────────────────────────────────────────────

    /**
     * OK is "pass", the second button "end turn" or "undo"; buttons of every
     * other step carry no meaning - except the declaration of attackers
     * (protocol 7, checked in AttackersTest).
     */
    @Test
    public void theButtonsOfThePrioritySayWhatTheyDo() {
        final Set<String> seconds = new TreeSet<>();
        int others = 0;
        for (final Recorder game : List.of(gameA, gameB, respond)) {
            for (final JsonObject m : game.messages) {
                if (!isQuestion(m, Protocol.KIND_BUTTONS, null)) {
                    continue;
                }
                if (isPriority(m)) {
                    assertEquals(meaning(m, 1), Protocol.MEANING_PASS, m.toString());
                    final String second = meaning(m, 2);
                    assertTrue(Protocol.MEANING_END_TURN.equals(second) || Protocol.MEANING_UNDO.equals(second), m.toString());
                    seconds.add(second);
                } else if (isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK) || isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK_DECLARED)) {
                    continue;
                } else {
                    others++;
                    assertFalse(button(m, 1).has("meaning") || button(m, 2).has("meaning"), "a meaning outside the priority: " + m);
                }
            }
        }
        assertTrue(seconds.contains(Protocol.MEANING_END_TURN), seconds.toString());
        assertTrue(others > 10, others + " other buttons questions");
    }

    /**
     * End Turn is Forge's auto-pass until the end of the turn: pressed at
     * the first priority of the player's first main phase in a turn in which
     * the unchanged game went on to attack, the attack is left out and
     * Forge asks for nothing more at priority in that turn.
     */
    @Test
    public void endTurnPassesPriorityUntilTheTurnEnds() {
        final int turn = firstTurnWithPriorityBeforeAnAttack(gameA);
        final int[] pressedAt = {-1};
        final Recorder ended = new Recorder(new ScriptedHuman()) {
            @Override
            JsonObject override() {
                final JsonObject q = openPriority();
                if (pressedAt[0] >= 0 || q == null || state == null || state.get("turn").getAsInt() != turn || !myTurn(state)
                        || !"MAIN1".equals(state.get("phase").getAsString()) || !Protocol.MEANING_END_TURN.equals(meaning(q, 2))) {
                    return null;
                }
                pressedAt[0] = messages.size();
                return pressButton(q, 2);
            }
        }.play(SmokeDecks.humanMatchRequest(SEED_A));

        assertTrue(pressedAt[0] >= 0, "End Turn was never pressed in turn " + turn);
        JsonObject state = null;
        int askedLater = 0;
        for (int i = pressedAt[0]; i < ended.messages.size(); i++) {
            final JsonObject m = ended.messages.get(i);
            if (Protocol.STATE.equals(type(m))) {
                state = m;
                continue;
            }
            if (!Protocol.QUESTION.equals(type(m)) || state == null) {
                continue;
            }
            if (state.get("turn").getAsInt() == turn) {
                assertFalse(isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK), "Forge asked for attackers after End Turn: " + m);
                assertFalse(isPriority(m), "Forge asked at priority again in the ended turn: " + where(state));
            } else if (isPriority(m)) {
                askedLater++;
            }
        }
        assertTrue(askedLater > 0, "the game went on with priorities in later turns");
        assertNotNull(ended.player.end(), "the game ended");
    }

    /**
     * End Turn gives the rest of the turn away, but not the answer to the
     * opponent: Forge's End Turn yields until the end of the turn and stops
     * for an opponent's spell or attack (Forge's interrupts, on by default -
     * what the app's dialog promises). Pressed at a quiet priority of an AI
     * turn in which the unchanged game went on to see the AI cast a spell -
     * and of one in which it attacked -, Forge asks again exactly there, not
     * at another quiet moment of that turn.
     */
    @Test
    public void endTurnStillStopsForTheOpponentsSpellOrAttack() throws IOException {
        final JsonObject fixture = fixture("priority-respond");
        for (final String interrupt : List.of("spell", "attack")) {
            final int turn = firstOpponentTurnWithAQuietPriorityBefore(respond, interrupt);
            final int[] pressedAt = {-1};
            final Recorder ended = new Recorder(ScriptedHuman.fromPolicy(fixture.getAsJsonObject("player"))) {
                @Override
                JsonObject override() {
                    final JsonObject q = openPriority();
                    if (pressedAt[0] >= 0 || q == null || state == null || state.get("turn").getAsInt() != turn || myTurn(state)
                            || !quiet(state) || !Protocol.MEANING_END_TURN.equals(meaning(q, 2))) {
                        return null;
                    }
                    pressedAt[0] = messages.size();
                    return pressButton(q, 2);
                }
            }.play(request(fixture));

            assertTrue(pressedAt[0] >= 0, "End Turn was never pressed in the AI's turn " + turn);
            JsonObject state = null;
            JsonObject asked = null;
            for (int i = pressedAt[0]; i < ended.messages.size() && asked == null; i++) {
                final JsonObject m = ended.messages.get(i);
                if (Protocol.STATE.equals(type(m))) {
                    state = m;
                } else if (isPriority(m) && state != null && state.get("turn").getAsInt() == turn) {
                    asked = state;
                }
            }
            assertNotNull(asked, "Forge never asked again in the AI's turn " + turn + " (" + interrupt + ")");
            assertEquals(interruptOf(asked), interrupt, "the first priority after End Turn: " + where(asked));
            assertNotNull(ended.player.end(), "the game ended");
        }
    }

    /** Nothing on the stack, nobody attacking: a priority Forge gives only because the player could act. */
    private static boolean quiet(final JsonObject state) {
        return state.getAsJsonArray("stack").isEmpty() && state.getAsJsonArray("combat").isEmpty();
    }

    /** What a priority in the AI's turn answers: the AI's spell on top ("spell"), its attack ("attack"), or nothing ("quiet"). */
    private static String interruptOf(final JsonObject state) {
        final JsonArray stack = state.getAsJsonArray("stack");
        if (!stack.isEmpty()) {
            return stack.get(0).getAsJsonObject().get("player").equals(state.get("me")) ? "own" : "spell";
        }
        return state.getAsJsonArray("combat").isEmpty() ? "quiet" : "attack";
    }

    /** The first AI turn with a quiet priority of the player whose first other priority answers the given interrupt. */
    private static int firstOpponentTurnWithAQuietPriorityBefore(final Recorder game, final String interrupt) {
        JsonObject state = null;
        final Set<Integer> quiet = new TreeSet<>();
        final Set<Integer> decided = new TreeSet<>();
        for (final JsonObject m : game.messages) {
            if (Protocol.STATE.equals(type(m))) {
                state = m;
                continue;
            }
            if (!isPriority(m) || state == null || myTurn(state) || state.get("turn").getAsInt() < 3) {
                continue;
            }
            final int turn = state.get("turn").getAsInt();
            if (decided.contains(turn)) {
                continue;
            }
            final String now = interruptOf(state);
            if ("quiet".equals(now)) {
                if (Protocol.MEANING_END_TURN.equals(meaning(m, 2))) {
                    quiet.add(turn);
                }
                continue;
            }
            decided.add(turn);
            if (now.equals(interrupt) && quiet.contains(turn)) {
                return turn;
            }
        }
        throw new AssertionError("no AI turn with a quiet priority before its " + interrupt);
    }

    /** The first turn of the player in which Forge asked at priority in the first main phase and later for attackers. */
    private static int firstTurnWithPriorityBeforeAnAttack(final Recorder game) {
        JsonObject state = null;
        final Set<Integer> priorityInMain1 = new TreeSet<>();
        for (final JsonObject m : game.messages) {
            if (Protocol.STATE.equals(type(m))) {
                state = m;
                continue;
            }
            if (state == null || !myTurn(state)) {
                continue;
            }
            final int turn = state.get("turn").getAsInt();
            if (isPriority(m) && "MAIN1".equals(state.get("phase").getAsString()) && Protocol.MEANING_END_TURN.equals(meaning(m, 2)) && turn >= 3) {
                priorityInMain1.add(turn);
            }
            if (isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK) && priorityInMain1.contains(turn)) {
                return turn;
            }
        }
        throw new AssertionError("no turn with a priority in the first main phase before an attack");
    }

    /**
     * Undo takes the last mana ability back: a land of the player's tapped
     * for mana at priority (Forge's action "activate", not playable), Forge's
     * second button becomes Undo; pressing it untaps the land again.
     */
    @Test
    public void undoTakesAManaAbilityBack() {
        final int[] land = {-1};
        final int[] tappedAt = {-1};
        final int[] undoneAt = {-1};
        final Recorder undone = new Recorder(new ScriptedHuman()) {
            @Override
            JsonObject override() {
                final JsonObject q = openPriority();
                if (q == null || state == null || undoneAt[0] >= 0) {
                    return null;
                }
                if (tappedAt[0] < 0 && myTurn(state) && state.get("turn").getAsInt() >= 3) {
                    for (final JsonElement c : me(state).getAsJsonObject("zones").getAsJsonArray("battlefield")) {
                        final JsonObject card = c.getAsJsonObject();
                        if (card.has("id") && card.has("action") && !card.has("playable") && !card.get("tapped").getAsBoolean()
                                && !card.has("power")) {
                            land[0] = card.get("id").getAsInt();
                            tappedAt[0] = messages.size();
                            return tap(land[0]);
                        }
                    }
                }
                if (tappedAt[0] >= 0 && Protocol.MEANING_UNDO.equals(meaning(q, 2))) {
                    assertTrue(button(q, 2).get("label").getAsString().contains("(1)"), "one action to undo: " + q);
                    undoneAt[0] = messages.size();
                    return pressButton(q, 2);
                }
                return null;
            }
        }.play(SmokeDecks.humanMatchRequest(SEED_A));

        assertTrue(tappedAt[0] >= 0, "no untapped land with a mana ability at priority");
        assertTrue(undoneAt[0] >= 0, "after the land was tapped for mana Forge never offered Undo");
        boolean tapped = false;
        for (int i = tappedAt[0]; i < undoneAt[0]; i++) {
            final JsonObject m = undone.messages.get(i);
            if (Protocol.STATE.equals(type(m)) && find(me(m), land[0]) != null && find(me(m), land[0]).get("tapped").getAsBoolean()) {
                tapped = true;
            }
        }
        assertTrue(tapped, "the land was tapped for mana before Undo");
        JsonObject after = null;
        String nextSecond = null;
        for (int i = undoneAt[0]; i < undone.messages.size() && nextSecond == null; i++) {
            final JsonObject m = undone.messages.get(i);
            if (Protocol.STATE.equals(type(m)) && after == null) {
                after = m;
            } else if (isPriority(m)) {
                nextSecond = meaning(m, 2);
            }
        }
        assertNotNull(after, "no state after Undo");
        assertNotNull(find(me(after), land[0]), "the land left the battlefield");
        assertFalse(find(me(after), land[0]).get("tapped").getAsBoolean(), "Undo untapped the land");
        assertEquals(nextSecond, Protocol.MEANING_END_TURN, "nothing left to undo");
        assertNotNull(undone.player.end(), "the game ended");
    }

    private static JsonObject find(final JsonObject player, final int id) {
        for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray("battlefield")) {
            final JsonObject card = c.getAsJsonObject();
            if (card.has("id") && card.get("id").getAsInt() == id) {
                return card;
            }
        }
        return null;
    }

    // ── The stack ─────────────────────────────────────────────────────────────────

    /**
     * Every stack item names its card: a spell's own card (in no zone of the
     * state), an ability's source; the same id as the source, never marked
     * usable, a trigger always an ability.
     */
    @Test
    public void stackItemsCarryTheirCard() {
        int spells = 0;
        int abilities = 0;
        int opponents = 0;
        for (final Recorder game : List.of(gameA, gameB, respond)) {
            for (final JsonObject m : game.messages) {
                if (!Protocol.STATE.equals(type(m))) {
                    continue;
                }
                final JsonElement me = m.get("me");
                for (final JsonElement e : m.getAsJsonArray("stack")) {
                    final JsonObject item = e.getAsJsonObject();
                    final JsonElement source = item.get("source");
                    final JsonElement card = item.get("card");
                    assertNotNull(card, "stack item without card: " + item);
                    if (source.isJsonNull()) {
                        assertTrue(card.isJsonNull() || card.getAsJsonObject().has("hidden"), item.toString());
                        continue;
                    }
                    final JsonObject view = card.getAsJsonObject();
                    assertEquals(view.get("id").getAsInt(), source.getAsInt(), item.toString());
                    assertTrue(view.has("key") && view.has("name"), item.toString());
                    for (final String marker : new String[]{"playable", "action", "ways"}) {
                        assertFalse(view.has(marker), "a card on the stack marked " + marker + ": " + item);
                    }
                    if (item.get("trigger").getAsBoolean()) {
                        assertTrue(item.get("ability").getAsBoolean(), "a trigger is an ability: " + item);
                    }
                    if (item.get("ability").getAsBoolean()) {
                        abilities++;
                    } else {
                        spells++;
                    }
                    if (!item.get("player").equals(me)) {
                        opponents++;
                    }
                }
            }
        }
        assertTrue(spells > 0, "spells on the stack");
        assertTrue(abilities > 0, "abilities on the stack");
        assertTrue(opponents > 0, "the AI's items on the stack");
    }

    /**
     * The respond player answers the AI's spells: at a priority with the
     * AI's spell on top it taps what Forge marks playable, and its answer
     * lies on top of the AI's spell.
     */
    @Test
    public void thePlayerAnswersTheOpponentsSpellOnTheStack() {
        JsonObject state = null;
        int toAnswer = 0;
        int answersOnTop = 0;
        for (final JsonObject m : respond.messages) {
            if (Protocol.STATE.equals(type(m))) {
                state = m;
                final JsonArray stack = m.getAsJsonArray("stack");
                if (stack.size() >= 2 && stack.get(0).getAsJsonObject().get("player").equals(m.get("me"))
                        && !stack.get(1).getAsJsonObject().get("player").equals(m.get("me"))) {
                    answersOnTop++;
                }
                continue;
            }
            if (isPriority(m) && state != null && !state.getAsJsonArray("stack").isEmpty()
                    && !state.getAsJsonArray("stack").get(0).getAsJsonObject().get("player").equals(state.get("me"))) {
                toAnswer++;
            }
        }
        assertTrue(toAnswer > 0, "no priority with the AI's spell on top");
        assertTrue(count(respond, "tap:priority-response") > 0, respond.player.counters().toString());
        assertTrue(answersOnTop > 0, "the player's answer never lay on top of the AI's spell");
    }

    // ── Looking must not change the game ──────────────────────────────────────────

    /**
     * During priority and payment Forge answers "what would a tap do" by
     * setting the player as the activating player of the card's abilities
     * (prompt 05, §7.2). The opponent's cards are only asked when Forge marks
     * them usable; the player's own cards keep their actions.
     */
    @Test
    public void askingWhatATapWouldDoLeavesTheOpponentsCardsAlone() {
        int own = 0;
        int opponents = 0;
        for (final Recorder game : List.of(gameA, gameB, respond)) {
            JsonObject state = null;
            for (final JsonObject m : game.messages) {
                if (Protocol.STATE.equals(type(m))) {
                    state = m;
                    continue;
                }
                if (state == null || !(isPriority(m) || isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_PAYMENT))) {
                    continue;
                }
                final JsonElement me = state.get("me");
                for (final JsonObject card : visibleCards(state)) {
                    if (!card.has("action")) {
                        continue;
                    }
                    if (card.get("controller").equals(me)) {
                        own++;
                    } else {
                        opponents++;
                        assertTrue(card.has("playable"), "an opponent's card asked at " + where(state) + ": " + card);
                    }
                }
            }
        }
        assertTrue(own > 20, own + " own cards with actions at priority and payment");
        assertEquals(opponents, 0, "the test decks give the player nothing of the AI's to use");
    }

    // ── Selections ────────────────────────────────────────────────────────────────

    /** A selection's ids are exactly the ids of its visible items; a hidden card is a hidden item without id. */
    @Test
    public void aSelectionNamesOnlyCardsThePlayerMaySee() {
        int selections = 0;
        for (final Recorder game : List.of(gameA, gameB, respond)) {
            for (final JsonObject m : game.messages) {
                if (!isQuestion(m, Protocol.KIND_SELECT, null)) {
                    continue;
                }
                selections++;
                final Set<Integer> ids = new TreeSet<>();
                m.getAsJsonArray("cards").forEach(e -> ids.add(e.getAsInt()));
                final Set<Integer> visible = new TreeSet<>();
                for (final JsonElement e : m.getAsJsonArray("items")) {
                    final JsonObject item = e.getAsJsonObject();
                    if (item.has("hidden")) {
                        assertFalse(item.has("card"), m.toString());
                    } else if (item.has("card")) {
                        visible.add(item.get("card").getAsInt());
                    }
                }
                assertEquals(ids, visible, m.toString());
            }
        }
        assertTrue(selections >= 3, selections + " selections");
    }
}
