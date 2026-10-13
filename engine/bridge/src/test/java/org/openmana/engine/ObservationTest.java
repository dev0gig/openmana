package org.openmana.engine;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.ScriptedHuman;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.openmana.engine.Recorder.fixture;
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
 * Prompt 48, protocol 10: Forge's public actions as observations, and the
 * engine waiting at stable points until an observation is released - in the
 * real game of the differential fixture {@code priority-respond} (red
 * instants held for answers against green creatures: the AI plays lands,
 * casts creatures, attacks; the player answers on the stack in the AI's
 * turn), once without holds and once with ({@code priority-respond-observe}):
 * <ul>
 *   <li>the same inputs give the same game: Forge's game log, the engine
 *       trace entry by entry, the result - releasing an observation decides
 *       nothing;</li>
 *   <li>the observations are the same in both modes but for the hold flag
 *       (and the state number they follow);</li>
 *   <li>the AI's land, spells, attack and the resolution and combat damage
 *       with their public results are observed; every action once, numbered
 *       without gaps; never a card the player did not see;</li>
 *   <li>while an observation is held: no question, no other observation; an
 *       answer or a tap is refused (observing), a release of another
 *       observation (not held, old) is refused (stale), a state request is
 *       served, a settings change is taken; only the release of exactly that
 *       observation ends it;</li>
 *   <li>a real question of the player comes after the release, never while
 *       held, and an observation sent right before it never holds;</li>
 *   <li>a concession ends a held observation and the game; switching the
 *       mode off releases it;</li>
 *   <li>Forge's auto-pass setting: never - Forge asks at priorities where the
 *       player can do nothing; the default asks there never.</li>
 * </ul>
 */
public class ObservationTest {

    private Recorder plain;
    private Recorder held;

    private static JsonObject observeRequest() throws Exception {
        final JsonObject request = request(fixture("priority-respond"));
        final JsonObject settings = new JsonObject();
        settings.addProperty("observation", Protocol.OBSERVATION_HOLD);
        request.add("settings", settings);
        request.addProperty("trace", true);
        return request;
    }

    private static ScriptedHuman scripted(final boolean faults) throws Exception {
        final JsonObject policy = fixture("priority-respond").getAsJsonObject("player").deepCopy();
        if (faults) {
            policy.addProperty("observeFaults", true);
        }
        return ScriptedHuman.fromPolicy(policy);
    }

    @BeforeClass
    public void playGames() throws Exception {
        EngineTestSupport.boot();
        final JsonObject base = request(fixture("priority-respond"));
        base.addProperty("trace", true);
        plain = new Recorder(scripted(false)).play(base);
        held = new Recorder(scripted(true)).play(observeRequest());
        for (final Recorder r : List.of(plain, held)) {
            assertNotNull(r.result, "the game ended");
            for (final Map.Entry<String, Integer> e : r.player.counters().entrySet()) {
                assertFalse(e.getKey().startsWith("protocol:"), "protocol violation " + e + " in " + r.player.counters());
            }
        }
    }

    private static List<JsonObject> ofType(final Recorder r, final String type) {
        final List<JsonObject> out = new ArrayList<>();
        for (final JsonObject m : r.messages) {
            if (type.equals(type(m))) {
                out.add(m);
            }
        }
        return out;
    }

    // ── The same game ─────────────────────────────────────────────────────────────

    /** Holding and releasing decide nothing: the same game, entry by entry of the engine trace. */
    @Test
    public void holdsDoNotChangeTheGame() {
        assertEquals(held.result.get("logSha256"), plain.result.get("logSha256"), "Forge's game log");
        assertEquals(held.result.get("turns"), plain.result.get("turns"));
        assertEquals(held.result.get("result"), plain.result.get("result"));
        final List<JsonObject> a = ofType(plain, Protocol.DIAGNOSTICS_TRACE);
        final List<JsonObject> b = ofType(held, Protocol.DIAGNOSTICS_TRACE);
        assertEquals(b.size(), a.size(), "trace entries");
        for (int i = 0; i < a.size(); i++) {
            assertEquals(b.get(i), a.get(i), "trace entry " + (i + 1));
        }
        assertTrue(held.player.counters().getOrDefault("observation:held", 0) >= 5, "holds: " + held.player.counters());
        assertEquals(plain.player.counters().getOrDefault("observation:held", 0), Integer.valueOf(0));
    }

