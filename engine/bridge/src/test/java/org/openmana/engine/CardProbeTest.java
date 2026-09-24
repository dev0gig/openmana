package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openmana.engine.smoke.CardProbe;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

/**
 * The card probe on the JVM (lazy card loading, English): Forge's card scripts
 * from the engine's resource bundle load and become game cards, including the
 * effects that bring cards in by name. test-engine.sh runs the same probe on
 * the JVM (lazy, eager, German) and in the browser and compares them; this
 * test checks the content once, in every build.
 *
 * <p>Runs the whole probe once for all tests of this class (it loads every
 * card, ~30 s on the JVM).
 */
public class CardProbeTest {

    private JsonObject probe;

    @BeforeClass
    public void runProbe() throws Exception {
        final JsonObject boot = EngineTestSupport.boot();
        assertEquals(boot.get("cardLoading").getAsString(), "lazy");
        probe = CardProbe.run();
    }

    @Test
    public void nothingFailed() {
        assertEquals(probe.getAsJsonArray("failures").size(), 0, "probe failures: " + probe.getAsJsonArray("failures"));
        assertEquals(probe.get("format").getAsString(), CardProbe.FORMAT);
        assertEquals(probe.get("fingerprint").getAsString().length(), 64);
    }

    @Test
    public void effectsBringCardsInByName() {
        final Map<String, JsonObject> cases = byKey(probe.getAsJsonArray("namedCreation"), "id");
        assertEquals(cases.keySet().size(), 5);
        cases.values().forEach(c -> assertTrue(c.get("ok").getAsBoolean(), "named creation failed: " + c));
        assertEquals(strings(cases.get("conjure-by-name").getAsJsonArray("created")), List.of("Mox Emerald"));
        assertEquals(strings(cases.get("tokens-from-script").getAsJsonArray("created")), List.of("Soldier Token 1/1", "Soldier Token 1/1"));
        assertTrue(List.of("Ignorant Bliss", "Crack the Earth", "Blazing Volley")
                .containsAll(strings(cases.get("random-copy-from-list").getAsJsonArray("created"))));
        assertEquals(strings(cases.get("random-copy-from-list").getAsJsonArray("created")).size(), 1);
        assertEquals(cases.get("random-creature-from-all-cards").getAsJsonArray("created").size(), 1);
        // The last case needs every card: with lazy loading Forge loads the rest of the database for it.
        final JsonObject all = cases.get("random-creature-from-all-cards");
        assertEquals(all.get("uniqueCardsKnownAfter").getAsInt(),
                probe.getAsJsonObject("database").getAsJsonObject("cards").get("unique").getAsInt());
    }

    @Test
    public void everyLayoutLoadsWithAllItsFaces() {
        final Map<String, JsonObject> cards = byKey(probe.getAsJsonArray("representative"), "request");
        assertEquals(cards.size(), CardProbe.REPRESENTATIVE.length);
        cards.values().forEach(c -> assertTrue(c.get("found").getAsBoolean() && !c.get("unsupported").getAsBoolean(), "not loaded: " + c));
        assertLayout(cards, "Lightning Bolt", "None", 1);
        assertLayout(cards, "Delver of Secrets", "Transform", 2);
        assertLayout(cards, "Valakut Awakening", "Modal", 2);
        assertLayout(cards, "Invasion of Zendikar", "Transform", 2);
        assertLayout(cards, "Fire // Ice", "Split", 2);
        assertLayout(cards, "Bottomless Pool // Locker Room", "Split", 2);
        assertLayout(cards, "Bonecrusher Giant", "Adventure", 2);
        assertLayout(cards, "Bushi Tenderfoot", "Flip", 2);
        assertLayout(cards, "Gisela, the Broken Blade", "Meld", 2);
        assertTrue(cards.get("Delver of Secrets").getAsJsonObject("game").get("doubleFaced").getAsBoolean());
        // Every face became a game state with its own characteristics.
        final JsonArray delver = cards.get("Delver of Secrets").getAsJsonObject("game").getAsJsonArray("states");
        assertTrue(delver.size() >= 2, "Delver of Secrets states: " + delver);
    }

    @Test
    public void everyTokenScriptLoads() {
        final JsonObject tokens = probe.getAsJsonObject("tokens");
        assertTrue(tokens.get("scripts").getAsInt() > 800, "token scripts: " + tokens.get("scripts"));
        assertEquals(tokens.get("loaded").getAsInt(), tokens.get("scripts").getAsInt());
        for (final String sample : CardProbe.TOKEN_SAMPLES) {
            assertTrue(tokens.getAsJsonObject("samples").has(sample), "token sample " + sample);
        }
    }

    @Test
    public void theNewestEditionsLoad() {
        final JsonArray editions = probe.getAsJsonArray("newestEditions");
        assertEquals(editions.size(), 3);
        String previous = "9999-99-99";
        for (final JsonElement e : editions) {
            final JsonObject edition = e.getAsJsonObject();
            final String date = edition.get("date").getAsString();
            assertTrue(date.compareTo(previous) <= 0, "editions are newest first: " + editions);
            previous = date;
            assertTrue(edition.get("loaded").getAsInt() > 0, "no card loads in " + edition.get("code"));
            assertEquals(edition.get("loaded").getAsInt() + edition.getAsJsonArray("notImplemented").size(),
                    edition.get("distinctCards").getAsInt(), "every card of " + edition.get("code") + " is loaded or reported");
            assertEquals(edition.getAsJsonArray("problems").size(), 0);
        }
    }

    @Test
    public void everyCardOfTheDatabaseBecomesAGameCard() {
        final JsonObject database = probe.getAsJsonObject("database");
        for (final String pass : new String[]{"cards", "variantCards"}) {
            final JsonObject p = database.getAsJsonObject(pass);
            assertEquals(p.get("instantiated").getAsInt(), p.get("unique").getAsInt(), pass);
        }
        assertTrue(database.getAsJsonObject("cards").get("unique").getAsInt() > 30_000);
        assertEquals(database.getAsJsonArray("problems").size(), 0, "cards that fail: " + database.getAsJsonArray("problems"));
    }

    private static void assertLayout(final Map<String, JsonObject> cards, final String name, final String layout, final int faces) {
        final JsonObject card = cards.get(name);
        assertEquals(card.get("layout").getAsString(), layout, name);
        assertEquals(card.getAsJsonArray("faces").size(), faces, name + " faces");
    }

    private static Map<String, JsonObject> byKey(final JsonArray array, final String key) {
        final Map<String, JsonObject> map = new HashMap<>();
        for (final JsonElement e : array) {
            map.put(e.getAsJsonObject().get(key).getAsString(), e.getAsJsonObject());
        }
        return map;
    }

    private static List<String> strings(final JsonArray array) {
        final List<String> list = new ArrayList<>();
        array.forEach(e -> list.add(e.getAsString()));
        return list;
    }
}
