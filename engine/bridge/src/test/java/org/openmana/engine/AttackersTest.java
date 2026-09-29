package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.bridge.RunningInput;
import org.openmana.engine.smoke.ReplayHost;
import org.openmana.engine.smoke.ScriptedHuman;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.openmana.engine.Recorder.count;
import static org.openmana.engine.Recorder.fixture;
import static org.openmana.engine.Recorder.isQuestion;
import static org.openmana.engine.Recorder.nextState;
import static org.openmana.engine.Recorder.player;
import static org.openmana.engine.Recorder.rejectionOf;
import static org.openmana.engine.Recorder.request;
import static org.openmana.engine.Recorder.type;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertNull;
import static org.testng.Assert.assertTrue;

/**
 * Prompt 18: declaring attackers through the bridge (protocol 7), in the real
 * game of the differential fixture {@code attackers} (green creatures - some
 * cast this turn, Llanowar Elves tapped for mana, Wall of Wood with defender
 * - against green planeswalkers), with every message the bridge sends
 * recorded:
 * <ul>
 *   <li>the declaration is in the state exactly while Forge's attack input
 *       runs; its defender is one of the defenders Forge offers;</li>
 *   <li>every creature of the player not attacking yet is either offered
 *       (Forge's attack action) or named unavailable with Forge's reason -
 *       never both -, and a tap on an unavailable one is refused
 *       (no-effect): Forge agrees;</li>
 *   <li>tapped and summoning sick are what the state shows;</li>
 *   <li>a tap on a defender that is not the defender makes it the defender
 *       (a planeswalker's card, the player again), a tap on the defender or
 *       on the player themself is refused;</li>
 *   <li>Forge's buttons of the declaration say what they do (declare,
 *       attackAll, callBack);</li>
 *   <li>asking changes nothing: the same inputs without asking give Forge's
 *       identical game log.</li>
 * </ul>
 */
public class AttackersTest {

    private Recorder game;

    @BeforeClass
    public void playGame() throws Exception {
        EngineTestSupport.boot();
        final JsonObject fixture = fixture("attackers");
        game = new Recorder(ScriptedHuman.fromPolicy(fixture.getAsJsonObject("player"))).play(request(fixture));
        assertNotNull(game.result, "the game ended");
        for (final Map.Entry<String, Integer> e : game.player.counters().entrySet()) {
            assertFalse(e.getKey().startsWith("protocol:"), "protocol violation " + e);
        }
    }

