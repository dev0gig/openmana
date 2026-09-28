package org.openmana.engine.smoke;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.util.Localizer;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.Protocol;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * A scripted human player for engine tests on the JVM: an {@link EngineHost}
 * that answers the bridge's questions like a UI would, using only what the
 * protocol says (questions, buttons, Forge's playable/action/highlight
 * markers). It knows no card and no rule; it picks among what Forge offers.
 *
 * <p>Policy, deterministic: mulligan once, then keep and put cards back by
 * tapping hand cards until Forge enables OK; during priority tap every card
 * Forge marks playable once per step, otherwise pass; pay costs alternately
 * with Forge's auto payment and by tapping the sources Forge marks; attack
 * with every creature Forge offers an attack action for; never block; choose
 * the first allowed option everywhere else. Once, it also sends inputs that
 * must be rejected (unknown question, withdrawn question, invalid button,
 * unknown card, a card tap while a blocking question is open) to prove the
 * bridge refuses them loudly, and asks for the state twice (at a priority and
 * during a blocking question), which the bridge must serve at once.
 *
 * <p>Every input it hands to the engine is recorded (numbered with {@code seq}
 * like the page's EngineClient does); the Wasm tests replay that transcript
 * through the SharedArrayBuffer input queue. It also checks the protocol's
 * question lifecycle as it goes: every question is closed exactly once
 * (question.answered or question.withdrawn), the blocking flag matches the
 * kind, rejections carry the seq of the rejected input, nothing is open when
 * the game ends. Violations are counted under "protocol:"; tests expect none.
 *
 * <p>{@link #concedingInTurn(int)} gives a player that concedes at its first
 * input from that turn on, whatever question is open. {@link #defending()}
 * gives a player that never attacks and, when Forge asks for blockers, taps
 * one of its creatures Forge marks with an action (Forge's InputBlock has
 * already picked the attacker), then confirms. {@link #withPolicy} combines
 * the attack and block policies freely (the differential test fixtures,
 * engine/fixtures/differential): {@link Block#ASSIGN} assigns blockers like a
 * player does in Forge's InputBlock - tap an attacker (Forge makes it the
 * current one), then tap a creature Forge offers to block it - one blocker
 * for each attacker, then a second one for the first attacker while Forge
 * offers more; {@link Attack#ALTERNATE} attacks in every second own combat,
 * so creatures stay back to block in between. Commanders are cast from the
 * command zone like cards from the hand: when Forge marks them playable.
 * {@link Play#RESPOND} (prompt 16) holds its spells for answers: with the
 * stack empty it only plays lands (Forge's own words for the tap, "play a
 * land", compared like the bridge compares Forge's labels), with something
 * on the stack it taps every card Forge marks playable, once per stack depth
 * - so it gets priority in the opponent's turn and answers the opponent's
 * spells.
 *
 * <p>Targets and payment (prompt 17, protocol 6): a player is only ever
 * tapped where the state marks them selectable (Forge's running input would
 * take them) and not yet chosen, the opponent first; {@link Target#PLAYERS}
 * chooses such a player before any card. While paying, floating mana Forge
 * would take from the pool (the state's payment) is used first, then life
 * where Forge takes the player (Phyrexian mana), then the sources or Forge's
 * auto payment as above.
 */
public final class ScriptedHuman implements EngineHost {

    private static final int MAX_INPUTS = 20_000;
    /**
     * Transcript format; 2 = protocol 1 (inputs carry seq, answers their kind),
     * 3 = with the engine settings and, if the match was traced, the engine
     * trace of the JVM game (prompt 05).
     */
    public static final String TRANSCRIPT_FORMAT = "openmana-input-transcript/3";
    private static final Set<String> BLOCKING_KINDS = Set.of(
            Protocol.KIND_CHOOSE, Protocol.KIND_CONFIRM, Protocol.KIND_OPTIONS,
            Protocol.KIND_INPUT, Protocol.KIND_ORDER, Protocol.KIND_ARRANGE, Protocol.KIND_DISTRIBUTE);

    private final List<JsonObject> inputs = new ArrayList<>();
    private final Map<Long, JsonObject> open = new LinkedHashMap<>();
    private final Set<Long> withdrawn = new HashSet<>();
    /** Every question the engine asked that is not closed yet (protocol lifecycle, independent of the policy). */
    private final Set<Long> unclosed = new HashSet<>();
    private final Set<Long> closed = new HashSet<>();
    private final List<JsonObject> rejections = new ArrayList<>();
    private final Map<String, Integer> counters = new TreeMap<>();
    private final Set<String> tried = new HashSet<>();
    private final Set<String> threads = new HashSet<>();

    private JsonObject state;
    private JsonObject end;
    private long lastWithdrawn = -1;
    private int mulligans;
    private int paymentsStarted;
    /** Mode of the payment in progress: null = none running, true = tap sources, false = Forge's auto pay. */
    private Boolean manualPayment;
    private int faultStep;
    private int blockingExtraStep;
    /** A state.request was sent; the next state message answers it. */
    private boolean stateRequested;
    /** When the player attacks (see class comment). */
    public enum Attack { ALL, NONE, ALTERNATE }

    /** How the player blocks (see class comment). */
    public enum Block { NONE, ONE, ASSIGN }

    /** How the player plays cards at priority (see class comment). */
    public enum Play { ALL, RESPOND }

    /** What the player chooses first where Forge offers cards and players (see class comment). */
    public enum Target { CARDS, PLAYERS }

    private Attack attack = Attack.ALL;
    private Block block = Block.NONE;
    private Play play = Play.ALL;
    private Target target = Target.CARDS;
    /** ALTERNATE: whether the player attacks in a turn, decided at its first attack question of that turn. */
    private final Map<Integer, Boolean> attacksInTurn = new TreeMap<>();
    /** Turn from which on the player concedes; 0 = never. */
    private int concedeInTurn;
    private int concededInTurn;

    public ScriptedHuman() {
    }

    /** A scripted player that never attacks and blocks where Forge lets it. */
    public static ScriptedHuman defending() {
        return withPolicy(Attack.NONE, Block.ONE, 0);
    }

    /** A scripted player with the given attack and block policy that concedes in the given turn (0 = never). */
    public static ScriptedHuman withPolicy(final Attack attack, final Block block, final int concedeInTurn) {
        return withPolicy(attack, block, Play.ALL, concedeInTurn);
    }

    /** A scripted player with the given attack, block and play policy that concedes in the given turn (0 = never). */
    public static ScriptedHuman withPolicy(final Attack attack, final Block block, final Play play, final int concedeInTurn) {
        final ScriptedHuman human = new ScriptedHuman();
        human.attack = attack;
        human.block = block;
        human.play = play;
        human.concedeInTurn = concedeInTurn;
        return human;
    }

    /**
     * The policy of a differential test fixture:
     * {@code {"attack": "all"|"none"|"alternate", "block": "none"|"one"|"assign", "play": "all"|"respond",
     * "target": "cards"|"players", "concedeInTurn": 0}},
     * every field optional (defaults: all, none, all, cards, 0). Anything else is refused.
     */
    public static ScriptedHuman fromPolicy(final JsonObject policy) {
        for (final String field : policy.keySet()) {
            if (!Set.of("attack", "block", "play", "target", "concedeInTurn").contains(field)) {
                throw new IllegalArgumentException("unknown player policy field '" + field + "'");
            }
        }
        final Attack attack = policy.has("attack") ? Attack.valueOf(policy.get("attack").getAsString().toUpperCase(java.util.Locale.ROOT)) : Attack.ALL;
        final Block block = policy.has("block") ? Block.valueOf(policy.get("block").getAsString().toUpperCase(java.util.Locale.ROOT)) : Block.NONE;
        final Play play = policy.has("play") ? Play.valueOf(policy.get("play").getAsString().toUpperCase(java.util.Locale.ROOT)) : Play.ALL;
        final int concede = policy.has("concedeInTurn") ? policy.get("concedeInTurn").getAsInt() : 0;
        if (concede < 0) {
            throw new IllegalArgumentException("concedeInTurn must not be negative");
        }
        final ScriptedHuman human = withPolicy(attack, block, play, concede);
        if (policy.has("target")) {
            human.target = Target.valueOf(policy.get("target").getAsString().toUpperCase(java.util.Locale.ROOT));
        }
        return human;
    }

    /** A scripted player that concedes at its first input in or after the given turn. */
    public static ScriptedHuman concedingInTurn(final int turn) {
        final ScriptedHuman human = new ScriptedHuman();
        human.concedeInTurn = turn;
        return human;
    }

    // ── EngineHost ────────────────────────────────────────────────────────────────

    /** The last messages, for a readable failure when the policy gets stuck. */
    private final java.util.ArrayDeque<String> recent = new java.util.ArrayDeque<>();

    @Override
    public void emit(final JsonObject message) {
        threads.add(Thread.currentThread().getName());
        final String brief = message.get("type").getAsString().equals(Protocol.STATE)
                ? "state turn=" + message.get("turn") + " phase=" + message.get("phase")
                : message.toString();
        recent.addLast(brief.length() > 400 ? brief.substring(0, 400) + "…" : brief);
        if (recent.size() > 25) {
            recent.removeFirst();
        }
        final String type = message.get("type").getAsString();
        count("emit:" + type);
        switch (type) {
            case Protocol.STATE -> {
                state = message;
                if (stateRequested) {
                    stateRequested = false;
                    count("state-request:answered");
                }
                // What the opponent's hand reveals: nothing but its size.
                for (final JsonElement p : message.getAsJsonArray("players")) {
                    final JsonObject player = p.getAsJsonObject();
                    if (player.get("me").getAsBoolean()) {
                        continue;
                    }
                    for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray("hand")) {
                        final JsonObject card = c.getAsJsonObject();
                        count(card.has("hidden") ? "state:opponent-hand-hidden" : "state:opponent-hand-visible");
                        if (card.has("id") || card.has("name") || card.has("key")) {
                            count("state:opponent-hand-leak");
                        }
                    }
                }
                // Forge accepted a block of this player: its creature is marked blocking.
                for (final JsonElement p : message.getAsJsonArray("players")) {
                    final JsonObject player = p.getAsJsonObject();
                    for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray("battlefield")) {
                        if (player.get("me").getAsBoolean() && c.getAsJsonObject().has("blocking")) {
                            count("state:my-blocker");
                        }
                    }
                }
            }
            case Protocol.QUESTION -> {
                final long id = message.get("id").getAsLong();
                open.put(id, message);
                final String kind = message.get("kind").getAsString();
                count("question:" + kind);
                if (message.has("purpose")) {
                    count("purpose:" + message.get("purpose").getAsString());
                }
                if (!message.has("blocking") || message.get("blocking").getAsBoolean() != BLOCKING_KINDS.contains(kind)) {
                    count("protocol:blocking-flag-wrong");
                }
                if (!unclosed.add(id) || closed.contains(id)) {
                    count("protocol:question-id-reused");
                }
            }
            case Protocol.QUESTION_WITHDRAWN -> {
                final long id = message.get("id").getAsLong();
                open.remove(id);
                withdrawn.add(id);
                lastWithdrawn = id;
                closeQuestion(id);
            }
            case Protocol.QUESTION_ANSWERED -> {
                final long id = message.get("id").getAsLong();
                open.remove(id);
                pendingAnswers.remove(id);
                closeQuestion(id);
                final long seq = message.get("seq").getAsLong();
                if (seq < 1 || seq > inputs.size()) {
                    count("protocol:answered-by-unknown-input");
                } else if (inputs.get((int) seq - 1).get("question") == null
                        || inputs.get((int) seq - 1).get("question").getAsLong() != id) {
                    count("protocol:answered-by-other-input");
                }
            }
            case Protocol.INPUT_REJECTED -> {
                rejections.add(message);
                count("rejected:" + message.get("reason").getAsString());
                final JsonObject input = message.getAsJsonObject("input");
                if (!message.has("seq") || !input.has("seq") || message.get("seq").getAsLong() != input.get("seq").getAsLong()) {
                    count("protocol:rejected-without-its-seq");
                }
                // An answer to a blocking question that was refused keeps it open.
                if (input.has("question") && pendingAnswers.containsKey(input.get("question").getAsLong())) {
                    final long id = input.get("question").getAsLong();
                    open.put(id, pendingAnswers.get(id));
                }
            }
            case Protocol.EVENTS -> {
                for (final JsonElement e : message.getAsJsonArray("entries")) {
                    final JsonObject entry = e.getAsJsonObject();
                    final String actor = entry.has("actor") ? entry.get("actor").getAsString() : "none";
                    count("event:" + actor + ":" + entry.get("kind").getAsString());
                    if ("me".equals(actor) && "STACK_ADD".equals(entry.get("kind").getAsString())) {
                        castByMe.add(entry.get("text").getAsString());
                    }
                }
            }
            case Protocol.GAME_END -> {
                end = message;
                if (!unclosed.isEmpty()) {
                    count("protocol:open-at-game-end");
                }
            }
            default -> { }
        }
    }

    private void closeQuestion(final long id) {
        if (!unclosed.remove(id) || !closed.add(id)) {
            count("protocol:closed-twice-or-unknown");
        }
    }

    /** Numbers the input (seq from 1, second property, like the EngineClient writes it). */
    private static JsonObject withSeq(final JsonObject input, final int seq) {
        final JsonObject ordered = new JsonObject();
        ordered.add("type", input.get("type"));
        ordered.addProperty("seq", seq);
        for (final Map.Entry<String, JsonElement> e : input.entrySet()) {
            if (!"type".equals(e.getKey()) && !"seq".equals(e.getKey())) {
                ordered.add(e.getKey(), e.getValue());
            }
        }
        return ordered;
    }

    /** Questions answered by this player whose answer might still be refused. */
    private final Map<Long, JsonObject> pendingAnswers = new LinkedHashMap<>();

    @Override
    public JsonObject awaitInput() {
        threads.add(Thread.currentThread().getName());
        if (inputs.size() >= MAX_INPUTS) {
            throw new IllegalStateException("scripted player gave up after " + MAX_INPUTS + " inputs; the game does not end");
        }
        if (stateRequested) {
            stateRequested = false;
            count("state-request:unanswered");
        }
        final JsonObject input = withSeq(decide(), inputs.size() + 1);
        inputs.add(input);
        return input.deepCopy();
    }

    // ── Results for tests ─────────────────────────────────────────────────────────

    public List<JsonObject> inputs() {
        return inputs;
    }

    public List<JsonObject> rejections() {
        return rejections;
    }

    public Map<String, Integer> counters() {
        return counters;
    }

    public Set<String> threads() {
        return threads;
    }

    public JsonObject end() {
        return end;
    }

    /** Turn in which this player conceded; 0 = did not concede. */
    public int concededInTurn() {
        return concededInTurn;
    }

    /** The last state message received. */
    public JsonObject lastState() {
        return state;
    }

    /** Every blocking question answered (brief form). */
    public JsonArray blockingQuestions() {
        return blockingAnswered;
    }

    public JsonObject transcript(final JsonObject request, final JsonObject result) {
        final JsonObject t = new JsonObject();
        t.addProperty("format", TRANSCRIPT_FORMAT);
        t.add("request", request);
        final JsonArray a = new JsonArray();
        inputs.forEach(a::add);
        t.add("inputs", a);
        t.add("expected", result);
        final JsonObject c = new JsonObject();
        counters.forEach(c::addProperty);
        t.add("counters", c);
        t.add("blockingQuestions", blockingAnswered);
        t.add("castByPlayer", castByMe);
        return t;
    }

    // ── Policy ────────────────────────────────────────────────────────────────────

    private JsonObject decide() {
        if (concedeInTurn > 0 && concededInTurn == 0 && state != null && state.get("turn").getAsInt() >= concedeInTurn) {
            concededInTurn = state.get("turn").getAsInt();
            count("concede:sent");
            final JsonObject o = new JsonObject();
            o.addProperty("type", Protocol.CONCEDE);
            return o;
        }
        final JsonObject blocking = latestOpen(true);
        if (blocking != null) {
            final JsonObject extra = nextBlockingExtra();
            return extra != null ? extra : answerBlocking(blocking);
        }
        final JsonObject fault = nextFault();
        if (fault != null) {
            return fault;
        }
        final JsonObject select = latestOpen(Protocol.KIND_SELECT);
        if (select != null) {
            return answerSelect(select);
        }
        final JsonObject buttons = latestOpen(Protocol.KIND_BUTTONS);
        if (buttons != null) {
            return answerButtons(buttons);
        }
        throw new IllegalStateException("the engine waits for input, but no question is open (" + open.keySet()
                + "). Last messages:\n" + String.join("\n", recent));
    }

    /**
     * Inputs the bridge must refuse, one per priority question at the start
     * of the game: an unknown question, an invalid button, an unknown card and
     * an answer to a withdrawn question.
     */
    private JsonObject nextFault() {
        final JsonObject priority = latestOpen(Protocol.KIND_BUTTONS);
        if (priority == null || !Protocol.PURPOSE_PRIORITY.equals(string(priority, "purpose"))) {
            return null;
        }
        switch (faultStep) {
            case 0 -> {
                faultStep++;
                count("fault:unknown-question");
                return answer(9_999_999L, Protocol.KIND_BUTTONS, "button", 1);
            }
            case 1 -> {
                faultStep++;
                count("fault:invalid-button");
                return answer(priority.get("id").getAsLong(), Protocol.KIND_BUTTONS, "button", 3);
            }
            case 2 -> {
                faultStep++;
                count("fault:unknown-card");
                final JsonObject o = new JsonObject();
                o.addProperty("type", Protocol.CARD_TAP);
                o.addProperty("card", -5);
                return o;
            }
            case 3 -> {
                if (lastWithdrawn < 0) {
                    return null;
                }
                faultStep++;
                count("fault:withdrawn-question");
                return answer(lastWithdrawn, Protocol.KIND_BUTTONS, "button", 1);
            }
            case 4 -> {
                faultStep++;
                return stateRequest("priority");
            }
            default -> {
                return null;
            }
        }
    }

    /**
     * At the first blocking question: ask for the state (served while the
     * question stays open), then tap a card of the player's own, which must be
     * refused as "not-active": only the blocking question can be answered now.
     */
    private JsonObject nextBlockingExtra() {
        switch (blockingExtraStep) {
            case 0 -> {
                blockingExtraStep++;
                return stateRequest("blocking");
            }
            case 1 -> {
                JsonObject card = firstCard(true, "battlefield", c -> true, "blocking-tap");
                if (card == null) {
                    card = firstCard(true, "hand", c -> true, "blocking-tap");
                }
                if (card == null) {
                    return null;
                }
                blockingExtraStep++;
                count("fault:tap-during-blocking");
                return cardTap(card);
            }
            default -> {
                return null;
            }
        }
    }

    private JsonObject stateRequest(final String where) {
        count("extra:state-request:" + where);
        stateRequested = true;
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.STATE_REQUEST);
        return o;
    }

    /** Forge's log lines of spells and abilities this player put on the stack. */
    private final JsonArray castByMe = new JsonArray();

    /** Short record of every blocking question answered, for the transcript. */
    private final JsonArray blockingAnswered = new JsonArray();

    private JsonObject answerBlocking(final JsonObject q) {
        final long id = q.get("id").getAsLong();
        open.remove(id);
        pendingAnswers.put(id, q);
        final String kind = q.get("kind").getAsString();
        count("answer:" + kind);
        final JsonObject brief = new JsonObject();
        for (final String field : new String[]{"id", "kind", "text", "min", "max", "remainingMin", "remainingMax", "total",
                "toTop", "toBottom", "others"}) {
            if (q.has(field)) {
                brief.add(field, q.get(field));
            }
        }
        brief.addProperty("items", q.has("items") ? q.getAsJsonArray("items").size() : 0);
        blockingAnswered.add(brief);
        final JsonObject a = answer(id, kind, null, 0);
        switch (kind) {
            case Protocol.KIND_CHOOSE -> {
                final JsonArray choices = new JsonArray();
                for (int nr = 1; nr <= q.get("min").getAsInt(); nr++) {
                    choices.add(nr);
                }
                a.add("choices", choices);
            }
            case Protocol.KIND_CONFIRM -> a.addProperty("yes", !q.has("suggested") || q.get("suggested").getAsBoolean());
            case Protocol.KIND_OPTIONS -> {
                final int items = q.getAsJsonArray("items").size();
                a.addProperty("option", q.has("suggested") ? q.get("suggested").getAsInt() : items > 0 ? 1 : 0);
            }
            case Protocol.KIND_INPUT -> a.addProperty("value", q.has("suggested") && !q.get("suggested").isJsonNull()
                    ? q.get("suggested").getAsString() : "0");
            case Protocol.KIND_ORDER -> {
                // Leave as many items behind as Forge allows (remainingMax;
                // negative = any, then move exactly one), keep their order.
                final int n = q.getAsJsonArray("items").size();
                final int remainingMax = q.has("remainingMax") ? q.get("remainingMax").getAsInt() : 0;
                final int chosen = remainingMax < 0 ? Math.min(1, n) : n - Math.min(remainingMax, n);
                final JsonArray order = new JsonArray();
                for (int nr = 1; nr <= chosen; nr++) {
                    order.add(nr);
                }
                a.add("order", order);
                count(remainingMax == 0 ? "order:all" : "order:subset");
            }
            case Protocol.KIND_ARRANGE -> {
                // First movable card to the bottom (if allowed), the rest on top.
                final int n = q.getAsJsonArray("items").size();
                for (final JsonElement item : q.getAsJsonArray("items")) {
                    if (item.getAsJsonObject().has("hidden")) {
                        count("arrange:hidden-item");
                    }
                }
                final boolean toTop = q.get("toTop").getAsBoolean();
                final boolean toBottom = q.get("toBottom").getAsBoolean();
                final JsonArray top = new JsonArray();
                final JsonArray bottom = new JsonArray();
                for (int nr = 1; nr <= n; nr++) {
                    if ((nr == 1 && toBottom) || !toTop) {
                        bottom.add(nr);
                    } else {
                        top.add(nr);
                    }
                }
                a.add("top", top);
                a.add("bottom", bottom);
                count("arrange:bottom=" + bottom.size());
            }
            case Protocol.KIND_DISTRIBUTE -> {
                final int n = q.getAsJsonArray("items").size();
                final int total = q.get("total").getAsInt();
                final int min = q.get("min").getAsInt();
                final JsonArray amounts = new JsonArray();
                for (int i = 0; i < n; i++) {
                    amounts.add(i == 0 ? total - min * (n - 1) : min);
                }
                a.add("amounts", amounts);
            }
            default -> throw new IllegalStateException("unexpected blocking question " + q);
        }
        return a;
    }

    /** Items of a selection question this player has already tapped. */
    private final Map<Long, Set<Integer>> selected = new LinkedHashMap<>();

    /**
     * Targets, cards to discard and similar: tap the offered cards one by one
     * up to Forge's maximum, then confirm with OK if Forge offers it. Players
     * Forge would take (marked selectable in the state) are tapped too -
     * after the cards, or first with {@link Target#PLAYERS}.
     */
    private JsonObject answerSelect(final JsonObject q) {
        final long id = q.get("id").getAsLong();
        final JsonArray cards = q.getAsJsonArray("cards");
        final Set<Integer> chosen = selected.computeIfAbsent(id, k -> new HashSet<>());
        if (target == Target.PLAYERS) {
            final JsonObject player = playerToChoose("player-target:" + id, false);
            if (player != null) {
                return player;
            }
        }
        if (!cards.isEmpty() && chosen.size() < q.get("max").getAsInt()) {
            for (int nr = 1; nr <= cards.size(); nr++) {
                if (chosen.add(nr)) {
                    count("answer:select");
                    final JsonObject a = answer(id, Protocol.KIND_SELECT, null, 0);
                    final JsonArray choices = new JsonArray();
                    choices.add(nr);
                    a.add("choices", choices);
                    return a;
                }
            }
        }
        // Players Forge would take (player.tap), the opponent first.
        final JsonObject player = playerToChoose("player-target:" + id, true);
        if (player != null) {
            return player;
        }
        final JsonObject buttons = latestOpen(Protocol.KIND_BUTTONS);
        if (buttons != null) {
            return answerButtons(buttons);
        }
        throw new IllegalStateException("selection " + id + " cannot be completed. Last messages:\n" + String.join("\n", recent));
    }

    private JsonObject answerButtons(final JsonObject q) {
        final long id = q.get("id").getAsLong();
        final String purpose = string(q, "purpose");
        final boolean enabled1 = enabled(q, 1);
        final boolean enabled2 = enabled(q, 2);
        if (Protocol.PURPOSE_MULLIGAN.equals(purpose)) {
            if (mulligans < 1 && enabled2) {
                mulligans++;
                count("mulligan:taken");
                return press(q, 2);
            }
            count("mulligan:kept");
            return press(q, 1);
        }
        if (Protocol.PURPOSE_MULLIGAN_BOTTOM.equals(purpose)) {
            if (enabled1) {
                return press(q, 1);
            }
            final JsonObject card = firstCard(true, "hand", c -> !c.has("highlighted"), "bottom:" + id);
            if (card != null) {
                count("tap:mulligan-bottom");
                return cardTap(card);
            }
            return press(q, enabled2 ? 2 : 1);
        }
        if (Protocol.PURPOSE_PAYMENT.equals(purpose)) {
            if (manualPayment == null) {
                manualPayment = paymentsStarted++ % 2 == 1;
                count(manualPayment ? "payment:manual" : "payment:auto");
            }
            // Floating mana Forge takes from the pool, then life for mana (protocol 6).
            final JsonObject fromPool = manaFromPool(id);
            if (fromPool != null) {
                return fromPool;
            }
            final JsonObject life = lifeForMana(id);
            if (life != null) {
                return life;
            }
            if (manualPayment) {
                final JsonObject source = firstPlayable("pay:" + id);
                if (source != null) {
                    count("tap:payment");
                    return cardTap(source);
                }
            }
            if (enabled1) {
                return press(q, 1);
            }
            return press(q, 2);
        }
        manualPayment = null;
        if (Protocol.PURPOSE_PRIORITY.equals(purpose)) {
            final boolean stackEmpty = state == null || state.getAsJsonArray("stack").isEmpty();
            count(stackEmpty ? "priority:stack-empty" : "priority:stack");
            final JsonObject card = play == Play.RESPOND && stackEmpty
                    ? firstCard(true, "hand", c -> c.has("playable") && isLandPlay(c), "priority:" + step())
                    : firstPlayable("priority:" + step());
            if (card != null) {
                count("tap:priority");
                if (!stackEmpty) {
                    count("tap:priority-response");
                }
                return cardTap(card);
            }
            count("pass");
            return press(q, 1);
        }
        if (Protocol.PURPOSE_ATTACK.equals(purpose) && !attacksThisTurn()) {
            count("attack:skipped");
            return press(q, enabled1 ? 1 : 2);
        }
        if (block == Block.ASSIGN && Protocol.PURPOSE_BLOCK.equals(purpose)) {
            return assignBlockers(q);
        }
        if (block == Block.ONE && Protocol.PURPOSE_BLOCK.equals(purpose)) {
            // One blocker per combat: as long as none of this player's creatures blocks yet.
            final JsonObject blocker = myBlockers() > 0 ? null : firstCard(true, "battlefield",
                    c -> c.has("action") && !c.has("blocking"), "block:" + turn());
            if (blocker != null) {
                count("tap:blocker");
                return cardTap(blocker);
            }
            count("buttons:block");
            return press(q, enabled1 ? 1 : 2);
        }
        if (Protocol.PURPOSE_ATTACK.equals(purpose) || Protocol.PURPOSE_ATTACK_DECLARED.equals(purpose)) {
            final JsonObject attacker = firstCard(true, "battlefield",
                    c -> c.has("action") && !c.has("attacking"), "attack:" + turn());
            if (attacker != null) {
                count("tap:attacker");
                return cardTap(attacker);
            }
            return press(q, enabled1 ? 1 : 2);
        }
        // Blocking and everything else: the first enabled button (no blocks).
        count("buttons:" + (purpose == null ? "other" : purpose));
        return press(q, enabled1 ? 1 : 2);
    }

    /** ALL: always; NONE: never; ALTERNATE: in the first, third, fifth … turn Forge asks this player for attackers. */
    private boolean attacksThisTurn() {
        return switch (attack) {
            case ALL -> true;
            case NONE -> false;
            case ALTERNATE -> attacksInTurn.computeIfAbsent(turn(), t -> attacksInTurn.size() % 2 == 0);
        };
    }

    /**
     * Blocker assignment through Forge's InputBlock (class comment): first one
     * blocker for every attacker in combat order, then a second one for the
     * first attacker. An attacker is made current by tapping it (Forge
     * highlights it); a blocker is only ever a creature Forge offers an action
     * for, so Forge alone decides what may block what.
     */
    private JsonObject assignBlockers(final JsonObject q) {
        final List<Integer> attackers = new ArrayList<>();
        final Map<Integer, Integer> blockers = new TreeMap<>();
        if (state != null) {
            for (final JsonElement e : state.getAsJsonArray("combat")) {
                final JsonObject entry = e.getAsJsonObject();
                attackers.add(entry.get("attacker").getAsInt());
                blockers.put(entry.get("attacker").getAsInt(), entry.getAsJsonArray("blockers").size());
            }
        }
        final Integer current = highlightedOpponentCard();
        for (int round = 1; round <= 2; round++) {
            for (int i = 0; i < attackers.size(); i++) {
                if (round == 2 && i > 0) {
                    break;
                }
                final int attacker = attackers.get(i);
                final String key = "assign" + round + ":" + turn() + ":" + attacker;
                if (blockers.getOrDefault(attacker, 0) >= round || tried.contains(key + ":done")) {
                    continue;
                }
                if (current == null || current != attacker) {
                    if (tried.add(key + ":select")) {
                        count("tap:block-attacker");
                        return cardTap(attacker);
                    }
                    tried.add(key + ":done");
                    continue;
                }
                final JsonObject blocker = firstCard(true, "battlefield", c -> c.has("action") && !c.has("blocking"), key);
                if (blocker != null) {
                    count("tap:blocker");
                    return cardTap(blocker);
                }
                tried.add(key + ":done");
            }
        }
        count("buttons:block");
        return press(q, enabled(q, 1) ? 1 : 2);
    }

    /** The opponent's card Forge highlights: during blocking, the attacker being blocked. */
    private Integer highlightedOpponentCard() {
        if (state == null) {
            return null;
        }
        for (final JsonElement p : state.getAsJsonArray("players")) {
            final JsonObject player = p.getAsJsonObject();
            if (player.get("me").getAsBoolean()) {
                continue;
            }
            for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray("battlefield")) {
                final JsonObject card = c.getAsJsonObject();
                if (card.has("highlighted") && card.has("id")) {
                    return card.get("id").getAsInt();
                }
            }
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private JsonObject latestOpen(final boolean blocking) {
        JsonObject latest = null;
        for (final JsonObject q : open.values()) {
            if (BLOCKING_KINDS.contains(q.get("kind").getAsString()) == blocking) {
                latest = q;
            }
        }
        return latest;
    }

    private JsonObject latestOpen(final String kind) {
        JsonObject latest = null;
        for (final JsonObject q : open.values()) {
            if (kind.equals(q.get("kind").getAsString())) {
                latest = q;
            }
        }
        return latest;
    }

    private JsonObject press(final JsonObject q, final int button) {
        final long id = q.get("id").getAsLong();
        open.remove(id);
        count("press:" + button);
        return answer(id, Protocol.KIND_BUTTONS, "button", button);
    }

    private static JsonObject answer(final long question, final String kind, final String field, final int value) {
        final JsonObject a = new JsonObject();
        a.addProperty("type", Protocol.ANSWER);
        a.addProperty("question", question);
        a.addProperty("kind", kind);
        if (field != null) {
            a.addProperty(field, value);
        }
        return a;
    }

    private static JsonObject cardTap(final JsonObject card) {
        return cardTap(card.get("id").getAsInt());
    }

    private static JsonObject cardTap(final int card) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.CARD_TAP);
        o.addProperty("card", card);
        return o;
    }

    /**
     * A player the state marks selectable (Forge's running input would take
     * them) and not yet chosen, the opponent first (the player themself only
     * with {@code withMe}), each once per key.
     */
    private JsonObject playerToChoose(final String key, final boolean withMe) {
        for (final boolean me : withMe ? new boolean[]{false, true} : new boolean[]{false}) {
            final JsonObject player = player(me);
            if (player != null && player.has("selectable") && !player.has("highlighted")
                    && tried.add(key + ":" + player.get("id").getAsInt())) {
                count(me ? "tap:player-me" : "tap:player-opponent");
                count("tap:player");
                return playerTap(player.get("id").getAsInt());
            }
        }
        return null;
    }

    /** Floating mana the running payment takes (the state's payment.pool), once per remaining cost. */
    private JsonObject manaFromPool(final long question) {
        final JsonObject payment = state == null || !state.has("payment") ? null : state.getAsJsonObject("payment");
        if (payment == null || payment.get("pool").getAsString().isEmpty()) {
            return null;
        }
        final String color = payment.get("pool").getAsString().substring(0, 1);
        if (!tried.add("pool:" + question + ":" + payment.get("cost").getAsString() + ":" + payment.get("pool").getAsString())) {
            return null;
        }
        count("mana:pool");
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.MANA_USE);
        o.addProperty("color", color);
        return o;
    }

    /** Life for mana where Forge's payment takes the player (Phyrexian mana), once per remaining cost. */
    private JsonObject lifeForMana(final long question) {
        final JsonObject me = player(true);
        final JsonObject payment = state == null || !state.has("payment") ? null : state.getAsJsonObject("payment");
        if (me == null || payment == null || !me.has("selectable")
                || !tried.add("life:" + question + ":" + payment.get("cost").getAsString())) {
            return null;
        }
        count("tap:player-life");
        return playerTap(me.get("id").getAsInt());
    }

    private JsonObject player(final boolean me) {
        if (state == null) {
            return null;
        }
        for (final JsonElement p : state.getAsJsonArray("players")) {
            if (p.getAsJsonObject().get("me").getAsBoolean() == me) {
                return p.getAsJsonObject();
            }
        }
        return null;
    }

    private static JsonObject playerTap(final int player) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.PLAYER_TAP);
        o.addProperty("player", player);
        return o;
    }

    /** First card Forge marks as playable (hand, battlefield, then command zone: a commander), once per key. */
    private JsonObject firstPlayable(final String key) {
        final JsonObject inHand = firstCard(true, "hand", c -> c.has("playable"), key);
        if (inHand != null) {
            return inHand;
        }
        final JsonObject onBattlefield = firstCard(true, "battlefield", c -> c.has("playable"), key);
        return onBattlefield != null ? onBattlefield : firstCard(true, "command", c -> c.has("playable"), key);
    }

    private interface CardFilter {
        boolean test(JsonObject card);
    }

    /** Forge's words for the tap are its own "play a land" (the label key the input takes them from). */
    private static boolean isLandPlay(final JsonObject card) {
        return card.has("action") && card.get("action").getAsString().equals(Localizer.getInstance().getMessage("lblPlayLand"));
    }

    private JsonObject firstCard(final boolean mine, final String zone, final CardFilter filter, final String key) {
        if (state == null) {
            return null;
        }
        for (final JsonElement p : state.getAsJsonArray("players")) {
            final JsonObject player = p.getAsJsonObject();
            if (player.get("me").getAsBoolean() != mine) {
                continue;
            }
            for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray(zone)) {
                final JsonObject card = c.getAsJsonObject();
                if (card.has("hidden") || !filter.test(card)) {
                    continue;
                }
                if (tried.add(key + ":" + card.get("id").getAsInt())) {
                    return card;
                }
            }
        }
        return null;
    }

    private int myBlockers() {
        int blockers = 0;
        if (state != null) {
            for (final JsonElement p : state.getAsJsonArray("players")) {
                final JsonObject player = p.getAsJsonObject();
                if (!player.get("me").getAsBoolean()) {
                    continue;
                }
                for (final JsonElement c : player.getAsJsonObject("zones").getAsJsonArray("battlefield")) {
                    if (c.getAsJsonObject().has("blocking")) {
                        blockers++;
                    }
                }
            }
        }
        return blockers;
    }

    private String step() {
        if (state == null) {
            return "none";
        }
        return turn() + "/" + string(state, "phase") + "/" + state.getAsJsonArray("stack").size();
    }

    private int turn() {
        return state == null || !state.has("turn") ? 0 : state.get("turn").getAsInt();
    }

    private static boolean enabled(final JsonObject q, final int nr) {
        for (final JsonElement b : q.getAsJsonArray("buttons")) {
            final JsonObject button = b.getAsJsonObject();
            if (button.get("nr").getAsInt() == nr) {
                return button.get("enabled").getAsBoolean();
            }
        }
        return false;
    }

    private static String string(final JsonObject o, final String field) {
        final JsonElement e = o.get(field);
        return e == null || e.isJsonNull() ? null : e.getAsString();
    }

    private void count(final String key) {
        counters.merge(key, 1, Integer::sum);
    }
}
