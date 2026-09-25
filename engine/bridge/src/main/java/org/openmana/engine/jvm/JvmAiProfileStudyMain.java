package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.bridge.HumanMatch;

import java.io.BufferedWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Runs the AI profile study of prompt 12 ({@link AiProfileStudy}) on the JVM:
 * every game of a plan, or one shard of it, one JSON line per game.
 *
 * <pre>
 * java -cp openmana-engine-jvm.jar org.openmana.engine.jvm.JvmAiProfileStudyMain \
 *      --bundle forge-res.bin --plan engine/fixtures/ai-profile-study.json --decks engine/fixtures/decks \
 *      --out games.jsonl [--shard 0/3] [--card-loading eager]
 * </pre>
 *
 * Plan: {@code {"decks": [name…], "pairings": [[profileA, profileB]…], "seeds": {"first": 1, "count": 50}}}.
 * Every deck plays every pairing as a mirror match with every seed in both
 * seat orders (a pairing of one profile with itself: twice as many seeds
 * instead, the second order would be the same game). engine/scripts/ai-profile-study.sh
 * runs the shards in parallel and summarises them.
 */
public final class JvmAiProfileStudyMain {

    private JvmAiProfileStudyMain() {
    }

    /** One game of the plan. */
    private record Task(String deck, JsonObject deckSpec, String first, String second, long seed) {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        String plan = null;
        String decks = null;
        String out = null;
        int shard = 0;
        int shards = 1;
        ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.DEFAULT;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--plan" -> plan = args[++i];
                case "--decks" -> decks = args[++i];
                case "--out" -> out = args[++i];
                case "--shard" -> {
                    final String[] parts = args[++i].split("/");
                    shard = Integer.parseInt(parts[0]);
                    shards = Integer.parseInt(parts[1]);
                }
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                default -> throw new IllegalArgumentException("unknown argument " + args[i]);
            }
        }
        if (bundle == null || plan == null || decks == null || out == null) {
            throw new IllegalArgumentException("--bundle, --plan, --decks and --out are required");
        }
        if (shard < 0 || shard >= shards) {
            throw new IllegalArgumentException("--shard must be i/n with 0 <= i < n");
        }

        final List<Task> tasks = tasks(JsonParser.parseString(Files.readString(Paths.get(plan))).getAsJsonObject(), Paths.get(decks));
        final Path root = TempRoot.create();
        final JsonObject boot;
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            boot = EngineBoot.boot(in, root, cardLoading, ForgeEngine.Language.EN_US);
        }
        System.err.println("[ai-profile-study] shard " + shard + "/" + shards + ": " + tasks.size() + " games in the plan, booted in "
                + boot.get("forgeInitMillis") + " ms");

        final GsonBuilder gson = new GsonBuilder().serializeNulls();
        int played = 0;
        try (BufferedWriter lines = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            for (int index = shard; index < tasks.size(); index += shards) {
                final Task task = tasks.get(index);
                JsonObject game;
                try {
                    game = AiProfileStudy.play(() -> HumanMatch.deck(task.deckSpec(), task.deck()), new String[]{task.first(), task.second()}, task.seed());
                } catch (final RuntimeException e) {
                    game = new JsonObject();
                    game.addProperty("seed", task.seed());
                    game.addProperty("failure", e.toString());
                }
                game.addProperty("index", index);
                game.addProperty("deck", task.deck());
                final JsonArray pairing = new JsonArray();
                pairing.add(task.first());
                pairing.add(task.second());
                game.add("pairing", pairing);
                lines.write(gson.create().toJson(game));
                lines.write('\n');
                lines.flush();
                if (++played % 25 == 0) {
                    System.err.println("[ai-profile-study] shard " + shard + ": " + played + " games");
                }
            }
        }
        final JsonObject done = new JsonObject();
        done.addProperty("shard", shard);
        done.addProperty("shards", shards);
        done.addProperty("games", played);
        done.add("engine", boot.get("engine"));
        System.out.println(JvmSmokeMain.RESULT_PREFIX + gson.create().toJson(done));
        // Forge leaves executor threads behind on the JVM.
        System.exit(0);
    }

    private static List<Task> tasks(final JsonObject plan, final Path deckDir) throws Exception {
        final List<Task> tasks = new ArrayList<>();
        final JsonObject seeds = plan.getAsJsonObject("seeds");
        final long first = seeds.get("first").getAsLong();
        final int count = seeds.get("count").getAsInt();
        for (final JsonElement deckName : plan.getAsJsonArray("decks")) {
            final String name = deckName.getAsString();
            final JsonObject spec = JsonParser.parseString(Files.readString(deckDir.resolve(name + ".json"))).getAsJsonObject();
            for (final JsonElement p : plan.getAsJsonArray("pairings")) {
                final String a = p.getAsJsonArray().get(0).getAsString();
                final String b = p.getAsJsonArray().get(1).getAsString();
                if (a.equals(b)) {
                    for (long seed = first; seed < first + 2L * count; seed++) {
                        tasks.add(new Task(name, spec, a, b, seed));
                    }
                } else {
                    for (long seed = first; seed < first + count; seed++) {
                        tasks.add(new Task(name, spec, a, b, seed));
                        tasks.add(new Task(name, spec, b, a, seed));
                    }
                }
            }
        }
        return tasks;
    }
}