    private static boolean attackOpen(final Map<Long, JsonObject> open) {
        return open.values().stream().anyMatch(q -> isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK)
                || isQuestion(q, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK_DECLARED));
    }

    private static Map<Integer, JsonObject> myBattlefield(final JsonObject state) {
        final Map<Integer, JsonObject> cards = new TreeMap<>();
        for (final JsonElement c : player(state, true).getAsJsonObject("zones").getAsJsonArray("battlefield")) {
            final JsonObject card = c.getAsJsonObject();
            cards.put(card.get("id").getAsInt(), card);
        }
        return cards;
    }

    private static Map<Integer, String> unavailable(final JsonObject state) {
        final Map<Integer, String> reasons = new TreeMap<>();
        for (final JsonElement e : state.getAsJsonObject("attack").getAsJsonArray("unavailable")) {
            reasons.put(e.getAsJsonObject().get("card").getAsInt(), e.getAsJsonObject().get("reason").getAsString());
        }
        return reasons;
    }

    // ── The declaration in the state ──────────────────────────────────────────────

    /**
     * Before every input: the state carries the declaration exactly while
     * Forge's attack buttons are open (no blocking question), its defender is
     * one of the defenders, the opponent is always a defender; every creature
     * of the player not attacking yet either has Forge's attack action or is
     * unavailable with a reason, never both; tapped and summoning sick match
     * the card.
     */
    @Test
    public void everyCreatureIsOfferedOrUnavailableWithForgesReason() {
        final Map<Long, JsonObject> open = new LinkedHashMap<>();
        final Set<String> reasons = new HashSet<>();
        int declarations = 0;
        JsonObject state = null;
        for (final JsonObject m : game.messages) {
            switch (type(m)) {
                case Protocol.STATE -> state = m;
                case Protocol.QUESTION -> open.put(m.get("id").getAsLong(), m);
                case Protocol.QUESTION_ANSWERED, Protocol.QUESTION_WITHDRAWN -> open.remove(m.get("id").getAsLong());
                case "sent" -> {
                    if (state == null || open.values().stream().anyMatch(q -> q.get("blocking").getAsBoolean())) {
                        continue;
                    }
                    assertEquals(state.has("attack"), attackOpen(open), "attack in the state " + state.get("attack") + " while open: " + open.values());
                    if (!state.has("attack")) {
                        continue;
                    }
                    declarations++;
                    final JsonObject attack = state.getAsJsonObject("attack");
                    final JsonArray defenders = attack.getAsJsonArray("defenders");
                    assertTrue(defenders.contains(attack.get("defender")), "the defender is not offered: " + attack);
                    final JsonObject opponent = new JsonObject();
                    opponent.addProperty("kind", "player");
                    opponent.addProperty("id", player(state, false).get("id").getAsInt());
                    assertTrue(defenders.contains(opponent), "the opponent is no defender: " + attack);
                    final Map<Integer, String> refused = unavailable(state);
                    for (final Map.Entry<Integer, JsonObject> e : myBattlefield(state).entrySet()) {
                        final JsonObject card = e.getValue();
                        final String reason = refused.get(e.getKey());
                        if (reason == null) {
                            continue;
                        }
                        reasons.add(reason);
                        assertFalse(card.has("action") || card.has("attacking"), "unavailable yet offered: " + card);
                        if (Protocol.ATTACK_REFUSAL_TAPPED.equals(reason)) {
                            assertTrue(card.get("tapped").getAsBoolean(), card.toString());
                        }
                        if (Protocol.ATTACK_REFUSAL_SICK.equals(reason)) {
                            assertTrue(card.get("sick").getAsBoolean(), card.toString());
                        }
                    }
                    for (final int id : refused.keySet()) {
                        assertTrue(myBattlefield(state).containsKey(id), "unavailable card " + id + " is not on the player's battlefield");
                    }
                }
                default -> { }
            }
        }
        assertTrue(declarations > 5, declarations + " inputs during declarations");
        assertTrue(reasons.containsAll(Set.of(Protocol.ATTACK_REFUSAL_SICK, Protocol.ATTACK_REFUSAL_TAPPED, Protocol.ATTACK_REFUSAL_RESTRICTED)), reasons.toString());
    }

    /** Forge's buttons of the declaration carry their meaning: OK declares, the second is Alpha Strike or (attackers declared) Call Back. */
    @Test
    public void theDeclarationsButtonsSayWhatTheyDo() {
        int seen = 0;
        for (final JsonObject m : game.messages) {
            final boolean first = isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK);
            final boolean declared = isQuestion(m, Protocol.KIND_BUTTONS, Protocol.PURPOSE_ATTACK_DECLARED);
            if (!first && !declared) {
                continue;
            }
            seen++;
            for (final JsonElement b : m.getAsJsonArray("buttons")) {
                final JsonObject button = b.getAsJsonObject();
                final String expected = button.get("nr").getAsInt() == 1 ? Protocol.MEANING_DECLARE
                        : first ? Protocol.MEANING_ATTACK_ALL : Protocol.MEANING_CALL_BACK;
                assertEquals(button.has("meaning") ? button.get("meaning").getAsString() : null, expected, m.toString());
            }
        }
        assertTrue(seen > 3, seen + " declarations");
    }

    // ── Defenders ─────────────────────────────────────────────────────────────────

    /**
     * Every tap of the scripted player on a defender other than the current
     * one (the planeswalker's card, the opponent again) was taken, and the
     * next state names it the defender; the opponent is marked selectable
     * exactly while it is a defender that is not the defender.
     */
    @Test
    public void tappingAnotherDefenderMakesItTheDefender() {
        int switches = 0;
        boolean toCard = false;
        boolean toPlayer = false;
        JsonObject state = null;
        final Map<Long, JsonObject> open = new LinkedHashMap<>();
        for (int i = 0; i < game.messages.size(); i++) {
            final JsonObject m = game.messages.get(i);
            switch (type(m)) {
                case Protocol.STATE -> {
                    state = m;
                    if (m.has("attack")) {
                        final JsonObject attack = m.getAsJsonObject("attack");
                        final JsonObject opponent = player(m, false);
                        final JsonObject ref = new JsonObject();
                        ref.addProperty("kind", "player");
                        ref.addProperty("id", opponent.get("id").getAsInt());
                        assertEquals(opponent.has("selectable"), !ref.equals(attack.get("defender")), "opponent selectable while defender " + attack.get("defender"));
                        assertFalse(player(m, true).has("selectable"), "the player can never attack themself");
                    }
                }
                case Protocol.QUESTION -> open.put(m.get("id").getAsLong(), m);
                case Protocol.QUESTION_ANSWERED, Protocol.QUESTION_WITHDRAWN -> open.remove(m.get("id").getAsLong());
                case "sent" -> {
                    final JsonObject input = m.getAsJsonObject("input");
                    if (state == null || !state.has("attack") || !attackOpen(open)) {
                        continue;
                    }
                    final JsonObject ref = new JsonObject();
                    if (Protocol.CARD_TAP.equals(type(input))) {
                        ref.addProperty("kind", "card");
                        ref.addProperty("id", input.get("card").getAsInt());
                    } else if (Protocol.PLAYER_TAP.equals(type(input))) {
                        ref.addProperty("kind", "player");
                        ref.addProperty("id", input.get("player").getAsInt());
                    } else {
                        continue;
                    }
                    final JsonObject attack = state.getAsJsonObject("attack");
                    if (!attack.getAsJsonArray("defenders").contains(ref) || ref.equals(attack.get("defender"))) {
                        continue;
                    }
                    switches++;
                    toCard |= "card".equals(ref.get("kind").getAsString());
                    toPlayer |= "player".equals(ref.get("kind").getAsString());
                    assertNull(rejectionOf(game.messages, input.get("seq").getAsLong()), "a tap on a defender was refused");
                    final JsonObject after = nextState(game.messages, i);
                    assertNotNull(after);
                    assertTrue(after.has("attack"), "the declaration ended with a defender tap");
                    assertEquals(after.getAsJsonObject("attack").get("defender"), ref, "the tapped defender is not the defender");
                }
                default -> { }
            }
        }
        assertTrue(switches >= 2 && toCard && toPlayer, switches + " defender switches, to a card " + toCard + ", to the player " + toPlayer);
        assertTrue(count(game, "attack:attacker-for-card") >= 1, game.player.counters().toString());
    }

    /**
     * Taps Forge would not take while attackers are declared are refused
     * (no-effect) and change nothing: the player themself, the defender
     * again, and a creature the state names unavailable - Forge agrees with
     * the reason. The game then goes on as the scripted player plays it.
     */
    @Test
    public void tapsTheDeclarationWouldNotTakeAreRefused() throws Exception {
        final String[] tried = new String[3];
        final Recorder refused = new Recorder(ScriptedHuman.fromPolicy(fixture("attackers").getAsJsonObject("player"))) {
            @Override
            JsonObject override() {
                if (state == null || !state.has("attack") || !attackOpen(open)) {
                    return null;
                }
                final JsonObject o = new JsonObject();
                if (tried[0] == null) {
                    tried[0] = "me";
                    o.addProperty("type", Protocol.PLAYER_TAP);
                    o.addProperty("player", player(state, true).get("id").getAsInt());
                    return o;
                }
                final JsonObject defender = state.getAsJsonObject("attack").get("defender").isJsonNull() ? null : state.getAsJsonObject("attack").getAsJsonObject("defender");
                if (tried[1] == null && defender != null && "player".equals(defender.get("kind").getAsString())) {
                    tried[1] = "defender";
                    o.addProperty("type", Protocol.PLAYER_TAP);
                    o.addProperty("player", defender.get("id").getAsInt());
                    return o;
                }
                final Map<Integer, String> unavailable = unavailable(state);
                if (tried[2] == null && !unavailable.isEmpty()) {
                    final Map.Entry<Integer, String> first = unavailable.entrySet().iterator().next();
                    tried[2] = first.getValue();
                    o.addProperty("type", Protocol.CARD_TAP);
                    o.addProperty("card", first.getKey());
                    return o;
                }
                return null;
            }
        }.play(request(fixture("attackers")));
        assertEquals(refused.own.size(), 3, "not every refused tap could be tried: " + java.util.Arrays.toString(tried));
        for (final long seq : refused.own) {
            final JsonObject rejection = rejectionOf(refused.messages, seq);
            assertNotNull(rejection, "input " + seq + " was not refused");
            assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_NO_EFFECT, rejection.toString());
        }
        assertNotNull(refused.result, "the game went on to its end");
    }

    // ── Asking changes nothing ────────────────────────────────────────────────────

    /**
     * Asking Forge about the declaration (why a creature may not attack, the
     * defender, the players a click would take) must not change the game:
     * the very inputs of the recorded game replayed without asking give
     * Forge's identical game log.
     */
    @Test
    public void askingAboutTheDeclarationChangesNothing() throws Exception {
        final JsonArray inputs = new JsonArray();
        game.inputs.forEach(inputs::add);
        final JsonObject unasked;
        RunningInput.setAskingForTests(false);
        try {
            unasked = HumanMatch.play(new ReplayHost(inputs), request(fixture("attackers")));
        } finally {
            RunningInput.setAskingForTests(true);
        }
        assertEquals(unasked.get("logSha256"), game.result.get("logSha256"), "Forge's game log differs without asking");
        assertEquals(unasked.get("turns"), game.result.get("turns"));
        assertEquals(unasked.get("inputs"), game.result.get("inputs"));
    }
}
