package org.openmana.engine.bridge;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardType;
import forge.card.ColorSet;
import forge.game.GameEntityView;
import forge.game.card.CardView;
import forge.game.keyword.KeywordCollection;
import forge.game.player.PlayerView;
import forge.game.player.DelayedReveal;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.CombatDamageAssignment;
import forge.trackable.TrackableProperty;
import org.openmana.engine.EngineTestSupport;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.testng.Assert.*;

/** Actual Forge views and BridgeGuiGame callbacks; scripted transport, not a whole game. */
public class DecisionParityTest {
    @BeforeClass public void bootForge() throws Exception { EngineTestSupport.boot(); }

    private static JsonObject json(final String text) { return JsonParser.parseString(text).getAsJsonObject(); }

    private static CardView card(final int id, final int lethal, final String... keywords) {
        final CardView card = new CardView(id, null);
        card.set(TrackableProperty.LethalDamage, lethal);
        card.getCurrentState().set(TrackableProperty.Name, "Card " + id);
        card.getCurrentState().set(TrackableProperty.Type, CardType.parse("Creature", false));
        final KeywordCollection collection = new KeywordCollection();
        for (final String keyword : keywords) collection.add(keyword);
        card.getCurrentState().set(TrackableProperty.Keywords, collection.getView());
        return card;
    }

    @Test public void changedColoursIncludeColourlessAndLeaveUnchangedCardsAlone() {
        final CardView card = card(1, 2);
        final StateBuilder builder = new StateBuilder(new BridgeGuiGame(new Host(), null));
        card.getCurrentState().set(TrackableProperty.Colors, ColorSet.fromNames("G"));
        card.getCurrentState().set(TrackableProperty.OriginalColors, ColorSet.fromNames("G"));
        assertFalse(builder.card(card, false).has("colors"));
        card.getCurrentState().set(TrackableProperty.HasChangedColors, true);
        card.getCurrentState().set(TrackableProperty.OriginalColors, ColorSet.fromNames("U", "R"));
        assertEquals(builder.card(card, false).get("colors").getAsString(), "UR");
        card.getCurrentState().set(TrackableProperty.OriginalColors, ColorSet.fromMask(0));
        final JsonObject colourless = builder.card(card, false);
        assertEquals(colourless.get("colors").getAsString(), "");
        assertEquals(colourless.get("printedColors").getAsString(), "G");
    }

    private static final class Host implements EngineHost {
        final List<JsonObject> messages = new ArrayList<>();
        final List<String> replies;
        JsonObject question;
        int seq;
        Host(final String... replies) { this.replies = List.of(replies); }
        @Override public void emit(final JsonObject message) {
            messages.add(message.deepCopy());
            if ("question".equals(message.get("type").getAsString())) question = message;
        }
        @Override public JsonObject awaitInput() {
            assertTrue(seq < replies.size(), "unexpected additional input: " + messages);
            final JsonObject answer = json(replies.get(seq++));
            answer.addProperty("type", "answer");
            answer.addProperty("seq", seq);
            answer.addProperty("question", question.get("id").getAsLong());
            answer.addProperty("kind", question.get("kind").getAsString());
            return answer;
        }
        long rejections() { return messages.stream().filter(m -> "input.rejected".equals(m.get("type").getAsString())).count(); }
    }

    @Test public void trampleOffersDefenderAndRejectsDamageBeforeForgesLethalMinimum() {
        final CardView attacker = card(1, 5, "Trample");
        final CardView blocker = card(2, 3);
        final PlayerView defender = new PlayerView(10, null);
        final Host host = new Host("{\"amounts\":[0,5]}", "{\"amounts\":[3,2]}");
        final Map<CardView, Integer> result = new BridgeGuiGame(host, null).assignCombatDamage(attacker, List.of(blocker), 5, defender, true, false);
        assertEquals(result.get(blocker), Integer.valueOf(3));
        assertEquals(result.get(null), Integer.valueOf(2));
        assertEquals(host.rejections(), 1L);
        assertEquals(host.question.getAsJsonArray("items").get(1).getAsJsonObject().get("player").getAsInt(), 10);
    }

    @Test public void unblockedTrampleAndPostponingReturnForgesOwnDefenderKeyAndNull() {
        final CardView attacker = card(1, 5, "Trample");
        final PlayerView defender = new PlayerView(10, null);
        final Host host = new Host("{\"amounts\":[5]}");
        assertEquals(new BridgeGuiGame(host, null).assignCombatDamage(attacker, List.of(), 5, defender, true, false).get(null), Integer.valueOf(5));
        final Host postponed = new Host("{\"amounts\":[],\"skip\":true}");
        assertNull(new BridgeGuiGame(postponed, null).assignCombatDamage(attacker, List.of(card(2, 2)), 5, defender, true, true));
        final Host forbidden = new Host("{\"amounts\":[],\"skip\":true}", "{\"amounts\":[2,3]}");
        new BridgeGuiGame(forbidden, null).assignCombatDamage(attacker, List.of(card(2, 2)), 5, defender, true, false);
        assertEquals(forbidden.rejections(), 1L);
    }

