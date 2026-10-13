package org.openmana.engine.trace;

import com.google.common.eventbus.Subscribe;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.game.Game;
import forge.game.card.Card;
import forge.game.event.GameEvent;
import forge.game.event.GameEventGameFinished;
import forge.game.event.GameEventTurnPhase;
import forge.gamemodes.match.AbstractGuiGame;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.Protocol;

import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;

/**
 * The engine trace (prompt 05): a structured, language-independent record of
 * one game, made to compare the same game on the JVM and in WebAssembly.
 *
 * <p>It consists of numbered entries ({@code diagnostics.trace}). Each entry
 * is a checkpoint with a complete snapshot of the game ({@link TraceSnapshot})
 * plus every event since the previous checkpoint: Forge's own game events
 * ({@link TraceEvents}), the bridge's decisions (questions asked, withdrawn,
 * answered, inputs rejected, game start and end) and the player's inputs.
 * Checkpoints come at points that depend only on the game, never on a clock:
 * <ul>
 *   <li>{@code input}: Forge waits for the player's next input,</li>
 *   <li>{@code phase}: a step of a turn begins,</li>
 *   <li>{@code end}: Forge finished the game.</li>
 * </ul>
 * The same seed and the same inputs must give the same trace on every
 * runtime; the first difference says where a game went differently.
 *
 * <p>Protocol 10: an observation is traced by its structure (ids, kinds,
 * references - no hold flag, no card texts, no state number, which follows
 * a clock). Waiting while an observation is held is no game input: no
 * checkpoint, the inputs read then are neither recorded nor counted. So the
 * same game played with and without observation holds has the same trace.
 *
 * <p>Engine tests only: the trace contains hidden information (libraries,
 * the AI's hand). A match emits it only if the request asks for it
 * ({@code "trace": true}); the UI never does.
 */
public final class EngineTrace {

    /** Message type of a trace entry (protocol: DiagnosticsTrace). */
    public static final String MESSAGE_TYPE = Protocol.DIAGNOSTICS_TRACE;
    public static final String AT_INPUT = "input";
    public static final String AT_PHASE = "phase";
    public static final String AT_END = "end";
    /** Every checkpoint kind; the protocol schema lists the same (ProtocolContractTest). */
    public static final Set<String> CHECKPOINTS = Set.of(AT_INPUT, AT_PHASE, AT_END);
    /** Kinds of the bridge's own events in a trace (the schema lists them with Forge's). */
    public static final Set<String> BRIDGE_EVENTS = Set.of("started", "question", "withdrawn", "answered", "rejected", "message", "end", "input", "observation");

    private final Consumer<JsonObject> out;
    private Game game;
    private AbstractGuiGame gui;
    private TraceEvents forgeEvents;
    private JsonArray pending = new JsonArray();
    /** Open questions in structural form, by id. */
    private final Map<Long, JsonObject> questions = new TreeMap<>();
    private int entries;
    private int events;
    private int inputs;
    /**
     * Protocol 10: the seq of each game input -> its number among the game
     * inputs. Inputs read while an observation was held are no game inputs:
     * the trace numbers game inputs by this number, so the same game played
     * with and without holds has the same trace.
     */
    private final Map<Long, Long> gameInputs = new java.util.HashMap<>();
    private RuntimeException failure;

    /** @param out receives every trace entry as a protocol message */
    public EngineTrace(final Consumer<JsonObject> out) {
        this.out = out;
    }

    /** Every kind of event a trace can contain: Forge's and the bridge's. */
    public static Set<String> eventKinds() {
        final Set<String> kinds = new java.util.TreeSet<>(TraceEvents.KINDS);
        kinds.addAll(BRIDGE_EVENTS);
        return kinds;
    }

    /**
     * Starts listening to Forge's events of this game. Must happen before the
     * game starts (the bridge calls it when Forge opens the GUI's view, before
     * the mulligans).
     */
    public void attach(final Game game0) {
        if (game != null) {
            throw new IllegalStateException("the engine trace is already attached to a game");
        }
        game = game0;
        forgeEvents = new TraceEvents(this::keyOf);
        game.subscribeToEvents(this);
    }

    /** The human seat's GUI: its markers and open questions go into every snapshot. */
    public void setGui(final AbstractGuiGame gui0) {
        gui = gui0;
    }