    /** The observations are the same in both modes, but for the hold flag and the state they follow. */
    @Test
    public void observationsAreTheSameButForTheHold() {
        final List<JsonObject> a = ofType(plain, Protocol.OBSERVATION);
        final List<JsonObject> b = ofType(held, Protocol.OBSERVATION);
        assertEquals(b.size(), a.size());
        assertTrue(a.size() > 20, "observations: " + a.size());
        for (int i = 0; i < a.size(); i++) {
            final JsonObject x = a.get(i).deepCopy();
            final JsonObject y = b.get(i).deepCopy();
            assertFalse(x.get("hold").getAsBoolean());
            for (final JsonObject o : List.of(x, y)) {
                o.remove("hold");
                o.remove("state");
            }
            assertEquals(y, x, "observation " + (i + 1));
        }
    }

    // ── What is observed ──────────────────────────────────────────────────────────

    /** The AI's land, spell and attack, resolutions and combat damage with public results; turns. */
    @Test
    public void theOpponentsTurnIsObserved() {
        final Map<String, Integer> c = held.player.counters();
        for (final String key : List.of("action:turn:me", "action:turn:opponent", "action:turnEnd:opponent",
                "action:land:opponent", "action:cast:opponent", "action:resolve:opponent", "action:attack:opponent",
                "action:combatDamage:opponent", "action:land:me", "action:cast:me", "action:resolve:me")) {
            assertTrue(c.getOrDefault(key, 0) > 0, key + " in " + c);
        }
        boolean landCard = false;
        boolean resolvedOntoBattlefield = false;
        boolean combatResult = false;
        final int me = player(held.state, true).get("id").getAsInt();
        for (final JsonObject o : ofType(held, Protocol.OBSERVATION)) {
            for (final JsonElement e : o.getAsJsonArray("actions")) {
                final JsonObject a = e.getAsJsonObject();
                final String kind = a.get("kind").getAsString();
                final boolean opponent = a.get("player").isJsonPrimitive() && a.get("player").getAsInt() != me;
                if ("land".equals(kind) && opponent) {
                    final JsonObject card = a.getAsJsonObject("card");
                    assertTrue(card.has("key") && card.has("id"), "a played land is public: " + a);
                    landCard = true;
                }
                if ("resolve".equals(kind) && opponent) {
                    for (final JsonElement m : a.getAsJsonObject("results").getAsJsonArray("moves")) {
                        final JsonObject move = m.getAsJsonObject();
                        if (!move.get("to").isJsonNull() && "battlefield".equals(move.getAsJsonObject("to").get("zone").getAsString())) {
                            resolvedOntoBattlefield = true;
                        }
                    }
                }
                if ("combatDamage".equals(kind)) {
                    final JsonObject r = a.getAsJsonObject("results");
                    if (r.getAsJsonArray("damage").size() > 0 && r.getAsJsonArray("life").size() > 0) {
                        combatResult = true;
                    }
                }
            }
        }
        assertTrue(landCard, "the AI's land with its card");
        assertTrue(resolvedOntoBattlefield, "the AI's creature spell resolving onto the battlefield");
        assertTrue(combatResult, "combat damage with damage and a life total");
    }

    // ── Holding ───────────────────────────────────────────────────────────────────

