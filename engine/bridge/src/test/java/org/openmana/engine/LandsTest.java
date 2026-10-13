package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.LandPlays;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.ReplayHost;
import org.openmana.engine.smoke.ScriptedHuman;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.openmana.engine.Recorder.fixture;
import static org.openmana.engine.Recorder.player;
import static org.openmana.engine.Recorder.rejectionOf;
import static org.openmana.engine.Recorder.request;
import static org.openmana.engine.Recorder.type;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;

/**
 * Prompt 48, protocol 10: Forge's land facts for the player, in the real game
 * of the differential fixture {@code lands} (green lands, Exploration - an
 * additional land each turn - and Rampant Growth - a basic land from the
 * library onto the battlefield - against red):
 * <ul>
 *   <li>Forge's reason why a land of the hand cannot be played now
 *       (VisibleCard.landRefusal, Forge's own check through patch 0010): the
 *       land for the turn is played (limit), not the player's turn, not at
 *       sorcery speed - each only where the state says so;</li>
 *   <li>a second land in the same turn is refused by Forge, and the next own
 *       turn allows a land again;</li>
 *   <li>an effect raises Forge's limit: two lands in one turn;</li>
 *   <li>a land put onto the battlefield by an effect is no land play: Forge
 *       counts only land actions;</li>
 *   <li>asking changes nothing: the same inputs without asking give Forge's
 *       identical game log.</li>
 * </ul>
 */
public class LandsTest {

    private Recorder game;
    /** seq of the land tap the test sent itself when the land for the turn was played. */
    private long refusedTap = -1;
    private int refusedTurn;
    private int refusedCard;

    @BeforeClass
    public void playGame() throws Exception {
        EngineTestSupport.boot();
        final JsonObject fixture = fixture("lands");
        game = new Recorder(ScriptedHuman.fromPolicy(fixture.getAsJsonObject("player"))) {
            @Override
            JsonObject override() {
                if (refusedTap >= 0 || state == null || !stepOpen(Protocol.PURPOSE_PRIORITY)) {
                    return null;
                }
                final JsonObject me = player(state, true);
                if (state.get("activePlayer").getAsInt() != me.get("id").getAsInt() || state.getAsJsonArray("stack").size() > 0) {
                    return null;
                }
                for (final JsonElement c : me.getAsJsonObject("zones").getAsJsonArray("hand")) {
                    final JsonObject card = c.getAsJsonObject();
                    if (card.has("landRefusal") && Protocol.LAND_REFUSAL_LIMIT.equals(card.get("landRefusal").getAsString())) {
                        refusedTurn = state.get("turn").getAsInt();
                        refusedCard = card.get("id").getAsInt();
                        final JsonObject tap = new JsonObject();
                        tap.addProperty("type", Protocol.CARD_TAP);
                        tap.addProperty("card", refusedCard);
                        refusedTap = inputs.size() + 1L;
                        return tap;
                    }
                }
                return null;
            }
        }.play(request(fixture));
        assertNotNull(game.result, "the game ended");
        for (final Map.Entry<String, Integer> e : game.player.counters().entrySet()) {
            // The test's own input is unknown to the scripted player's numbering.
            if (!e.getKey().startsWith("protocol:answered-by-")) {
                assertFalse(e.getKey().startsWith("protocol:"), "protocol violation " + e);
            }
        }
    }

    private static int landsInHand(final JsonObject me, final String reason) {
        int n = 0;
        for (final JsonElement c : me.getAsJsonObject("zones").getAsJsonArray("hand")) {
            final JsonObject card = c.getAsJsonObject();
            if (reason == null ? !card.has("landRefusal") : card.has("landRefusal") && reason.equals(card.get("landRefusal").getAsString())) {
                n++;
            }
        }
        return n;
    }

    /** Every reason only where the state says so; all three ordinary reasons occur. */
    @Test
    public void forgeSaysWhyALandCannotBePlayed() {
        final Set<String> seen = new HashSet<>();
        for (final JsonObject m : game.messages) {
            if (!Protocol.STATE.equals(type(m))) {
                continue;
            }
            final JsonObject me = player(m, true);
            final boolean myTurn = m.get("activePlayer").isJsonPrimitive() && m.get("activePlayer").getAsInt() == me.get("id").getAsInt();
            for (final JsonElement c : me.getAsJsonObject("zones").getAsJsonArray("hand")) {
                final JsonObject card = c.getAsJsonObject();
                if (!card.has("landRefusal")) {
                    continue;
                }
                final String reason = card.get("landRefusal").getAsString();
                seen.add(reason);
                assertFalse(card.has("playable"), "a land Forge marks playable has no refusal: " + card);
                switch (reason) {
                    case Protocol.LAND_REFUSAL_NOT_YOUR_TURN -> assertFalse(myTurn, "not your turn in the player's turn");
                    case Protocol.LAND_REFUSAL_LIMIT -> {
                        assertTrue(myTurn);
                        assertTrue(me.get("landsPlayed").getAsInt() >= me.get("landsAllowed").getAsInt(),
                                "limit only when the lands are used up: " + me.get("landsPlayed") + "/" + me.get("landsAllowed"));
                    }
                    case Protocol.LAND_REFUSAL_TIMING -> assertTrue(myTurn);
                    default -> throw new AssertionError("unexpected reason " + reason);
                }
            }
        }
        assertTrue(seen.containsAll(Set.of(Protocol.LAND_REFUSAL_LIMIT, Protocol.LAND_REFUSAL_NOT_YOUR_TURN, Protocol.LAND_REFUSAL_TIMING)), "reasons: " + seen);
    }