    /**
     * Forge's event bus calls this for every game event, on the game thread.
     * The bus would swallow an exception (Guava only logs it), so a failure is
     * kept and thrown at the next call from the bridge ({@link #checkHealthy()}).
     */
    @Subscribe
    public void receive(final GameEvent event) {
        if (failure != null) {
            return;
        }
        try {
            add(event.visit(forgeEvents));
            if (event instanceof GameEventTurnPhase) {
                checkpoint(AT_PHASE);
            } else if (event instanceof GameEventGameFinished) {
                checkpoint(AT_END);
            }
        } catch (final RuntimeException e) {
            failure = new IllegalStateException("the engine trace failed on " + event.getClass().getSimpleName() + ": " + e, e);
        }
    }

    /** Throws if recording failed inside Forge's event bus: a trace with a gap must not pass. */
    public void checkHealthy() {
        if (failure != null) {
            throw failure;
        }
    }

    /** Entries emitted so far. */
    public int entries() {
        return entries;
    }

    /** Events recorded so far (Forge's and the bridge's). */
    public int events() {
        return events;
    }

    /** For the match summary: how many entries and events went out (the receiver must have them all). */
    public JsonObject summary() {
        final JsonObject o = new JsonObject();
        o.addProperty("entries", entries);
        o.addProperty("events", events);
        return o;
    }

    /**
     * Wraps the bridge's host: records the bridge's decisions as they go out
     * and the player's inputs as they come in, with a checkpoint before Forge
     * waits for each input. Trace entries themselves go to {@code out}
     * directly, not through {@code inner}.
     */
    public EngineHost wrap(final EngineHost inner) {
        return new EngineHost() {
            @Override
            public void emit(final JsonObject message) {
                checkHealthy();
                bridgeMessage(message);
                inner.emit(message);
            }

            @Override
            public JsonObject awaitInput() {
                checkHealthy();
                checkpoint(AT_INPUT);
                final JsonObject input = inner.awaitInput();
                inputs++;
                final JsonObject o = new JsonObject();
                o.addProperty("e", "input");
                JsonObject traced = input == null ? null : input.deepCopy();
                if (traced != null && traced.has("seq") && traced.get("seq").isJsonPrimitive()) {
                    // The game input's number (protocol 10: inputs read while an observation was held do not count).
                    gameInputs.put(traced.get("seq").getAsLong(), (long) inputs);
                    traced.addProperty("seq", inputs);
                }
                o.add("input", traced);
                add(o);
                return input;
            }

            /** Protocol 10: waiting to be looked at is no game input (see the class comment). */
            @Override
            public JsonObject awaitObservationInput() {
                checkHealthy();
                return inner.awaitObservationInput();
            }
        };
    }

    private void add(final JsonObject event) {
        pending.add(event);
        events++;
    }

    private void checkpoint(final String at) {
        if (game == null) {
            throw new IllegalStateException("engine trace: checkpoint '" + at + "' before the game was attached");
        }
        final JsonObject entry = new JsonObject();
        entry.addProperty("type", MESSAGE_TYPE);
        entry.addProperty("n", ++entries);
        entry.addProperty("at", at);
        entry.addProperty("inputs", inputs);
        entry.add("events", pending);
        pending = new JsonArray();
        entry.add("snapshot", TraceSnapshot.of(game, gui, gui == null ? null : questions.values()));
        out.accept(entry);
    }

    private long gameInput(final long seq) {
        final Long nr = gameInputs.get(seq);
        if (nr == null) {
            throw new IllegalStateException("engine trace: no game input with seq " + seq);
        }
        return nr;
    }

    private String keyOf(final int cardId) {
        final Card c = game == null ? null : game.findById(cardId);
        return c == null ? null : c.getName();
    }