    /**
     * Between a held observation and its release: no question, no other
     * observation; only the inputs the protocol allows are taken, the others
     * refused with their reason; it ends with the release of exactly it.
     */
    @Test
    public void aHeldObservationWaitsForItsRelease() {
        JsonObject holding = null;
        int holds = 0;
        int refusedObserving = 0;
        int refusedStale = 0;
        int statesServed = 0;
        int settingsTaken = 0;
        for (final JsonObject m : held.messages) {
            switch (type(m)) {
                case Protocol.OBSERVATION -> {
                    assertNull(holding, "an observation while one is held");
                    if (m.get("hold").getAsBoolean()) {
                        holding = m;
                        holds++;
                    }
                }
                case Protocol.QUESTION -> assertNull(holding, "a question while an observation is held");
                case Protocol.STATE -> {
                    if (holding != null) {
                        statesServed++;
                    }
                }
                case Protocol.SETTINGS_APPLIED -> {
                    if (holding != null) {
                        settingsTaken++;
                    }
                }
                case Protocol.OBSERVATION_RELEASED -> {
                    assertNotNull(holding, "released without a hold");
                    assertEquals(m.get("id").getAsLong(), holding.get("id").getAsLong());
                    assertEquals(m.get("by").getAsString(), Protocol.RELEASED_BY_RELEASE);
                    final JsonObject input = held.inputs.get((int) m.get("seq").getAsLong() - 1);
                    assertEquals(input.get("type").getAsString(), Protocol.OBSERVATION_RELEASE);
                    assertEquals(input.get("observation").getAsLong(), holding.get("id").getAsLong());
                    holding = null;
                }
                case "sent" -> {
                    if (holding == null) {
                        continue;
                    }
                    final JsonObject input = m.getAsJsonObject("input");
                    final String t = input.get("type").getAsString();
                    final JsonObject rejection = rejectionOf(held.messages, input.get("seq").getAsLong());
                    switch (t) {
                        case Protocol.CARD_TAP, Protocol.ANSWER -> {
                            assertNotNull(rejection, "refused while held: " + input);
                            assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_OBSERVING);
                            refusedObserving++;
                        }
                        case Protocol.OBSERVATION_RELEASE -> {
                            if (input.get("observation").getAsLong() != holding.get("id").getAsLong()) {
                                assertNotNull(rejection, "a release of another observation is refused");
                                assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_STALE);
                                refusedStale++;
                            } else {
                                assertNull(rejection);
                            }
                        }
                        case Protocol.STATE_REQUEST, Protocol.SETTINGS_CHANGE -> assertNull(rejection, input.toString());
                        default -> throw new AssertionError("unexpected input while held: " + input);
                    }
                }
                default -> { }
            }
        }
        assertNull(holding, "a hold left open");
        assertTrue(holds >= 5);
        assertEquals(refusedObserving, 2, "a card tap and an answer refused while held");
        assertEquals(refusedStale, 2, "a release of an observation not held and of an old one refused");
        assertTrue(statesServed >= 1, "the state request while held was served");
        assertEquals(settingsTaken, 1, "the settings change while held was taken");
    }

    /**
     * The player's real reaction in the AI's turn: Forge's priority question
     * comes after the held observation of the AI's spell was released, and an
     * observation right before a question never holds.
     */
    @Test
    public void aRealQuestionComesAfterTheReleaseAndIsNeverHeld() {
        final int me = player(held.state, true).get("id").getAsInt();
        boolean answeredAfterHeldCast = false;
        JsonObject lastHeldCast = null;
        JsonObject previous = null;
        JsonObject state = null;
        for (final JsonObject m : held.messages) {
            switch (type(m)) {
                case Protocol.STATE -> state = m;
                case Protocol.OBSERVATION -> {
                    if (m.get("hold").getAsBoolean()) {
                        for (final JsonElement e : m.getAsJsonArray("actions")) {
                            final JsonObject a = e.getAsJsonObject();
                            if ("cast".equals(a.get("kind").getAsString()) && a.get("player").getAsInt() != me) {
                                lastHeldCast = m;
                            }
                        }
                    }
                }
                case Protocol.QUESTION -> {
                    if (previous != null && Protocol.OBSERVATION.equals(type(previous))) {
                        assertFalse(previous.get("hold").getAsBoolean(), "an observation right before a question holds: " + previous);
                    }
                    if (lastHeldCast != null && state != null && state.get("activePlayer").getAsInt() != me
                            && m.has("purpose") && Protocol.PURPOSE_PRIORITY.equals(m.get("purpose").getAsString())) {
                        answeredAfterHeldCast = true;
                    }
                }
                default -> { }
            }
            if (!"sent".equals(type(m)) && !Protocol.STATE.equals(type(m)) && !Protocol.EVENTS.equals(type(m))
                    && !Protocol.MESSAGE.equals(type(m)) && !Protocol.DIAGNOSTICS_TRACE.equals(type(m))) {
                previous = m;
            }
        }
        assertTrue(answeredAfterHeldCast, "a priority question in the AI's turn after a held AI spell");
    }

    /** A concession while an observation is held ends the hold and the game at once. */
    @Test
    public void concedingWhileHeldEndsTheGame() throws Exception {
        final Recorder conceding = new Recorder(scripted(false)) {
            @Override
            JsonObject override() {
                final JsonObject last = messages.isEmpty() ? null : messages.get(messages.size() - 1);
                if (last != null && Protocol.OBSERVATION.equals(type(last)) && last.get("hold").getAsBoolean()
                        && last.get("id").getAsLong() >= 3) {
                    final JsonObject o = new JsonObject();
                    o.addProperty("type", Protocol.CONCEDE);
                    return o;
                }
                return null;
            }
        }.play(observeRequest());
        assertEquals(conceding.own.size(), 1, "one concession");
        final JsonObject end = conceding.result;
        assertTrue(end.get("conceded").getAsBoolean());
        final long seq = conceding.own.get(0);
        assertEquals(conceding.inputs.size(), seq, "no input after the concession");
        boolean released = false;
        for (final JsonObject m : conceding.messages) {
            if (Protocol.OBSERVATION_RELEASED.equals(type(m))) {
                if (m.get("seq").getAsLong() == seq) {
                    assertEquals(m.get("by").getAsString(), Protocol.RELEASED_BY_CONCEDE);
                    released = true;
                }
            }
        }
        assertTrue(released, "the hold ended by the concession");
    }

    /** Switching the mode off while an observation is held releases it; no hold follows. */
    @Test
    public void switchingTheModeOffReleasesTheHold() throws Exception {
        final Recorder off = new Recorder(scripted(false)) {
            private boolean switched;

            @Override
            JsonObject override() {
                final JsonObject last = messages.isEmpty() ? null : messages.get(messages.size() - 1);
                if (!switched && last != null && Protocol.OBSERVATION.equals(type(last)) && last.get("hold").getAsBoolean()) {
                    switched = true;
                    final JsonObject o = new JsonObject();
                    o.addProperty("type", Protocol.SETTINGS_CHANGE);
                    o.addProperty("observation", Protocol.OBSERVATION_OFF);
                    return o;
                }
                return null;
            }
        }.play(observeRequest());
        assertEquals(off.own.size(), 1);
        final long seq = off.own.get(0);
        boolean released = false;
        boolean afterwards = false;
        for (final JsonObject m : off.messages) {
            if (Protocol.OBSERVATION_RELEASED.equals(type(m)) && m.get("seq").getAsLong() == seq) {
                assertEquals(m.get("by").getAsString(), Protocol.RELEASED_BY_SETTINGS);
                released = true;
            } else if (released && Protocol.OBSERVATION.equals(type(m))) {
                assertFalse(m.get("hold").getAsBoolean(), "a hold after the mode was switched off");
                afterwards = true;
            } else if (Protocol.SETTINGS_APPLIED.equals(type(m)) && !m.get("seq").isJsonNull()) {
                assertEquals(m.get("seq").getAsLong(), seq);
                assertEquals(m.get("observation").getAsString(), Protocol.OBSERVATION_OFF);
            }
        }
        assertTrue(released && afterwards);
        assertEquals(off.result.get("logSha256"), plain.result.get("logSha256"), "the same game");
    }

    // ── Settings ──────────────────────────────────────────────────────────────────

    /** The settings at the start are confirmed once, with seq null. */
    @Test
    public void theStartSettingsAreConfirmed() {
        final List<JsonObject> applied = ofType(held, Protocol.SETTINGS_APPLIED);
        assertTrue(applied.get(0).get("seq").isJsonNull());
        assertEquals(applied.get(0).get("observation").getAsString(), Protocol.OBSERVATION_HOLD);
        assertEquals(applied.get(0).get("autoPass").getAsString(), Protocol.AUTO_PASS_NO_ACTIONS);
        assertEquals(ofType(plain, Protocol.SETTINGS_APPLIED).get(0).get("observation").getAsString(), Protocol.OBSERVATION_OFF);
    }

    /**
     * Forge's auto-pass: with "never" Forge asks at priorities where the
     * player can do nothing (canAct false); with the default never.
     */
    @Test
    public void autoPassNeverLetsForgeAskEveryPriority() throws Exception {
        final JsonObject request = request(fixture("priority-respond"));
        final JsonObject settings = new JsonObject();
        settings.addProperty("autoPass", Protocol.AUTO_PASS_NEVER);
        request.add("settings", settings);
        final Recorder never = new Recorder(scripted(false)).play(request);
        assertNotNull(never.result);
        assertEquals(ofType(never, Protocol.SETTINGS_APPLIED).get(0).get("autoPass").getAsString(), Protocol.AUTO_PASS_NEVER);
        assertTrue(priorityQuestionsWithoutActions(never) > 0, "Forge asks where nothing can be done");
        assertEquals(priorityQuestionsWithoutActions(plain), 0, "APINA passes where nothing can be done");
    }

    private static int priorityQuestionsWithoutActions(final Recorder r) {
        int count = 0;
        JsonObject state = null;
        for (final JsonObject m : r.messages) {
            if (Protocol.STATE.equals(type(m))) {
                state = m;
            } else if (Protocol.QUESTION.equals(type(m)) && m.has("purpose")
                    && Protocol.PURPOSE_PRIORITY.equals(m.get("purpose").getAsString())
                    && state != null && !player(state, true).get("canAct").getAsBoolean()) {
                count++;
            }
        }
        return count;
    }

    /** A settings change with an unknown value is refused and changes nothing. */
    @Test
    public void unknownSettingsAreRefused() throws Exception {
        final Recorder bad = new Recorder(scripted(false)) {
            private boolean sent;

            @Override
            JsonObject override() {
                if (!sent && state != null && state.get("turn").getAsInt() >= 2) {
                    sent = true;
                    final JsonObject o = new JsonObject();
                    o.addProperty("type", Protocol.SETTINGS_CHANGE);
                    o.addProperty("autoPass", "sometimes");
                    return o;
                }
                return null;
            }
        }.play(request(fixture("priority-respond")));
        final JsonObject rejection = rejectionOf(bad.messages, bad.own.get(0));
        assertNotNull(rejection);
        assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_INVALID);
        assertEquals(ofType(bad, Protocol.SETTINGS_APPLIED).size(), 1, "only the start settings");
    }
}
