package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.ReplayHost;
import org.openmana.engine.smoke.ScriptedHuman;
import org.openmana.engine.smoke.SmokeDecks;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.expectThrows;
import static org.testng.Assert.fail;

/**
 * Prompt 02: Forge's human path (PlayerControllerHuman and its inputs) on a
 * single thread, through the bridge. A scripted human (protocol data only, no
 * rules) plays Red against Forge's AI until the game ends. Three fixed games:
 * together they reach every decision form the bridge carries, attacking and
 * blocking included. The test checks which Forge paths were really taken and
 * that nothing ran on another thread.
 */
public class HumanMatchTest {

    /** Scry (arrange), charm modes (choose), targets on cards and players. */
    static final long SEED_A = 3;
    /** Adventure (options), discarding two (multi-selection), two scrys. */
    static final long SEED_B = 11;
    /** The defending player: never attacks, blocks twice. */
    static final long SEED_C = 5;

    private static final String[] FORGE_THREAD_PREFIXES = {
        "Game", "Delayed", "awaitNextInputTimer", "waitingTimer", "Game AI Eval", "Game BT", "nioEventLoopGroup",
    };

    private ScriptedHuman humanA;
    private JsonObject resultA;
    private ScriptedHuman humanB;
    private JsonObject resultB;
    private ScriptedHuman humanC;
    private JsonObject resultC;
    private Set<String> threadsStartedDuringGames;

    @BeforeClass
    public void playThreeGames() throws Exception {
        EngineTestSupport.boot();
        final Set<Thread> before = new HashSet<>(Thread.getAllStackTraces().keySet());
        humanA = new ScriptedHuman();
        resultA = HumanMatch.play(humanA, SmokeDecks.humanMatchRequest(SEED_A));
        humanB = new ScriptedHuman();
        resultB = HumanMatch.play(humanB, SmokeDecks.humanMatchRequest(SEED_B));
        humanC = ScriptedHuman.defending();
        resultC = HumanMatch.play(humanC, SmokeDecks.humanMatchRequest(SEED_C));
        threadsStartedDuringGames = Thread.getAllStackTraces().keySet().stream()
                .filter(t -> !before.contains(t))
                .map(Thread::getName)
                .collect(Collectors.toSet());
    }

    private static int count(final ScriptedHuman human, final String key) {
        return human.counters().getOrDefault(key, 0);
    }

    private int both(final String key) {
        return count(humanA, key) + count(humanB, key);
    }

    @Test
    public void everyGameEndsWithAResultFromThePlayersPointOfView() {
        for (final ScriptedHuman human : List.of(humanA, humanB, humanC)) {
            final JsonObject end = human.end();
            assertNotNull(end, "no game.end message");
            assertTrue(end.get("turns").getAsInt() > 1, "game too short: " + end);
            assertTrue(List.of("win", "loss", "draw").contains(end.get("result").getAsString()), end.toString());
        }
        assertEquals(resultA.getAsJsonArray("forgeErrors").size(), 0, "Forge errors: " + resultA.getAsJsonArray("forgeErrors"));
        assertEquals(resultB.getAsJsonArray("forgeErrors").size(), 0, "Forge errors: " + resultB.getAsJsonArray("forgeErrors"));
        assertEquals(resultC.getAsJsonArray("forgeErrors").size(), 0, "Forge errors: " + resultC.getAsJsonArray("forgeErrors"));
    }

    @Test
    public void everythingRunsOnOneThread() {
        final Set<String> me = Set.of(Thread.currentThread().getName());
        assertEquals(humanA.threads(), me, "emit/awaitInput must only be called on the game thread");
        assertEquals(humanB.threads(), me, "emit/awaitInput must only be called on the game thread");
        assertEquals(humanC.threads(), me, "emit/awaitInput must only be called on the game thread");
        for (final JsonObject result : List.of(resultA, resultB, resultC)) {
            assertEquals(result.getAsJsonArray("threadViolations").size(), 0, result.getAsJsonArray("threadViolations").toString());
        }
        for (final String name : threadsStartedDuringGames) {
            for (final String prefix : FORGE_THREAD_PREFIXES) {
                assertFalse(name.startsWith(prefix), "Forge started thread '" + name + "' during a game");
            }
        }
    }