    /**
     * The bridge's messages in structural form. Texts, labels and card views
     * are left out (they are Forge's words in the engine's language); state
     * and events are the UI's picture and not part of the trace.
     */
    private void bridgeMessage(final JsonObject message) {
        final String type = message.get("type").getAsString();
        final JsonObject o = new JsonObject();
        switch (type) {
            case "game.started" -> {
                o.addProperty("e", "started");
                copy(message, o, "format", "aiProfile");
            }
            case "question" -> {
                final JsonObject q = question(message);
                questions.put(message.get("id").getAsLong(), q);
                o.addProperty("e", "question");
                q.entrySet().forEach(e -> o.add(e.getKey(), e.getValue().deepCopy()));
            }
            case "question.withdrawn" -> {
                questions.remove(message.get("id").getAsLong());
                o.addProperty("e", "withdrawn");
                copy(message, o, "id");
            }
            case "question.answered" -> {
                questions.remove(message.get("id").getAsLong());
                o.addProperty("e", "answered");
                copy(message, o, "id");
                o.addProperty("seq", gameInput(message.get("seq").getAsLong()));
            }
            case "input.rejected" -> {
                if (!gameInputs.containsKey(message.get("seq").getAsLong())) {
                    // refused while an observation was held: no game input (protocol 10)
                    return;
                }
                o.addProperty("e", "rejected");
                o.addProperty("seq", gameInput(message.get("seq").getAsLong()));
                copy(message, o, "reason");
            }
            case "message" -> {
                o.addProperty("e", "message");
                copy(message, o, "kind", "card");
            }
            case "game.end" -> {
                o.addProperty("e", "end");
                copy(message, o, "winner", "reason", "turns", "result", "conceded");
            }
            case "observation" -> {
                o.addProperty("e", "observation");
                copy(message, o, "id");
                final JsonArray actions = new JsonArray();
                for (final JsonElement a : message.getAsJsonArray("actions")) {
                    actions.add(observedAction(a.getAsJsonObject()));
                }
                o.add("actions", actions);
            }
            default -> {
                return;
            }
        }
        add(o);
    }

    /**
     * An observed action by its structure (protocol 10): every field as sent,
     * a card only as its reference ("c12", "hidden") - a card's view carries
     * Forge's words in the engine's language.
     */
    private static JsonElement observedAction(final JsonElement e) {
        if (e.isJsonArray()) {
            final JsonArray a = new JsonArray();
            for (final JsonElement item : e.getAsJsonArray()) {
                a.add(observedAction(item));
            }
            return a;
        }
        if (!e.isJsonObject()) {
            return e.deepCopy();
        }
        final JsonObject in = e.getAsJsonObject();
        if (in.has("hidden") && in.get("hidden").isJsonPrimitive() && in.size() == 1) {
            return new com.google.gson.JsonPrimitive("hidden");
        }
        if (in.has("tapped") && in.has("id") && in.has("owner")) {
            // a VisibleCard
            return new com.google.gson.JsonPrimitive("c" + in.get("id").getAsInt());
        }
        final JsonObject out = new JsonObject();
        for (final Map.Entry<String, JsonElement> f : in.entrySet()) {
            out.add(f.getKey(), observedAction(f.getValue()));
        }
        return out;
    }

    /** A question without its words: kind, limits, flags and what its items refer to. */
    private static JsonObject question(final JsonObject q) {
        final JsonObject o = new JsonObject();
        // not "text", button labels, "top" (the order dialog's list title) or card views: Forge's words
        copy(q, o, "id", "kind", "blocking", "purpose", "card", "cards", "min", "max", "total", "numeric", "cancellable",
                "remainingMin", "remainingMax", "toTop", "toBottom", "toAnywhere", "others",
                "maximums", "prerequisites", "maySkip");
        if (q.has("suggested") && !isText(q.get("suggested"))) {
            o.add("suggested", q.get("suggested").deepCopy());
        }
        if (q.has("buttons")) {
            final JsonArray enabled = new JsonArray();
            for (final JsonElement b : q.getAsJsonArray("buttons")) {
                enabled.add(b.getAsJsonObject().get("enabled").getAsBoolean());
            }
            o.add("buttons", enabled);
        }
        for (final String list : new String[]{"items", "revealed"}) {
            if (q.has(list)) {
                o.add(list, itemRefs(q.getAsJsonArray(list)));
            }
        }
        return o;
    }

    /** What an item stands for: card "c12", player "p1", hidden card "hidden", or only its number "#3". */
    private static JsonArray itemRefs(final JsonArray items) {
        final JsonArray refs = new JsonArray();
        for (final JsonElement e : items) {
            final JsonObject item = e.getAsJsonObject();
            if (item.has("hidden")) {
                refs.add("hidden");
            } else if (item.has("player")) {
                refs.add("p" + item.get("player").getAsInt());
            } else if (item.has("card")) {
                refs.add("c" + item.get("card").getAsInt());
            } else {
                refs.add("#" + item.get("nr").getAsInt());
            }
        }
        return refs;
    }

    /** A suggested text input (showInputDialog) is Forge's words; numbers and choices are structure. */
    private static boolean isText(final JsonElement e) {
        return e.isJsonPrimitive() && e.getAsJsonPrimitive().isString();
    }

    private static void copy(final JsonObject from, final JsonObject to, final String... fields) {
        for (final String field : fields) {
            if (from.has(field)) {
                to.add(field, from.get(field).deepCopy());
            }
        }
    }
}
