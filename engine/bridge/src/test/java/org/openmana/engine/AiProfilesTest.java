package org.openmana.engine;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.ai.AiProfileUtil;
import forge.ai.AiProps;
import forge.ai.LobbyPlayerAi;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.smoke.SmokeDecks;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.expectThrows;
import static org.testng.Assert.fail;

/**
 * Prompt 12: Forge's AI profiles in the engine. The engine reports the
 * profiles Forge loaded, each profile really carries its own values, a match
 * with a profile Forge does not have is refused instead of played with
 * Forge's built-in defaults (which are none of its profiles), and no profile
 * can make the AI cheat.
 */
public class AiProfilesTest {

    private JsonObject boot;

    @BeforeClass
    public void boot() throws Exception {
        boot = EngineTestSupport.boot();
    }

    @Test
    public void theBootReportNamesTheProfilesForgeLoadedAndTheCardLanguage() {
        final JsonArray profiles = boot.getAsJsonArray("aiProfiles");
        final List<String> names = new ArrayList<>();
        profiles.forEach(p -> names.add(p.getAsString()));
        assertEquals(names, List.of("Cautious", "Default", "Experimental", "Reckless"));
        assertEquals(ForgeEngine.aiProfiles(), names);
        // The test JVM boots Forge in English; the cards follow the language by default.
        assertEquals(boot.get("language").getAsString(), "en-US");
        assertEquals(boot.get("cardLanguage").getAsString(), "en-US");
    }

    private static String prop(final String profile, final AiProps prop) {
        final LobbyPlayerAi player = new LobbyPlayerAi("Probe", null);
        player.setAiProfile(profile);
        return AiProfileUtil.getAIProp(player, prop);
    }

    @Test
    public void theBootReportHasExactlyTheSchemasFields() throws Exception {
        final String file = System.getProperty("openmana.protocolSchema");
        if (file == null || file.isEmpty() || file.startsWith("${")) {
            fail("-Dopenmana.protocolSchema is not set; run engine/scripts/build-jvm.sh");
        }
        final JsonObject bootReport = com.google.gson.JsonParser.parseString(Files.readString(Paths.get(file), StandardCharsets.UTF_8))
                .getAsJsonObject().getAsJsonObject("$defs").getAsJsonObject("BootReport");
        final Set<String> required = new TreeSet<>();
        bootReport.getAsJsonArray("required").forEach(e -> required.add(e.getAsString()));
        final Set<String> reported = new TreeSet<>(boot.keySet());
        reported.remove("engine"); // engine.ready carries it on its own (EngineBuild)
        assertEquals(reported, required, "EngineBoot.boot() and the schema's BootReport (WasmMain.ready copies these fields)");
    }

    @Test
    public void eachProfileCarriesItsOwnValues() {
        // Values the verified descriptions rest on (src/game/ai-profile-table.ts).
        assertEquals(prop("Default", AiProps.PLAY_AGGRO), "false");
        assertEquals(prop("Reckless", AiProps.PLAY_AGGRO), "true");
        assertEquals(prop("Reckless", AiProps.CHANCE_TO_ATTACK_INTO_TRADE), "100");
        assertEquals(prop("Cautious", AiProps.CHANCE_TO_COUNTER_CMC_1), "0");
        assertEquals(prop("Default", AiProps.CHANCE_TO_COUNTER_CMC_1), "30");
        assertEquals(prop("Cautious", AiProps.TRY_TO_HOLD_COMBAT_TRICKS_UNTIL_BLOCK), "false");
        assertEquals(prop("Experimental", AiProps.AI_IN_DANGER_MAX_THRESHOLD), "12");
        assertEquals(prop("Reckless", AiProps.MULLIGAN_THRESHOLD), "3");
    }

    @Test
    public void anUnknownProfileWouldSilentlyPlayForgesDefaultsSoTheBridgeRefusesIt() throws Exception {
        // What Forge does on its own: an unknown name gets AiProps' built-in
        // defaults - not even Default.ai (its counter chance for mana value 1 is 30).
        assertEquals(prop("Aggressive", AiProps.CHANCE_TO_COUNTER_CMC_1), AiProps.CHANCE_TO_COUNTER_CMC_1.getDefault());
        assertFalse(prop("Aggressive", AiProps.CHANCE_TO_COUNTER_CMC_1).equals(prop("Default", AiProps.CHANCE_TO_COUNTER_CMC_1)));

        final JsonObject request = SmokeDecks.humanMatchRequest(3);
        request.getAsJsonObject("ai").addProperty("profile", "Aggressive");
        final List<JsonObject> emitted = new ArrayList<>();
        final EngineHost host = new EngineHost() {
            @Override
            public void emit(final JsonObject message) {
                emitted.add(message);
            }

            @Override
            public JsonObject awaitInput() {
                throw new AssertionError("a refused match must not wait for input");
            }
        };
        final HumanMatch.InvalidRequest refused = expectThrows(HumanMatch.InvalidRequest.class, () -> HumanMatch.play(host, request));
        assertTrue(refused.getMessage().contains("Forge has no AI profile 'Aggressive'"), refused.getMessage());
        assertTrue(refused.getMessage().contains("[Cautious, Default, Experimental, Reckless]"), refused.getMessage());
        // Refused before anything happened: no game.started, nothing else.
        assertTrue(emitted.isEmpty(), emitted.toString());
    }

    @Test
    public void noProfileCanMakeTheAiCheat() {
        // CHEAT_WITH_MANA_ON_SHUFFLE=true in every profile works only with AI cheating enabled.
        for (final String profile : ForgeEngine.aiProfiles()) {
            assertEquals(prop(profile, AiProps.CHEAT_WITH_MANA_ON_SHUFFLE), "true", profile);
        }
        assertFalse(FModel.getPreferences().getPrefBoolean(FPref.UI_ENABLE_AI_CHEATS));
        assertFalse(new forge.game.GameRules(forge.game.GameType.Constructed).isAllowCheatShuffle());
    }
}
