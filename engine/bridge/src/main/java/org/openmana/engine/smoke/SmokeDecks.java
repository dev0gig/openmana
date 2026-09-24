package org.openmana.engine.smoke;

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
}
