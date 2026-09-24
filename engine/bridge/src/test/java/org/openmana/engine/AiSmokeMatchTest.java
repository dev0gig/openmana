package org.openmana.engine;

import com.google.gson.JsonObject;
import org.openmana.engine.smoke.AiSmokeMatch;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNotEquals;
import static org.testng.Assert.assertTrue;

/**
 * JVM side of the engine spike: boots Forge from the same resource bundle the
 * Wasm module embeds and lets Forge's AI play complete games.
 *
 * <p>The bundle path comes from {@code -Dopenmana.resourceBundle}
 * (engine/scripts/build-jvm.sh sets it). Without it the test fails; it never
 * skips, because a skipped engine test looks like a passing one
 * ({@link EngineTestSupport}).
 */
public class AiSmokeMatchTest {

    private JsonObject boot;

    @BeforeClass
    public void bootForge() throws Exception {
        boot = EngineTestSupport.boot();
    }

    @Test
    public void bootReportsTheEngineBuild() {
        assertTrue(boot.get("resourceFiles").getAsInt() > 30_000, "full cardsfolder expected: " + boot);
        final JsonObject engine = boot.getAsJsonObject("engine");
        assertTrue(engine.get("synchronous").getAsBoolean(), "Forge must run in synchronous mode");
        assertEquals(engine.get("forgeCommit").getAsString().length(), 40, "pinned Forge commit");
        assertTrue(engine.get("patchCount").getAsInt() >= 3, "patch queue");
        assertEquals(engine.get("patchesSha256").getAsString().length(), 64, "hash of the patch queue");
        assertEquals(engine.get("openmanaCommit").getAsString().length(), 40, "OpenMana commit of the build");
    }

    @Test
    public void aiGameRunsToTheEndAndIsReproducible() {
        final JsonObject first = AiSmokeMatch.run(42, false);
        assertGameFinished(first);

        // Same seed, same process: Forge must replay the identical game.
        final JsonObject again = AiSmokeMatch.run(42, false);
        assertEquals(again.get("logSha256").getAsString(), first.get("logSha256").getAsString(),
                "same seed must produce the same Forge game log");
        assertEquals(again.get("turns").getAsInt(), first.get("turns").getAsInt());

        // A different seed must give a different game, otherwise the seed is not in effect.
        final JsonObject other = AiSmokeMatch.run(7, false);
        assertGameFinished(other);
        assertNotEquals(other.get("logSha256").getAsString(), first.get("logSha256").getAsString(),
                "a different seed should change the game");
    }

    private static void assertGameFinished(final JsonObject result) {
        assertTrue(result.get("turns").getAsInt() > 1, "game too short: " + result);
        assertTrue(result.get("logEntries").getAsInt() > 10, "almost empty game log: " + result);
        assertTrue(result.get("draw").getAsBoolean() || !result.get("winner").isJsonNull(),
                "neither a winner nor a draw: " + result);
        assertEquals(result.getAsJsonArray("forgeErrors").size(), 0,
                "Forge reported errors: " + result.getAsJsonArray("forgeErrors"));
    }
}
