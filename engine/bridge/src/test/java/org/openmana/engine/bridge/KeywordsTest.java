package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.StaticData;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameRules;
import forge.game.GameStage;
import forge.game.GameType;
import forge.game.Match;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.phase.PhaseType;
import forge.game.player.Player;
import forge.game.player.RegisteredPlayer;
import forge.game.zone.ZoneType;
import forge.player.GamePlayerUtil;
import forge.game.keyword.Keyword;
import forge.game.keyword.KeywordCollectionView;
import forge.game.keyword.KeywordView;
import forge.trackable.TrackableProperty;
import org.openmana.engine.EngineTestSupport;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.List;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;

/**
 * The keywords of a card (protocol 9, prompt 47): what Forge's keyword view
 * holds - nothing guessed from texts -, each concrete form once, in a stable
 * order, with the parts of the form as Forge's parser reads them.
 */
public class KeywordsTest {

    @BeforeClass
    public void boot() throws Exception {
        EngineTestSupport.boot();
    }

    private static CardView.CardStateView stateWith(final String name, final String... keywords) {
        final CardView card = new CardView(7, null);
        final CardView.CardStateView state = card.getCurrentState();
        state.set(TrackableProperty.Name, name);
        final List<KeywordView> views = new ArrayList<>();
        for (final String k : keywords) {
            views.add(Keyword.getInstance(k).getView());
        }
        state.set(TrackableProperty.Keywords, new KeywordCollectionView(views));
        return state;
    }

    private static JsonObject find(final JsonArray all, final String keyword) {
        for (int i = 0; i < all.size(); i++) {
            final JsonObject k = all.get(i).getAsJsonObject();
            if (k.get("keyword").getAsString().equals(keyword)) {
                return k;
            }
        }
        return null;
    }

    @Test
    public void everyFormOnceInForgesOrderWithoutFreeFormKeywords() {
        final JsonArray all = StateBuilder.keywords(stateWith("Probe", "Vigilance", "Flying", "Flying", "CARDNAME can't block.", "Trample"));
        final List<String> names = new ArrayList<>();
        for (int i = 0; i < all.size(); i++) {
            names.add(all.get(i).getAsJsonObject().get("keyword").getAsString());
        }
        // Forge's enum order (FLYING before TRAMPLE before VIGILANCE), Flying once, the free-form text left out.
        assertEquals(names, List.of("FLYING", "TRAMPLE", "VIGILANCE"));
        final JsonObject flying = find(all, "FLYING");
        assertEquals(flying.get("title").getAsString(), "Flying");
        assertEquals(flying.get("reminder").getAsString(), "This creature can't be blocked except by creatures with flying or reach.");
        assertFalse(flying.has("amount") || flying.has("cost") || flying.has("detail"), "a simple keyword has no parts");
    }

    @Test
    public void theConcreteFormAndItsParts() {
        final JsonArray all = StateBuilder.keywords(stateWith("Probe", "Kicker:2 R", "Annihilator:2", "Protection:Card.Red:red", "Equip:3", "Afterlife:X"));
        final JsonObject kicker = find(all, "KICKER");
        assertEquals(kicker.get("title").getAsString(), "Kicker {2}{R}");
        assertEquals(kicker.get("cost").getAsString(), "{2}{R}");
        assertTrue(kicker.get("reminder").getAsString().contains("{2}{R}"), kicker.toString());
        final JsonObject annihilator = find(all, "ANNIHILATOR");
        assertEquals(annihilator.get("title").getAsString(), "Annihilator 2");
        assertEquals(annihilator.get("amount").getAsString(), "2");
        final JsonObject protection = find(all, "PROTECTION");
        assertEquals(protection.get("title").getAsString(), "Protection from red");
        assertEquals(protection.get("detail").getAsString(), "red");
        final JsonObject equip = find(all, "EQUIP");
        assertEquals(equip.get("cost").getAsString(), "{3}");
        assertEquals(find(all, "AFTERLIFE").get("amount").getAsString(), "X");
    }

    @Test
    public void cardnameBecomesTheCardsName() {
        final JsonArray all = StateBuilder.keywords(stateWith("Probe", "MayFlashSac"));
        final JsonObject k = find(all, "MAYFLASHSAC");
        assertFalse(k.get("reminder").getAsString().contains("CARDNAME"), k.toString());
        assertTrue(k.get("reminder").getAsString().contains("Probe"), k.toString());
    }

    /** A keyword an effect gives the card is Forge's too: it appears in the card's keywords and goes with the effect. */
    @Test
    public void aKeywordAnEffectGivesComesAndGoes() {
        final List<RegisteredPlayer> players = new ArrayList<>();
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe A", 0, 0, null, "Default")));
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe B", 1, 0, null, "Default")));
        final GameRules rules = new GameRules(GameType.Constructed);
        final Game game = new Game(players, rules, new Match(rules, players, "OpenMana keywords"));
        game.setAge(GameStage.Play);
        game.getPhaseHandler().devModeSet(PhaseType.MAIN1, game.getPlayers().get(0));
        final Player owner = game.getPlayers().get(0);
        final Card bears = Card.fromPaperCard(StaticData.instance().getCommonCards().getCard("Grizzly Bears"), owner);
        bears.setGameTimestamp(game.getNextTimestamp());
        owner.getZone(ZoneType.Battlefield).add(bears);
        bears.updateKeywords();
        assertEquals(StateBuilder.keywords(bears.getView().getCurrentState()).size(), 0, "Grizzly Bears has no keyword of its own");

        final long timestamp = game.getNextTimestamp();
        bears.addChangedCardKeywords(List.of("Flying"), null, false, timestamp, null);
        final JsonArray given = StateBuilder.keywords(bears.getView().getCurrentState());
        assertEquals(given.size(), 1);
        assertEquals(given.get(0).getAsJsonObject().get("keyword").getAsString(), "FLYING");

        bears.removeChangedCardKeywords(timestamp, 0);
        assertEquals(StateBuilder.keywords(bears.getView().getCurrentState()).size(), 0, "the keyword goes with the effect");
    }

    @Test
    public void noKeywordsNothing() {
        assertEquals(StateBuilder.keywords(stateWith("Probe")).size(), 0);
        assertEquals(StateBuilder.keywords(stateWith("Probe", "CARDNAME can't block.")).size(), 0);
    }
}
