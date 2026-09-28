package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.game.phase.PhaseType;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.trace.EngineTrace;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Set;
import java.util.TreeSet;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.fail;

/**
 * The bridge and the protocol schema (engine/protocol/schema/protocol.schema.json)
 * name the same things: version, message types, question kinds, purposes,
 * button meanings, reject reasons, message kinds, and every phase Forge
 * knows. A Forge update that adds a phase, or a bridge change that forgets
 * the schema, fails here instead of in a player's game. (The full shape of
 * every message is checked against the schema by the Node tests on JVM and
 * Wasm output.)
 */
public class ProtocolContractTest {

    private JsonObject defs;

    @BeforeClass
    public void readSchema() throws Exception {
        final String file = System.getProperty("openmana.protocolSchema");
        if (file == null || file.isEmpty() || file.startsWith("${")) {
            fail("-Dopenmana.protocolSchema is not set; run engine/scripts/build-jvm.sh");
        }
        defs = JsonParser.parseString(Files.readString(Paths.get(file), StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonObject("$defs");
    }

    private Set<String> enumOf(final String def) {
        final Set<String> values = new TreeSet<>();
        for (final JsonElement e : defs.getAsJsonObject(def).getAsJsonArray("enum")) {
            values.add(e.getAsString());
        }
        return values;
    }

    /** The const of `property` in every branch of a oneOf union. */
    private Set<String> branchConsts(final String union, final String property) {
        final Set<String> values = new TreeSet<>();
        for (final JsonElement branch : defs.getAsJsonObject(union).getAsJsonArray("oneOf")) {
            final String name = branch.getAsJsonObject().get("$ref").getAsString().replace("#/$defs/", "");
            values.add(defs.getAsJsonObject(name).getAsJsonObject("properties").getAsJsonObject(property).get("const").getAsString());
        }
        return values;
    }

    private static Set<String> constants(final String prefix) throws IllegalAccessException {
        final Set<String> values = new TreeSet<>();
        for (final Field f : Protocol.class.getFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class && f.getName().startsWith(prefix)) {
                values.add((String) f.get(null));
            }
        }
        return values;
    }

    @Test
    public void theVersionIsTheSchemasVersion() {
        assertEquals(Protocol.VERSION, defs.getAsJsonObject("ProtocolVersion").get("const").getAsInt(),
                "bump Protocol.VERSION and the schema's ProtocolVersion together");
    }

    @Test
    public void questionKindsPurposesReasonsAndMessageKindsMatch() throws IllegalAccessException {
        assertEquals(constants("KIND_"), enumOf("QuestionKind"));
        assertEquals(branchConsts("Question", "kind"), enumOf("QuestionKind"));
        assertEquals(branchConsts("AnswerInput", "kind"), enumOf("QuestionKind"));
        assertEquals(constants("PURPOSE_"), enumOf("ButtonsPurpose"));
        assertEquals(constants("MEANING_"), enumOf("ButtonMeaning"));
        assertEquals(constants("REJECT_"), enumOf("RejectReason"));
        assertEquals(constants("MESSAGE_"), enumOf("MessageKind"), "MESSAGE is the message type, MESSAGE_* are its kinds");
    }

    @Test
    public void everyTypeTheBridgeSendsOrReadsIsInTheSchema() {
        final Set<String> engineTypes = branchConsts("EngineMessage", "type");
        for (final String type : new String[]{Protocol.GAME_STARTED, Protocol.STATE, Protocol.EVENTS, Protocol.MESSAGE,
                Protocol.QUESTION, Protocol.QUESTION_WITHDRAWN, Protocol.QUESTION_ANSWERED, Protocol.INPUT_REJECTED, Protocol.GAME_END,
                Protocol.DIAGNOSTICS_TRACE}) {
            assertTrue(engineTypes.contains(type), type + " is missing in EngineMessage");
        }
        assertEquals(branchConsts("EngineInput", "type"),
                new TreeSet<>(Set.of(Protocol.ANSWER, Protocol.CARD_TAP, Protocol.PLAYER_TAP, Protocol.MANA_USE, Protocol.STATE_REQUEST, Protocol.CONCEDE)));
    }

    /** The bridge sends Forge's phase names; the schema must know every one this Forge has. */
    @Test
    public void everyForgePhaseIsAProtocolPhase() {
        final Set<String> phases = new TreeSet<>();
        for (final PhaseType p : PhaseType.values()) {
            phases.add(p.name());
        }
        assertEquals(phases, enumOf("Phase"), "Forge's PhaseType changed: adapt the bridge or the schema (a new protocol version)");
    }

    /**
     * The engine's boot arguments and build facts are the schema's: languages
     * (also those the Forge data bundle carries, from resources.json via the
     * build facts), card loading modes, every EngineBuild field.
     */
    @Test
    public void languagesCardLoadingAndBuildFactsMatch() {
        final Set<String> languages = new TreeSet<>();
        for (final ForgeEngine.Language language : ForgeEngine.Language.values()) {
            languages.add(language.tag());
        }
        assertEquals(languages, enumOf("EngineLanguage"));
        assertEquals(new TreeSet<>(Arrays.asList(ForgeEngine.buildInfo().getProperty("resources.languages").split(","))), languages,
                "the languages in engine/resources.json, ForgeEngine.Language and the schema must agree");
        final Set<String> modes = new TreeSet<>();
        for (final ForgeEngine.CardLoading mode : ForgeEngine.CardLoading.values()) {
            modes.add(mode.name().toLowerCase());
        }
        assertEquals(modes, enumOf("CardLoading"));
        final Set<String> schemaFields = new TreeSet<>();
        defs.getAsJsonObject("EngineBuild").getAsJsonArray("required").forEach(e -> schemaFields.add(e.getAsString()));
        assertEquals(new TreeSet<>(EngineBoot.engineInfo().keySet()), schemaFields, "EngineBoot.engineInfo() and the schema's EngineBuild");
    }

    /**
     * The engine trace (prompt 05): its checkpoint kinds and every event kind
     * the bridge can record (one per Forge event class, plus the bridge's
     * own) are the schema's. A Forge update with a new event type does not
     * compile until TraceEvents traces it; then the schema must learn it too.
     */
    @Test
    public void traceCheckpointsAndEventKindsMatch() {
        assertEquals(new TreeSet<>(EngineTrace.CHECKPOINTS), enumOf("TraceCheckpoint"));
        assertEquals(EngineTrace.eventKinds(), enumOf("TraceEventKind"));
        assertEquals(EngineTrace.MESSAGE_TYPE, Protocol.DIAGNOSTICS_TRACE);
    }

    @Test
    public void blockingKindsAreFixedPerQuestion() {
        final JsonArray branches = defs.getAsJsonObject("Question").getAsJsonArray("oneOf");
        for (final JsonElement branch : branches) {
            final String name = branch.getAsJsonObject().get("$ref").getAsString().replace("#/$defs/", "");
            final JsonObject blocking = defs.getAsJsonObject(name).getAsJsonObject("properties").getAsJsonObject("blocking");
            final String kind = defs.getAsJsonObject(name).getAsJsonObject("properties").getAsJsonObject("kind").get("const").getAsString();
            final boolean nonBlocking = Protocol.KIND_SELECT.equals(kind) || Protocol.KIND_BUTTONS.equals(kind);
            assertEquals(blocking.get("const").getAsBoolean(), !nonBlocking, name + ".blocking");
        }
    }
}