    @Test
    public void mulliganUsesButtonsAndHighlightedHandCards() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertEquals(count(human, "mulligan:taken"), 1, human.counters().toString());
            assertTrue(count(human, "purpose:mulligan") >= 2, "keep/mulligan asked again after the mulligan");
            assertTrue(count(human, "purpose:mulliganBottom") >= 1, "London mulligan: put a card back");
            assertTrue(count(human, "tap:mulligan-bottom") >= 1, "card chosen for the bottom by tapping it");
        }
    }

    @Test
    public void cardsArePlayedByTappingThemDuringPriority() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertTrue(count(human, "tap:priority") >= 5, "cards tapped outside a question: " + human.counters());
            assertTrue(count(human, "event:me:LAND") >= 3, "lands played by the player: " + human.counters());
            assertTrue(count(human, "event:me:STACK_ADD") >= 5, "spells cast by the player: " + human.counters());
        }
    }

    /** Attacking: tapping creatures Forge offers an attack action for (games A and B). */
    @Test
    public void attackersAreDeclaredByTappingThem() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertTrue(count(human, "purpose:attack") >= 1, human.counters().toString());
            assertTrue(count(human, "tap:attacker") >= 1, human.counters().toString());
        }
    }

    /**
     * Blocking through Forge's InputBlock: the defending player taps one of
     * its creatures Forge marks with an action, Forge declares the block.
     */
    @Test
    public void blocksAreDeclaredByTappingTheBlocker() {
        assertTrue(count(humanC, "attack:skipped") >= 1, humanC.counters().toString());
        assertTrue(count(humanC, "purpose:block") >= 1, "Forge asked for blockers: " + humanC.counters());
        assertTrue(count(humanC, "tap:blocker") >= 1, humanC.counters().toString());
        assertTrue(count(humanC, "state:my-blocker") >= 1, "Forge shows the creature as blocking: " + humanC.counters());
        assertEquals(count(humanC, "rejected:no-effect"), 0, "every blocker tap was accepted: " + humanC.rejections());
    }

    @Test
    public void costsArePaidAutomaticallyAndByTappingSources() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertTrue(count(human, "payment:auto") >= 1, "Forge's auto payment used: " + human.counters());
            assertTrue(count(human, "payment:manual") >= 1, "manual payment started: " + human.counters());
            assertTrue(count(human, "tap:payment") >= 1, "mana source tapped during payment: " + human.counters());
        }
    }

    @Test
    public void targetsOnCardsAndPlayers() {
        assertTrue(both("answer:select") >= 3, "card targets from Forge's selectables: " + humanA.counters());
        assertTrue(count(humanA, "tap:player") >= 1, "a player chosen as target via player.tap: " + humanA.counters());
    }

    @Test
    public void blockingQuestionsOfEveryForm() {
        assertTrue(count(humanA, "answer:arrange") >= 1, "scry: " + humanA.counters());
        assertTrue(count(humanA, "answer:choose") >= 3, "charm modes, three times: " + humanA.counters());
        assertTrue(count(humanB, "answer:options") >= 1, "adventure: which ability: " + humanB.counters());
        assertEquals(both("arrange:hidden-item"), 0, "the movable cards of a scry must be visible to the player");
        final JsonArray cast = humanB.transcript(new JsonObject(), new JsonObject()).getAsJsonArray("castByPlayer");
        boolean looted = false;
        for (final JsonElement e : cast) {
            looted |= e.getAsString().contains("Faithless Looting");
        }
        assertTrue(looted, "discarding two cards (multi-selection) happened: " + cast);
    }

    @Test
    public void questionsAreWithdrawnAndStaleOrInvalidInputIsRejectedLoudly() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertTrue(count(human, "emit:question.withdrawn") >= 1, "no question was ever withdrawn");
            assertEquals(count(human, "fault:unknown-question"), 1);
            assertEquals(count(human, "fault:invalid-button"), 1);
            assertEquals(count(human, "fault:unknown-card"), 1);
            assertEquals(count(human, "fault:withdrawn-question"), 1);
            assertEquals(count(human, "fault:tap-during-blocking"), 1);
            final Map<String, Integer> byReason = new TreeMap<>();
            for (final JsonObject r : human.rejections()) {
                byReason.merge(r.get("reason").getAsString(), 1, Integer::sum);
            }
            assertTrue(byReason.getOrDefault(Protocol.REJECT_STALE, 0) >= 2, "unknown and withdrawn question: " + byReason);
            assertTrue(byReason.getOrDefault(Protocol.REJECT_INVALID, 0) >= 1, "invalid button: " + byReason);
            assertTrue(byReason.getOrDefault(Protocol.REJECT_UNKNOWN_CARD, 0) >= 1, "unknown card: " + byReason);
            assertTrue(byReason.getOrDefault(Protocol.REJECT_NOT_ACTIVE, 0) >= 1, "tap during a blocking question: " + byReason);
        }
    }

    /** "state.request" is served at once, at a priority and while a blocking question waits. */
    @Test
    public void stateRequestsAreServedAtOnce() {
        for (final ScriptedHuman human : List.of(humanA, humanB)) {
            assertEquals(count(human, "extra:state-request:priority"), 1, human.counters().toString());
            assertEquals(count(human, "extra:state-request:blocking"), 1, human.counters().toString());
            assertEquals(count(human, "state-request:answered"), 2, human.counters().toString());
            assertEquals(count(human, "state-request:unanswered"), 0, human.counters().toString());
        }
    }

    @Test
    public void hiddenCardsLeaveTheEngineWithoutIdOrName() {
        assertTrue(both("state:opponent-hand-hidden") > 0, "the opponent never held a hidden card?");
        assertEquals(both("state:opponent-hand-visible"), 0, "the opponent's hand was visible");
        assertEquals(both("state:opponent-hand-leak"), 0, "a hidden hand card carried id or name");
    }

    @Test
    public void theSameSeedAndInputsReplayTheSameGame() {
        final ScriptedHuman again = new ScriptedHuman();
        final JsonObject second = HumanMatch.play(again, SmokeDecks.humanMatchRequest(SEED_A));
        assertEquals(second.get("logSha256").getAsString(), resultA.get("logSha256").getAsString(),
                "same seed and same decisions must give the same Forge game log");
        assertEquals(second.get("protocolSha256").getAsString(), resultA.get("protocolSha256").getAsString(),
                "same questions, ids, withdrawals and rejections");
        assertEquals(again.inputs(), humanA.inputs(), "the scripted player must make the same inputs");
    }

    /**
     * The transcript alone (seed, decks, inputs) reproduces the game: what the
     * Wasm tests rely on when they replay it through the SharedArrayBuffer.
     */
    @Test
    public void theTranscriptAloneReproducesTheGame() {
        final JsonObject transcript = humanB.transcript(SmokeDecks.humanMatchRequest(SEED_B), resultB);
        final ReplayHost replay = new ReplayHost(transcript.getAsJsonArray("inputs"));
        final JsonObject again = HumanMatch.play(replay, transcript.getAsJsonObject("request"));
        assertEquals(replay.used(), humanB.inputs().size(), "every recorded input used, none missing");
        for (final String key : List.of("logSha256", "protocolSha256", "protocolMessages", "forgeCallbacks", "inputs", "turns", "result")) {
            assertEquals(again.get(key), resultB.get(key), key);
        }
        assertTrue(resultB.get("protocolMessages").getAsInt() > 100, "fingerprint covers the questions: " + resultB);
        // Forge's event handler for GUIs (EventBus subscriber) drives these:
        final JsonObject callbacks = resultB.getAsJsonObject("forgeCallbacks");
        for (final String callback : List.of("updateZones", "updateCards", "updatePhase", "updateTurn", "updateStack", "updateLives")) {
            assertTrue(callbacks.has(callback) && callbacks.get(callback).getAsInt() > 0, callback + " never called: " + callbacks);
        }
    }

    /**
     * Conceding is the decision itself (Anvil lesson: Forge's own concede()
     * would ask again): the game ends at once as a loss, and Forge asks for
     * nothing more.
     */
    @Test
    public void concedingEndsTheGameAtOnceAsALoss() {
        final ScriptedHuman quitter = ScriptedHuman.concedingInTurn(3);
        final JsonObject result = HumanMatch.play(quitter, SmokeDecks.humanMatchRequest(SEED_A));
        assertEquals(count(quitter, "concede:sent"), 1);
        final List<JsonObject> inputs = quitter.inputs();
        assertEquals(inputs.get(inputs.size() - 1).get("type").getAsString(), Protocol.CONCEDE, "an input was asked after conceding");
        final JsonObject end = quitter.end();
        assertNotNull(end, "no game.end after conceding");
        assertEquals(end.get("result").getAsString(), "loss", end.toString());
        assertEquals(end.get("winner").getAsString(), "Forge AI", end.toString());
        assertTrue(end.get("conceded").getAsBoolean(), end.toString());
        assertEquals(end.get("turns").getAsInt(), quitter.concededInTurn(), "the game ended in the turn of the concession");
        assertEquals(result.getAsJsonArray("forgeErrors").size(), 0, result.getAsJsonArray("forgeErrors").toString());
    }

    /**
     * Protocol 1 lifecycle, checked by the scripted player on every message:
     * every question is closed exactly once (question.answered or
     * question.withdrawn), its blocking flag fits its kind, ids are never
     * reused, rejections carry the seq of the rejected input, answered
     * questions name the input that answered them, and nothing is open when
     * the game ends.
     */
    @Test
    public void everyQuestionIsClosedExactlyOnceAndRejectionsCarryTheirSeq() {
        for (final ScriptedHuman human : List.of(humanA, humanB, humanC)) {
            final Map<String, Integer> violations = new TreeMap<>();
            human.counters().forEach((k, v) -> {
                if (k.startsWith("protocol:")) {
                    violations.put(k, v);
                }
            });
            assertEquals(violations, Map.of(), "protocol violations");
            assertTrue(count(human, "emit:question.answered") >= 10, "accepted answers close their question: " + human.counters());
            assertTrue(count(human, "emit:question.withdrawn") >= 10, human.counters().toString());
            assertEquals(count(human, "emit:question"), count(human, "emit:question.answered") + count(human, "emit:question.withdrawn"),
                    "questions asked = questions answered + withdrawn");
        }
        for (final JsonObject input : humanA.inputs()) {
            assertEquals(input.keySet().iterator().next(), "type");
        }
        for (int i = 0; i < humanA.inputs().size(); i++) {
            assertEquals(humanA.inputs().get(i).get("seq").getAsInt(), i + 1, "inputs are numbered 1, 2, 3 … without gaps");
        }
    }

    /** A lost, repeated or reordered input must not let the game go on on a false basis. */
    @Test
    public void aBrokenInputSequenceStopsTheGameLoudly() {
        final JsonObject transcript = humanB.transcript(SmokeDecks.humanMatchRequest(SEED_B), resultB);
        final JsonArray skipped = transcript.getAsJsonArray("inputs").deepCopy();
        skipped.get(4).getAsJsonObject().addProperty("seq", 7);
        final IllegalStateException gap = expectThrows(IllegalStateException.class,
                () -> HumanMatch.play(new ReplayHost(skipped), transcript.getAsJsonObject("request")));
        assertTrue(gap.getMessage().contains("input sequence broken: expected seq 5"), gap.getMessage());

        final JsonArray unnumbered = transcript.getAsJsonArray("inputs").deepCopy();
        unnumbered.get(0).getAsJsonObject().remove("seq");
        final IllegalStateException missing = expectThrows(IllegalStateException.class,
                () -> HumanMatch.play(new ReplayHost(unnumbered), transcript.getAsJsonObject("request")));
        assertTrue(missing.getMessage().contains("expected seq 1"), missing.getMessage());
    }

    /**
     * An answer names the kind of its question; another kind is refused as
     * invalid, the question stays open and the game goes on as before.
     */
    @Test
    public void anAnswerOfTheWrongKindIsInvalidAndChangesNothing() {
        final ScriptedHuman player = new ScriptedHuman();
        final EngineHost wrongOnce = new EngineHost() {
            private JsonObject lastPriority;
            private boolean done;
            private int seq;

            @Override
            public void emit(final JsonObject message) {
                if (Protocol.QUESTION.equals(message.get("type").getAsString()) && message.has("purpose")
                        && Protocol.PURPOSE_PRIORITY.equals(message.get("purpose").getAsString())) {
                    lastPriority = message;
                }
                player.emit(message);
            }

            @Override
            public JsonObject awaitInput() {
                seq++;
                if (!done && lastPriority != null) {
                    done = true;
                    final JsonObject wrong = new JsonObject();
                    wrong.addProperty("type", Protocol.ANSWER);
                    wrong.addProperty("seq", seq);
                    wrong.addProperty("question", lastPriority.get("id").getAsLong());
                    wrong.addProperty("kind", Protocol.KIND_CONFIRM);
                    wrong.addProperty("yes", true);
                    return wrong;
                }
                final JsonObject input = player.awaitInput();
                input.addProperty("seq", seq);
                return input;
            }
        };
        final JsonObject result = HumanMatch.play(wrongOnce, SmokeDecks.humanMatchRequest(SEED_A));
        final JsonObject rejection = player.rejections().stream()
                .filter(r -> r.get("detail").getAsString().contains("is a buttons question, the answer is for confirm"))
                .findFirst().orElse(null);
        if (rejection == null) {
            fail("the wrong kind was not rejected: " + player.rejections());
        }
        assertEquals(rejection.get("reason").getAsString(), Protocol.REJECT_INVALID);
        assertEquals(result.get("logSha256").getAsString(), resultA.get("logSha256").getAsString(),
                "the refused answer changed nothing in Forge's game");
    }

    @Test
    public void unknownCardsStopTheStartWithAReport() {
        final JsonObject request = SmokeDecks.humanMatchRequest(1);
        final JsonArray main = request.getAsJsonObject("human").getAsJsonObject("deck").getAsJsonArray("main");
        final JsonObject bogus = new JsonObject();
        bogus.addProperty("card", "Definitely Not A Magic Card");
        bogus.addProperty("count", 2);
        main.add(bogus);
        final HumanMatch.DeckProblem problem = expectThrows(HumanMatch.DeckProblem.class,
                () -> HumanMatch.play(new ScriptedHuman(), request));
        assertEquals(problem.report().getAsJsonArray("unknownCards").get(0).getAsString(), "Definitely Not A Magic Card");
    }
}
