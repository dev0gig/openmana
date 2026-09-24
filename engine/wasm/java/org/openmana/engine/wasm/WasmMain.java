package org.openmana.engine.wasm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.graalvm.webimage.api.JS;
import org.graalvm.webimage.api.JSString;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.bridge.Protocol;
import org.openmana.engine.smoke.AiSmokeMatch;
import org.openmana.engine.smoke.CardProbe;

import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Paths;
import java.util.function.Function;

/**
 * Entry point of the Forge WebAssembly module (GraalVM Web Image).
 *
 * <p>{@code main} runs once when the host loads the module: it unpacks the
 * embedded Forge data into the in-memory file system, initialises Forge and
 * registers a request handler with the host. The host is the JavaScript in
 * the Dedicated Worker ({@code engine/wasm/host/}); it must define
 * {@code globalThis.__openmanaHost} with {@code emit(kind, json)} and
 * {@code registerEngine(handler)} before the module starts.
 *
 * <p>Every failure is reported to the host as a {@code fatal} message or an
 * {@code ok: false} response with a {@code code}: {@code deck-rejected} and
 * {@code invalid-request} mean Forge never started the game (the host
 * reports engine.error, the worker stays usable), {@code engine-failure}
 * means the engine cannot go on (engine.abort). Nothing is swallowed.
 *
 * <p>The ready message carries the protocol version first; the host refuses
 * an engine that speaks another one.
 *
 * <p>Compiled separately with {@code javac -parameters}: Web Image binds the
 * {@code @JS} snippet arguments by parameter name.
 */
public final class WasmMain {

    private static final String RESOURCE_BUNDLE = "/openmana/forge-res.bin";
    private static final String VFS_ROOT = "/openmana";

    private WasmMain() {
    }

    @JS.Coerce
    @JS(args = {"kind", "json"}, value = "globalThis.__openmanaHost.emit(kind, json);")
    private static native void emit(String kind, String json);

    @JS(args = {"handler"}, value = "globalThis.__openmanaHost.registerEngine(handler);")
    private static native void registerEngine(Function<JSString, JSString> handler);

    public static void main(final String[] args) {
        try {
            ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.DEFAULT;
            ForgeEngine.Language language = ForgeEngine.Language.EN_US;
            for (final String arg : args) {
                if (arg.startsWith("--card-loading=")) {
                    cardLoading = ForgeEngine.CardLoading.parse(arg.substring("--card-loading=".length()));
                } else if (arg.startsWith("--language=")) {
                    language = ForgeEngine.Language.parse(arg.substring("--language=".length()));
                } else {
                    throw new IllegalArgumentException("unknown engine argument " + arg);
                }
            }
            emit("boot", phase("java-main"));

            final JsonObject boot;
            try (InputStream bundle = WasmMain.class.getResourceAsStream(RESOURCE_BUNDLE)) {
                if (bundle == null) {
                    throw new IllegalStateException(RESOURCE_BUNDLE + " is not embedded in this engine build");
                }
                boot = EngineBoot.boot(bundle, Paths.get(VFS_ROOT), cardLoading, language);
            }

            registerEngine(request -> JSString.of(handle(request.asString())));
            emit("ready", ready(boot).toString());
        } catch (final Throwable t) {
            emit("fatal", failure(t, "engine-failure").toString());
        }
    }

    /** One request from the host, one JSON response. Runs synchronously. */
    static String handle(final String requestJson) {
        JsonObject response;
        try {
            final JsonObject request = JsonParser.parseString(requestJson).getAsJsonObject();
            final String command = request.get("command").getAsString();
            if ("smoke-match".equals(command)) {
                final long seed = request.get("seed").getAsLong();
                final boolean includeLog = request.has("includeLog") && request.get("includeLog").getAsBoolean();
                response = new JsonObject();
                response.addProperty("ok", true);
                response.add("result", AiSmokeMatch.run(seed, includeLog));
            } else if ("card-probe".equals(command)) {
                response = new JsonObject();
                response.addProperty("ok", true);
                response.add("result", CardProbe.run());
            } else if ("human-match".equals(command)) {
                // Runs the whole game; inputs arrive through the worker's
                // SharedArrayBuffer channel while this call is on the stack.
                response = new JsonObject();
                response.addProperty("ok", true);
                response.add("result", HumanMatch.play(new WasmEngineHost(), request));
            } else {
                throw new IllegalArgumentException("unknown engine command '" + command + "'");
            }
        } catch (final HumanMatch.DeckProblem problem) {
            response = failure(problem, "deck-rejected");
            response.add("report", problem.report());
        } catch (final HumanMatch.InvalidRequest problem) {
            response = failure(problem, "invalid-request");
        } catch (final Throwable t) {
            response = failure(t, "engine-failure");
        }
        return new GsonBuilder().serializeNulls().create().toJson(response);
    }

    /** The engine.ready payload (protocol EngineReady without type and t, which the host adds). */
    private static JsonObject ready(final JsonObject boot) {
        final JsonObject ready = new JsonObject();
        ready.addProperty("protocol", Protocol.VERSION);
        ready.add("engine", boot.get("engine"));
        final JsonObject report = new JsonObject();
        for (final String key : new String[]{"resourceFiles", "resourceBytes", "unpackMillis", "forgeInitMillis", "cardLoading", "language"}) {
            report.add(key, boot.get(key));
        }
        ready.add("boot", report);
        return ready;
    }

    private static String phase(final String name) {
        final JsonObject phase = new JsonObject();
        phase.addProperty("phase", name);
        return phase.toString();
    }

    private static JsonObject failure(final Throwable t, final String code) {
        final StringWriter stack = new StringWriter();
        t.printStackTrace(new PrintWriter(stack));
        final JsonObject failure = new JsonObject();
        failure.addProperty("ok", false);
        failure.addProperty("code", code);
        // Our own request/deck problems are meant to be read; everything else keeps its class name.
        final boolean readable = t instanceof HumanMatch.DeckProblem || t instanceof HumanMatch.InvalidRequest;
        failure.addProperty("error", readable ? t.getMessage() : t.toString());
        failure.addProperty("stack", stack.toString());
        return failure;
    }
}