    @Test public void forgePolicyCoversDeathtouchMarkedDamageOrderingAndFreeDivision() {
        final CardView attacker = card(1, 5, "Trample", "Deathtouch");
        final List<CardView> blockers = List.of(card(2, 3), card(3, 0));
        final PlayerView defender = new PlayerView(10, null);
        final CombatDamageAssignment modern = new CombatDamageAssignment(attacker, blockers, defender, true);
        assertTrue(modern.mayAssignTo(1, List.of(0, 1, 0))); // unordered blockers
        assertFalse(modern.mayAssignTo(2, List.of(0, 1, 4)));
        assertTrue(modern.mayAssignTo(2, List.of(1, 0, 4))); // one is lethal with deathtouch; second already lethal
        final CombatDamageAssignment ordered = new CombatDamageAssignment(attacker, blockers, defender, false);
        assertFalse(ordered.mayAssignTo(1, List.of(0, 1, 4)));
        attacker.getCurrentState().set(TrackableProperty.HasDivideDamage, true);
        assertTrue(new CombatDamageAssignment(attacker, blockers, defender, true).prerequisites().isEmpty());
        assertFalse(new CombatDamageAssignment(card(5, 5), blockers, defender, true).defenderAllowed());
    }

    @Test public void genericDistributionPreservesCapsAndMinimumAndNeverNormalizesInvalidInput() {
        final Map<Object, Integer> targets = new LinkedHashMap<>();
        targets.put("first", 1); targets.put("second", 4);
        final Host host = new Host("{\"amounts\":[4,1]}", "{\"amounts\":[1,4]}");
        assertEquals(new BridgeGuiGame(host, null).assignGenericAmount(null, targets, 5, true, "Amount"), targets);
        assertEquals(host.rejections(), 1L);
        assertEquals(host.question.getAsJsonArray("maximums"), json("{\"values\":[1,4]}").get("values"));
    }

    @Test public void arbitraryPositionsPreserveHiddenRemainderAndRefuseDuplicates() {
        final CardView first = card(1, 1), second = card(2, 1), secret1 = card(3, 1), secret2 = card(4, 1);
        final Host host = new Host("{\"top\":[],\"bottom\":[],\"positions\":[2,2]}", "{\"top\":[],\"bottom\":[],\"positions\":[4,2]}");
        final List<CardView> result = new BridgeGuiGame(host, null).manipulateCardList("Place", List.of(first, second, secret1, secret2), List.of(first, second), false, false, true);
        assertEquals(result, List.of(secret1, second, secret2, first));
        assertEquals(host.rejections(), 1L);
        assertEquals(host.question.get("others").getAsInt(), 2);
        assertEquals(host.question.getAsJsonArray("items").size(), 2);
        assertFalse(host.question.toString().contains("Card 3"));
        assertFalse(host.question.toString().contains("Card 4"));
    }

    @Test public void inputDialogCanBeExplicitlyCancelled() {
        final Host host = new Host("{\"value\":null}");
        assertNull(new BridgeGuiGame(host, null).showInputDialog("Input", "Title", null, "7", null, true));
        assertTrue(host.question.get("cancellable").getAsBoolean());
        final Host options = new Host("{\"value\":\"not offered\"}", "{\"value\":\"second\"}");
        assertEquals(new BridgeGuiGame(options, null).showInputDialog("Input", "Title", null, "first", List.of("first", "second"), false), "second");
        assertEquals(options.rejections(), 1L);
    }

    @Test public void bothEntityChoiceCallbacksShowTheDelayedRevealBeforeChoosing() {
        final List<GameEntityView> choices = List.of(card(1, 1), card(2, 1));
        final DelayedReveal reveal = new DelayedReveal(List.of(), java.util.Set.of(ZoneType.Library), new PlayerView(10, null), "Revealed first");
        final Host single = new Host("{\"option\":1}", "{\"choices\":[2]}");
        assertEquals(new BridgeGuiGame(single, null).chooseSingleEntityForEffect("Pick", choices, reveal, false), choices.get(1));
        final Host multi = new Host("{\"option\":1}", "{\"choices\":[2,1]}");
        assertEquals(new BridgeGuiGame(multi, null).chooseEntitiesForEffect("Pick", choices, 2, 2, reveal), List.of(choices.get(1), choices.get(0)));
        for (final Host host : List.of(single, multi)) {
            final List<JsonObject> questions = host.messages.stream().filter(m -> "question".equals(m.get("type").getAsString())).toList();
            assertEquals(questions.size(), 2);
            assertTrue(questions.get(0).has("revealed"));
            assertEquals(questions.get(0).get("text").getAsString(), "Revealed first");
            assertEquals(questions.get(1).get("kind").getAsString(), "choose");
        }
    }

    @Test public void answersCannotOverflowTheirTotalOrPlaceOnForbiddenSlots() throws Exception {
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.amounts(json("{\"amounts\":[2147483647,2147483647,3]}"), 3, 1, 0));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.arrange(json("{\"top\":[],\"bottom\":[],\"positions\":[3]}"), 1, true, true, true, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.arrange(json("{\"top\":[],\"bottom\":[],\"positions\":[1]}"), 1, true, true, false, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.value(json("{\"value\":null}"), false, false));
    }
}
