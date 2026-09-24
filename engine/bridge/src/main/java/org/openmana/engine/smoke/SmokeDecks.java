package org.openmana.engine.smoke;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.deck.Deck;
import forge.deck.DeckSection;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Two fixed 60-card decks for the engine smoke match. Classic commons only, so
 * the game ends reliably within a few turns while still exercising land play,
 * mana abilities, creature spells, targeted burn, combat tricks, blocking and
 * a library search with shuffle.
 *
 * <p>This is test data for the engine, not a rule: nothing in OpenMana may
 * branch on these names (Bible §2).
 */
public final class SmokeDecks {

    private SmokeDecks() {
    }

    public static Map<String, Integer> redList() {
        final Map<String, Integer> cards = new LinkedHashMap<>();
        cards.put("Mountain", 22);
        cards.put("Raging Goblin", 4);
        cards.put("Goblin Raider", 4);
        cards.put("Goblin Piker", 4);
        cards.put("Gray Ogre", 4);
        cards.put("Hill Giant", 4);
        cards.put("Canyon Minotaur", 4);
        cards.put("Fire Elemental", 2);
        cards.put("Shock", 4);
        cards.put("Lightning Bolt", 4);
        cards.put("Volcanic Hammer", 4);
        return cards;
    }

    /**
     * The human's deck in the human-vs-AI match: red cards whose decisions
     * Forge asks in every form the bridge must carry - scry (Magma Jet:
     * arrange), discarding two (Faithless Looting: multi-selection), charm
     * modes (Fiery Confluence: choose, three times; Abrade), an adventure
     * (Bonecrusher Giant: which ability), an optional trigger with a target
     * (Goblin Arsonist), targets on creatures and players (Shock, Bolt).
     */
    public static Map<String, Integer> redPlusList() {
        final Map<String, Integer> cards = new LinkedHashMap<>();
        cards.put("Mountain", 22);
        cards.put("Raging Goblin", 4);
        cards.put("Goblin Raider", 2);
        cards.put("Goblin Piker", 4);
        cards.put("Goblin Arsonist", 4);
        cards.put("Bonecrusher Giant", 2);
        cards.put("Hill Giant", 2);
        cards.put("Canyon Minotaur", 2);
        cards.put("Shock", 4);
        cards.put("Lightning Bolt", 4);
        cards.put("Magma Jet", 4);
        cards.put("Abrade", 2);
        cards.put("Faithless Looting", 2);
        cards.put("Fiery Confluence", 2);
        return cards;
    }

    public static Map<String, Integer> greenList() {
        final Map<String, Integer> cards = new LinkedHashMap<>();
        cards.put("Forest", 22);
        cards.put("Llanowar Elves", 4);
        cards.put("Grizzly Bears", 4);
        cards.put("Runeclaw Bear", 4);
        cards.put("Kalonian Tusker", 4);
        cards.put("Centaur Courser", 4);
        cards.put("Trained Armodon", 4);
        cards.put("Giant Spider", 4);
        cards.put("Craw Wurm", 2);
        cards.put("Giant Growth", 4);
        cards.put("Rampant Growth", 4);
        return cards;
    }

    /**
     * Builds a Forge deck. Every name must resolve in Forge's card database;
     * a card Forge does not know is an error, never a silent omission.
     */
    public static Deck build(final String name, final Map<String, Integer> list) {
        final Deck deck = new Deck(name);
        for (final Map.Entry<String, Integer> entry : list.entrySet()) {
            deck.getOrCreate(DeckSection.Main).add(entry.getKey(), entry.getValue());
        }
        final int expected = list.values().stream().mapToInt(Integer::intValue).sum();
        final int actual = deck.getMain().countAll();
        if (actual != expected) {
            throw new IllegalStateException("deck '" + name + "' resolved " + actual + " of " + expected + " cards");
        }
        return deck;
    }

    /** The deck as the bridge's JSON deck format ({@code HumanMatch}). */
    public static JsonObject json(final String name, final Map<String, Integer> list) {
        final JsonObject deck = new JsonObject();
        deck.addProperty("name", name);
        final JsonArray main = new JsonArray();
        for (final Map.Entry<String, Integer> entry : list.entrySet()) {
            final JsonObject e = new JsonObject();
            e.addProperty("card", entry.getKey());
            e.addProperty("count", entry.getValue());
            main.add(e);
        }
        deck.add("main", main);
        return deck;
    }

    /**
     * The human-vs-AI smoke match as a protocol MatchRequest (what the page
     * sends with match.start): the human plays Red (burn needs targets,
     * creatures need mana, see {@link #redPlusList()}), Forge's AI plays
     * Green with profile "Default".
     */
    public static JsonObject humanMatchRequest(final long seed) {
        final JsonObject request = new JsonObject();
        request.addProperty("seed", seed);
        request.addProperty("format", "constructed");
        final JsonObject human = new JsonObject();
        human.addProperty("name", "Player");
        human.add("deck", json("OpenMana Smoke Red+", redPlusList()));
        request.add("human", human);
        final JsonObject ai = new JsonObject();
        ai.addProperty("name", "Forge AI");
        ai.addProperty("profile", AiSmokeMatch.AI_PROFILE);
        ai.add("deck", json("OpenMana Smoke Green", greenList()));
        request.add("ai", ai);
        return request;
    }
}