    /** The second land of a turn: Forge refuses it; the next own turn allows a land again. */
    @Test
    public void aSecondLandIsRefusedAndTheNextTurnAllowsOne() {
        assertTrue(refusedTap > 0, "the land for a turn was played while another land was in the hand");
        final JsonObject rejection = rejectionOf(game.messages, refusedTap);
        assertNotNull(rejection, "Forge refuses the second land");
        assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_NO_EFFECT);
        boolean allowedLater = false;
        for (final JsonObject m : game.messages) {
            if (!Protocol.STATE.equals(type(m)) || m.get("turn").getAsInt() <= refusedTurn) {
                continue;
            }
            final JsonObject me = player(m, true);
            if (m.get("activePlayer").getAsInt() == me.get("id").getAsInt() && me.get("landsPlayed").getAsInt() == 0
                    && ("MAIN1".equals(m.get("phase").getAsString()) || "MAIN2".equals(m.get("phase").getAsString()))) {
                for (final JsonElement c : me.getAsJsonObject("zones").getAsJsonArray("hand")) {
                    final JsonObject card = c.getAsJsonObject();
                    if (card.get("id").getAsInt() == refusedCard) {
                        assertFalse(card.has("landRefusal"), "the next own turn allows the land again: " + card);
                        allowedLater = allowedLater || card.has("playable");
                    }
                }
            }
        }
        assertTrue(allowedLater, "the refused land is playable in a later own turn");
    }

    /** Exploration raises Forge's limit: two lands in one turn, no limit refusal before the second. */
    @Test
    public void anEffectRaisesTheLimit() {
        boolean two = false;
        for (final JsonObject m : game.messages) {
            if (!Protocol.STATE.equals(type(m))) {
                continue;
            }
            final JsonObject me = player(m, true);
            final int played = me.get("landsPlayed").getAsInt();
            final int allowed = me.get("landsAllowed").getAsInt();
            if (played < allowed) {
                assertEquals(landsInHand(me, Protocol.LAND_REFUSAL_LIMIT), 0, "no limit before the lands are used up");
            }
            if (played == 2 && allowed >= 2) {
                two = true;
            }
            assertFalse(me.has("landsUnlimited"), "no effect of this game lets the player play any number of lands");
        }
        assertTrue(two, "two lands played in one turn");
    }

    /**
     * Rampant Growth puts a land from the library onto the battlefield: an
     * observed result of its resolution, never a land action. In every turn
     * of the player the land actions are exactly Forge's landsPlayed.
     */
    @Test
    public void aLandPutOntoTheBattlefieldIsNoLandPlay() {
        final Map<Integer, Integer> landActions = new TreeMap<>();
        final Map<Integer, Integer> landsPlayed = new TreeMap<>();
        int byEffect = 0;
        int turn = 0;
        int me = -1;
        for (final JsonObject m : game.messages) {
            switch (type(m)) {
                case Protocol.STATE -> {
                    turn = m.get("turn").getAsInt();
                    final JsonObject mine = player(m, true);
                    me = mine.get("id").getAsInt();
                    if (m.get("activePlayer").isJsonPrimitive() && m.get("activePlayer").getAsInt() == me) {
                        landsPlayed.merge(turn, mine.get("landsPlayed").getAsInt(), Math::max);
                    }
                }
                case Protocol.OBSERVATION -> {
                    for (final JsonElement e : m.getAsJsonArray("actions")) {
                        final JsonObject a = e.getAsJsonObject();
                        if (!a.get("player").isJsonPrimitive() || a.get("player").getAsInt() != me) {
                            continue;
                        }
                        if ("land".equals(a.get("kind").getAsString())) {
                            landActions.merge(turn, 1, Integer::sum);
                        }
                        if ("resolve".equals(a.get("kind").getAsString())) {
                            for (final JsonElement mv : a.getAsJsonObject("results").getAsJsonArray("moves")) {
                                final JsonObject move = mv.getAsJsonObject();
                                if (!move.get("from").isJsonNull() && "library".equals(move.getAsJsonObject("from").get("zone").getAsString())
                                        && "battlefield".equals(move.getAsJsonObject("to").get("zone").getAsString())) {
                                    byEffect++;
                                    assertTrue(move.getAsJsonObject("card").has("key"), "the land is shown: " + move);
                                }
                            }
                        }
                    }
                }
                default -> { }
            }
        }
        assertTrue(byEffect >= 1, "a land onto the battlefield by an effect");
        for (final Map.Entry<Integer, Integer> e : landsPlayed.entrySet()) {
            assertEquals(landActions.getOrDefault(e.getKey(), 0), e.getValue(), "land actions in turn " + e.getKey());
        }
    }

    /** Asking Forge why a land cannot be played changes nothing: the same inputs without asking give the same game. */
    @Test
    public void askingChangesNothing() throws Exception {
        final JsonArray inputs = new JsonArray();
        game.inputs.forEach(inputs::add);
        final JsonObject unasked;
        LandPlays.setAskingForTests(false);
        try {
            unasked = HumanMatch.play(new ReplayHost(inputs), request(fixture("lands")));
        } finally {
            LandPlays.setAskingForTests(true);
        }
        assertEquals(unasked.get("logSha256"), game.result.get("logSha256"), "Forge's game log differs without asking");
        assertEquals(unasked.get("turns"), game.result.get("turns"));
        assertEquals(unasked.get("inputs"), game.result.get("inputs"));
    }
}
