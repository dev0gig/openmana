package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.deck.CardPool;
import forge.game.GameEntityView;
import forge.gamemodes.match.CombatDamageAssignment;
import forge.game.GameLogEntry;
import forge.game.GameLogVerbosity;
import forge.game.GameOutcome;
import forge.game.GameState;
import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.phase.PhaseType;
import forge.game.player.DelayedReveal;
import forge.game.player.IHasIcon;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbilityView;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.AbstractGuiGame;
import forge.gamemodes.match.input.Input;
import forge.gamemodes.match.input.InputBlock;
import forge.gamemodes.match.input.InputSyncronizedBase;
import forge.gui.interfaces.IGuiGame;
import forge.interfaces.IGameController;
import forge.item.PaperCard;
import forge.localinstance.skin.FSkinProp;
import forge.player.PlayerZoneUpdate;
import forge.player.PlayerZoneUpdates;
import forge.trackable.TrackableCollection;
import forge.util.FSerializableFunction;
import forge.util.ITriggerEvent;
import forge.util.Localizer;
import org.openmana.engine.EngineDiagnostics;
import org.openmana.engine.trace.EngineTrace;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Forge's GUI for the human seat, running entirely on Forge's single game
 * thread: every decision Forge asks for becomes a numbered {@code question},
 * the answer comes back through {@link EngineHost#awaitInput()}.
 *
 * <p>Behavioural reference: Anvil's {@code AnvilProtokollGui} (dev0gig/forge,
 * forge-anvil) and PROTOKOLL.md. What changed for the browser:
 * <ul>
 *   <li><b>No threads.</b> Anvil answered button and card questions on its own
 *       executor while the game thread slept on Forge's latch. Here Forge's
 *       input latch runs an input pump on the game thread (Forge patch 0004):
 *       {@link #pumpOnce()} waits for one input and hands it to Forge;
 *       nested inputs (targets, costs) nest on the same stack.</li>
 *   <li><b>No timer.</b> Anvil sent the state every 120 ms from a scheduler.
 *       Here the state goes out before every wait for input, and during AI
 *       turns from Forge's update callbacks, throttled by a clock.</li>
 *   <li><b>Strict answers.</b> Anvil bent malformed answers into shape; here
 *       they are rejected loudly and the question stays open.</li>
 *   <li><b>Players can be tapped</b> ({@code player.tap}): Forge offers player
 *       targets through {@code selectPlayer}, which Anvil's protocol lacked.</li>
 * </ul>
 *
 * <p>Three decision paths exist in Forge (Anvil, M2): methods with a return
 * value (blocking questions here), button state ({@code updateButtons}) and
 * selectable cards ({@code setSelectables}). The last two are non-blocking
 * questions that belong to the input that asked; they are withdrawn as soon as
 * Forge changes them or that input is gone.
 *
 * <p>This class makes no game decision and knows no card, mechanic or rule.
 */
final class BridgeGuiGame extends AbstractGuiGame {

    /** Minimum distance between two state messages sent from Forge's update callbacks. */
    private static final long STATE_INTERVAL_NANOS = 120_000_000L;
    /** After this many input requests past the end of the game something is wrong. */
    private static final int MAX_PUMPS_AFTER_GAME_OVER = 16;

    private static final ZoneType[] TAPPABLE_ZONES = {
        ZoneType.Battlefield, ZoneType.Hand, ZoneType.Graveyard, ZoneType.Exile, ZoneType.Command,
    };

    /** A question the UI may answer. */
    private static final class OpenQuestion {
        final long id;
        final String kind;
        /** The Forge input the question belongs to; null until known (see register). */
        Input owner;
        boolean enabled1;
        boolean enabled2;
        List<CardView> cards;
        int max;

        OpenQuestion(final long id, final String kind, final Input owner) {
            this.id = id;
            this.kind = kind;
            this.owner = owner;
        }
    }

    /** Parses and checks an answer to a blocking question. */
    @FunctionalInterface
    private interface AnswerParser<T> {
        T parse(JsonObject answer) throws Answers.InvalidAnswer;
    }

    private final EngineHost host;
    /** The engine trace of this game (engine tests), or null. */
    private final EngineTrace trace;
    private final StateBuilder state = new StateBuilder(this);
    private final Thread engineThread;

    private long lastQuestionId;
    private final Map<Long, OpenQuestion> open = new LinkedHashMap<>();
    private OpenQuestion buttonsQuestion;
    private OpenQuestion selectQuestion;
    private long blockingQuestion;

    private String lastMessage = "";
    private CardView lastMessageCard;
    private int eventsSent;
    private boolean dirty = true;
    private long lastStateNanos;
    private boolean conceded;
    private boolean finished;
    private int pumpsAfterGameOver;
    private int inputsReceived;
    private final Map<String, Integer> forgeCallbacks = new TreeMap<>();
    private JsonObject endMessage;

    BridgeGuiGame(final EngineHost host, final EngineTrace trace) {
        this.host = host;
        this.trace = trace;
        this.engineThread = Thread.currentThread();
    }

    // ══ Input pump (called by Forge's input latch, patch 0004) ══════════════════

    /** Installs this GUI as Forge's synchronous input pump for the running game. */
    void installPump() {
        InputSyncronizedBase.setSynchronousInputPump(this::pumpOnce);
    }

    void removePump() {
        InputSyncronizedBase.setSynchronousInputPump(null);
    }

    /**
     * One input for the input Forge is waiting on: questions of inputs that
     * are gone are withdrawn, the UI gets the current state, then one input is
     * read and delivered on this thread.
     */
    void pumpOnce() {
        checkThread("pumpOnce");
        if (isGameOver()) {
            if (++pumpsAfterGameOver > MAX_PUMPS_AFTER_GAME_OVER) {
                throw new IllegalStateException("Forge keeps waiting for human input after the game ended");
            }
            return;
        }
        withdrawQuestionsOfFinishedInputs();
        sendState();
        final JsonObject input = nextInput();
        switch (typeOf(input)) {
            case Protocol.ANSWER -> answerOpenQuestion(input);
            case Protocol.CARD_TAP -> tapCard(input);
            case Protocol.PLAYER_TAP -> tapPlayer(input);
            case Protocol.MANA_USE -> useMana(input);
            case Protocol.STATE_REQUEST -> sendStateNow();
            case Protocol.CONCEDE -> concedeNow();
            default -> reject(input, Protocol.REJECT_MALFORMED, "unknown input type");
        }
    }

    private void answerOpenQuestion(final JsonObject input) {
        final long id = questionId(input);
        final IGameController controller = getGameController();
        if (buttonsQuestion != null && buttonsQuestion.id == id) {
            final OpenQuestion q = buttonsQuestion;
            final int button;
            try {
                Answers.kind(input, q.kind);
                button = Answers.button(input, q.enabled1, q.enabled2);
            } catch (final Answers.InvalidAnswer e) {
                reject(input, Protocol.REJECT_INVALID, e.getMessage());
                return;
            }
            // Closed before Forge reacts: Forge may set the next buttons at once.
            close(q);
            buttonsQuestion = null;
            answered(q, input);
            if (button == 1) {
                controller.selectButtonOk();
            } else {
                controller.selectButtonCancel();
            }
            return;
        }
        if (selectQuestion != null && selectQuestion.id == id) {
            // Answering a selection taps the listed cards, exactly like clicks
            // in Forge's own GUI (Forge toggles, counts and finishes). The
            // question stays open: Forge keeps the same selectable cards until
            // it names new ones (setSelectables) or clears them, and then the
            // question is withdrawn.
            final OpenQuestion q = selectQuestion;
            final List<Integer> choices;
            try {
                Answers.kind(input, q.kind);
                choices = Answers.choices(input, q.cards.size(), 1, q.max);
            } catch (final Answers.InvalidAnswer e) {
                reject(input, Protocol.REJECT_INVALID, e.getMessage());
                return;
            }
            for (final int nr : choices) {
                controller.selectCard(q.cards.get(nr - 1), null, null);
            }
            return;
        }
        reject(input, Protocol.REJECT_STALE, "question " + id + " is not open");
    }

    /**
     * A card tapped without a question: that is how cards are played during
     * priority (InputPassPriority never calls setSelectables). Forge decides
     * what the tap means; a tap Forge ignores is reported, not swallowed.
     */
    private void tapCard(final JsonObject input) {
        final CardView card = findCard(intField(input, "card"));
        if (card == null) {
            reject(input, Protocol.REJECT_UNKNOWN_CARD, "no visible card with this id");
            return;
        }
        if (!getGameController().selectCard(card, null, null)) {
            reject(input, Protocol.REJECT_NO_EFFECT, "Forge did not accept this card in the current step");
        }
    }

    /**
     * A player tapped: Forge's selectPlayer, e.g. to choose a player as a
     * target or to pay life for Phyrexian mana. Forge's selectPlayer says
     * nothing about the result, so the running input is asked first (the same
     * checks its click runs, RunningInput): a player it would not take is
     * refused, never swallowed - also in the declaration of attackers, where a
     * tap makes a defending player the defender (protocol 7).
     */
    private void tapPlayer(final JsonObject input) {
        final PlayerView player = findPlayer(intField(input, "player"));
        if (player == null) {
            reject(input, Protocol.REJECT_UNKNOWN_PLAYER, "no player with this id");
            return;
        }
        final IGameController controller = getGameController();
        if (Boolean.FALSE.equals(RunningInput.takesPlayer(controller, player))) {
            reject(input, Protocol.REJECT_NO_EFFECT, "Forge's running input does not take this player now");
            return;
        }
        controller.selectPlayer(player, null);
    }

    /**
     * Floating mana used for the payment in progress: Forge's click on its
     * mana pool (IGameController.useMana). Only where the running payment
     * would pay with that colour (RunningInput), else refused.
     */
    private void useMana(final JsonObject input) {
        final JsonElement color = input.get("color");
        final byte mana = RunningInput.poolColor(color != null && color.isJsonPrimitive() ? color.getAsString() : null);
        if (mana < 0) {
            reject(input, Protocol.REJECT_MALFORMED, "unknown mana colour");
            return;
        }
        final IGameController controller = getGameController();
        if (!RunningInput.takesMana(controller, mana)) {
            reject(input, Protocol.REJECT_NO_EFFECT, "Forge's payment does not take this mana from the pool now");
            return;
        }
        controller.useMana(mana);
    }

    /**
     * Conceding is the decision itself, so no second confirmation (Anvil
     * lesson: Forge's own concede() asks again). Forge releases every waiting
     * input once the game is over.
     */
    private void concedeNow() {
        conceded = true;
        for (final IGameController controller : getOriginalGameControllers()) {
            controller.concede();
        }
    }

    // ══ Blocking questions (Forge methods with a return value) ═══════════════════

    /**
     * Sends a question and waits for its answer. Meanwhile only this question
     * can be answered: other answers and card taps are rejected ("not-active"),
     * a state request is served, a concession ends the wait with
     * {@code afterGameEnd}.
     */
    private <T> T ask(final JsonObject question, final AnswerParser<T> parser, final T afterGameEnd) {
        checkThread("ask");
        if (isGameOver()) {
            return afterGameEnd;
        }
        final long id = ++lastQuestionId;
        question.addProperty("id", id);
        question.addProperty("blocking", true);
        final OpenQuestion q = new OpenQuestion(id, question.get("kind").getAsString(), null);
        open.put(id, q);
        final long previousBlocking = blockingQuestion;
        blockingQuestion = id;
        try {
            sendStateNow();
            host.emit(question);
            while (true) {
                final JsonObject input = nextInput();
                final String type = typeOf(input);
                if (Protocol.ANSWER.equals(type)) {
                    final long answered = questionId(input);
                    if (answered == id) {
                        try {
                            Answers.kind(input, q.kind);
                            final T result = parser.parse(input);
                            open.remove(id);
                            answered(q, input);
                            return result;
                        } catch (final Answers.InvalidAnswer e) {
                            reject(input, Protocol.REJECT_INVALID, e.getMessage());
                        }
                    } else if (open.containsKey(answered)) {
                        reject(input, Protocol.REJECT_NOT_ACTIVE, "question " + id + " must be answered first");
                    } else {
                        reject(input, Protocol.REJECT_STALE, "question " + answered + " is not open");
                    }
                } else if (Protocol.CARD_TAP.equals(type) || Protocol.PLAYER_TAP.equals(type) || Protocol.MANA_USE.equals(type)) {
                    reject(input, Protocol.REJECT_NOT_ACTIVE, "question " + id + " must be answered first");
                } else if (Protocol.STATE_REQUEST.equals(type)) {
                    sendStateNow();
                } else if (Protocol.CONCEDE.equals(type)) {
                    // The question ends with the game, unanswered.
                    withdraw(q);
                    concedeNow();
                    return afterGameEnd;
                } else {
                    reject(input, Protocol.REJECT_MALFORMED, "unknown input type");
                }
            }
        } finally {
            if (open.containsKey(id)) {
                // Left without an answer (an exception on the way out): never leave it open silently.
                withdraw(q);
            }
            blockingQuestion = previousBlocking;
        }
    }

    @Override
    public <T> List<T> getChoices(final String message, final int min, final int max, final List<T> choices,
                                  final List<T> selected, final FSerializableFunction<T, String> display) {
        if (max < 0) {
            // Negative limits mean "show, nothing to choose" (Forge's reveal,
            // revealUnsupported; Anvil lesson): a notice the player confirms.
            notice(message, choices, display);
            return new ArrayList<>();
        }
        if (choices.isEmpty()) {
            // Forge's desktop GUI: nothing to show if nothing is required.
            if (min <= 0) {
                return new ArrayList<>();
            }
            throw new IllegalStateException("Forge requires a choice from an empty list: " + message);
        }
        final int upper = Math.min(max, choices.size());
        final int lower = Math.max(0, Math.min(min, upper));
        final JsonObject q = question(Protocol.KIND_CHOOSE, message);
        q.addProperty("min", lower);
        q.addProperty("max", upper);
        q.add("items", items(choices, display));
        if (selected != null && !selected.isEmpty()) {
            final JsonArray suggested = new JsonArray();
            for (final T s : selected) {
                final int i = choices.indexOf(s);
                if (i >= 0) {
                    suggested.add(i + 1);
                }
            }
            q.add("suggested", suggested);
        }
        final List<Integer> picked = ask(q, a -> Answers.choices(a, choices.size(), lower, upper), List.of());
        final List<T> result = new ArrayList<>();
        for (final int nr : picked) {
            result.add(choices.get(nr - 1));
        }
        // After the end of the game Forge still needs a valid-looking list.
        for (int i = 0; result.size() < lower && i < choices.size(); i++) {
            if (!result.contains(choices.get(i))) {
                result.add(choices.get(i));
            }
        }
        return result;
    }

    /**
     * Forge shows a list without a choice (e.g. cards the AI cannot play
     * well). Anvil lesson: Forge's default turns this into a choice with no
     * minimum; it is a notice with one button, and Forge waits until it was seen.
     */
    @Override
    public <T> void reveal(final String message, final List<T> items) {
        notice(message, items, null);
    }

    /** A list to look at with a single OK; Forge continues once it was seen. */
    private <T> void notice(final String message, final List<T> shown, final FSerializableFunction<T, String> display) {
        final JsonObject q = question(Protocol.KIND_OPTIONS, message);
        q.add("items", items(List.of(Localizer.getInstance().getMessage("lblOK")), null));
        q.add("revealed", items(shown, display));
        ask(q, a -> Answers.option(a, 1, false), 1);
    }

    @Override
    public GameEntityView chooseSingleEntityForEffect(final String title, final List<? extends GameEntityView> optionList,
                                                      final DelayedReveal delayedReveal, final boolean isOptional) {
        if (delayedReveal != null) reveal(delayedReveal.getMessagePrefix(), delayedReveal.getCards());
        final List<GameEntityView> list = new ArrayList<>(optionList);
        final int min = isOptional || list.isEmpty() ? 0 : 1;
        final JsonObject q = question(Protocol.KIND_CHOOSE, title);
        q.addProperty("min", min);
        q.addProperty("max", Math.min(1, list.size()));
        q.add("items", items(list, null));
        final List<Integer> picked = ask(q, a -> Answers.choices(a, list.size(), min, Math.min(1, list.size())), List.of());
        if (picked.isEmpty()) {
            return min == 0 ? null : list.get(0);
        }
        return list.get(picked.get(0) - 1);
    }

    @Override
    public List<GameEntityView> chooseEntitiesForEffect(final String title, final List<? extends GameEntityView> optionList,
                                                        final int min, final int max, final DelayedReveal delayedReveal) {
        if (delayedReveal != null) reveal(delayedReveal.getMessagePrefix(), delayedReveal.getCards());
        final List<GameEntityView> list = new ArrayList<>(optionList);
        final int upper = Math.min(max, list.size());
        final int lower = Math.max(0, Math.min(min, upper));
        final JsonObject q = question(Protocol.KIND_CHOOSE, title);
        q.addProperty("min", lower);
        q.addProperty("max", upper);
        q.add("items", items(list, null));
        final List<Integer> picked = ask(q, a -> Answers.choices(a, list.size(), lower, upper), List.of());
        final List<GameEntityView> result = new ArrayList<>();
        for (final int nr : picked) {
            result.add(list.get(nr - 1));
        }
        for (int i = 0; result.size() < lower && i < list.size(); i++) {
            if (!result.contains(list.get(i))) {
                result.add(list.get(i));
            }
        }
        return result;
    }

    @Override
    public boolean confirm(final CardView c, final String question, final boolean defaultIsYes, final List<String> options) {
        final JsonObject q = question(Protocol.KIND_CONFIRM, question);
        attachCard(q, c);
        if (options != null && options.size() >= 2) {
            q.addProperty("yesLabel", options.get(0));
            q.addProperty("noLabel", options.get(1));
        }
        q.addProperty("suggested", defaultIsYes);
        return ask(q, Answers::yes, defaultIsYes);
    }

    @Override
    public boolean showConfirmDialog(final String message, final String title, final String yesButtonText,
                                     final String noButtonText, final boolean defaultYes) {
        final JsonObject q = question(Protocol.KIND_CONFIRM, join(title, message));
        q.addProperty("yesLabel", yesButtonText);
        q.addProperty("noLabel", noButtonText);
        q.addProperty("suggested", defaultYes);
        return ask(q, Answers::yes, defaultYes);
    }

    /**
     * Forge asks which ability of a tapped card to use ("What to do?"). With
     * one ability Forge's own GUI does not ask either.
     */
    @Override
    public SpellAbilityView getAbilityToPlay(final CardView hostCard, final List<SpellAbilityView> abilities,
                                             final ITriggerEvent triggerEvent) {
        if (abilities == null || abilities.isEmpty()) {
            return null;
        }
        if (abilities.size() == 1) {
            return abilities.get(0);
        }
        final JsonObject q = question(Protocol.KIND_OPTIONS, Localizer.getInstance().getMessage("lblChooseAbilityToPlay"));
        attachCard(q, hostCard);
        q.addProperty("cancellable", true);
        q.add("items", items(abilities, null));
        final int option = ask(q, a -> Answers.option(a, abilities.size(), true), 0);
        return option == 0 ? null : abilities.get(option - 1);
    }

    @Override
    public int showOptionDialog(final String message, final String title, final FSkinProp icon,
                                final List<String> options, final int defaultOption) {
        final JsonObject q = question(Protocol.KIND_OPTIONS, join(title, message));
        q.add("items", items(options, null));
        if (defaultOption >= 0 && defaultOption < options.size()) {
            q.addProperty("suggested", defaultOption + 1);
        }
        final int option = ask(q, a -> Answers.option(a, options.size(), false), defaultOption + 1);
        return option - 1;
    }

    @Override
    public String showInputDialog(final String message, final String title, final FSkinProp icon,
                                  final String initialInput, final List<String> inputOptions, final boolean isNumeric) {
        final JsonObject q = question(Protocol.KIND_INPUT, join(title, message));
        q.addProperty("numeric", isNumeric);
        q.addProperty("cancellable", true);
        q.addProperty("suggested", initialInput);
        if (inputOptions != null && !inputOptions.isEmpty()) {
            q.add("items", items(inputOptions, null));
        }
        return ask(q, a -> {
            final String value = Answers.value(a, isNumeric, true);
            if (value != null && inputOptions != null && !inputOptions.isEmpty() && !inputOptions.contains(value)) {
                throw new Answers.InvalidAnswer("value must be one of Forge's input options");
            }
            return value;
        }, null);
    }

    /**
     * Forge's dual list (DualListBox): items move from the source list into an
     * ordered result list, and Forge bounds how many may stay behind. With
     * both bounds 0 that is a plain ordering (e.g. triggers); via many() it is
     * a choice of any number (e.g. scry: "cards to put on the bottom", bounds
     * -1). Anvil treated every call as ordering all items - for a scry that
     * would have put every card on the bottom.
     */
    @Override
    public <T> OrderResult<T> order(final String title, final String top, final int remainingObjectsMin,
                                    final int remainingObjectsMax, final List<T> sourceChoices, final List<T> destChoices,
                                    final CardView referenceCard, final boolean sideboardingMode,
                                    final boolean showRememberCheckbox) {
        final List<T> all = new ArrayList<>(sourceChoices);
        final JsonArray initial = new JsonArray();
        if (destChoices != null) {
            for (final T item : destChoices) {
                all.add(item);
                initial.add(all.size());
            }
        }
        final JsonObject q = question(Protocol.KIND_ORDER, title);
        q.addProperty("top", top);
        q.addProperty("remainingMin", remainingObjectsMin);
        q.addProperty("remainingMax", remainingObjectsMax);
        if (!initial.isEmpty()) {
            q.add("suggested", initial);
        }
        attachCard(q, referenceCard);
        q.add("items", items(all, null));
        final List<Integer> order = ask(q, a -> Answers.order(a, all.size(), remainingObjectsMin, remainingObjectsMax), null);
        if (order == null) {
            // Game over while asking: Forge's own default, the unchanged result list.
            return new IGuiGame.OrderResult<>(destChoices == null ? new ArrayList<>() : new ArrayList<>(destChoices), false);
        }
        return new IGuiGame.OrderResult<>(reorder(all, order), false);
    }

    /**
     * Forge lets the player move some cards of a pile (e.g. the top cards of
     * the library while scrying) to the top or bottom of that pile. Forge
     * passes the WHOLE pile; only the movable cards are sent, the rest only as
     * a count, so no hidden card leaves the engine. The answer says which
     * movable cards go on top and which to the bottom, each in order; the
     * result for Forge is top + untouched rest + bottom.
     */
    @Override
    public List<CardView> manipulateCardList(final String title, final Iterable<CardView> cards,
                                             final Iterable<CardView> manipulable, final boolean toTop,
                                             final boolean toBottom, final boolean toAnywhere) {
        final List<CardView> movable = new ArrayList<>();
        manipulable.forEach(movable::add);
        final List<CardView> rest = new ArrayList<>();
        for (final CardView c : cards) {
            if (!movable.contains(c)) {
                rest.add(c);
            }
        }
        final JsonObject q = question(Protocol.KIND_ARRANGE, title);
        q.addProperty("toTop", toTop);
        q.addProperty("toBottom", toBottom);
        q.addProperty("toAnywhere", toAnywhere);
        q.addProperty("others", rest.size());
        q.add("items", items(movable, null));
        final Answers.Arrangement arrangement = ask(q, a -> Answers.arrange(a, movable.size(), toTop, toBottom, toAnywhere, rest.size()), null);
        final List<CardView> result = new ArrayList<>();
        if (arrangement == null) {
            cards.forEach(result::add);
            return result;
        }
        if (arrangement.positions != null) {
            // Only movable item numbers/slots crossed the boundary. The hidden
            // remainder is restored here, in its original Forge order.
            int nextRest = 0;
            for (int position = 1; position <= movable.size() + rest.size(); position++) {
                final int index = arrangement.positions.indexOf(position);
                result.add(index < 0 ? rest.get(nextRest++) : movable.get(index));
            }
            return result;
        }
        for (final int nr : arrangement.top) {
            result.add(movable.get(nr - 1));
        }
        result.addAll(rest);
        for (final int nr : arrangement.bottom) {
            result.add(movable.get(nr - 1));
        }
        return result;
    }

    @Override
    public Map<CardView, Integer> assignCombatDamage(final CardView attacker, final List<CardView> blockers,
                                                     final int damage, final GameEntityView defender,
                                                     final boolean overrideOrder, final boolean maySkip) {
        final CombatDamageAssignment policy = new CombatDamageAssignment(attacker, blockers, defender, overrideOrder);
        final List<GameEntityView> targets = new ArrayList<>(blockers);
        if (policy.defenderAllowed()) targets.add(defender);
        final JsonObject q = question(Protocol.KIND_DISTRIBUTE, Localizer.getInstance().getMessage("lblNCombatDamage", String.valueOf(damage)));
        attachCard(q, attacker);
        q.addProperty("total", damage);
        q.addProperty("min", 0);
        q.add("items", items(targets, null));
        q.addProperty("maySkip", maySkip);
        final JsonArray prerequisites = new JsonArray();
        for (final CombatDamageAssignment.Prerequisite p : policy.prerequisites()) {
            final JsonObject entry = new JsonObject();
            entry.addProperty("item", p.item() + 1);
            entry.addProperty("requires", p.requires() + 1);
            entry.addProperty("amount", p.amount());
            prerequisites.add(entry);
        }
        q.add("prerequisites", prerequisites);
        final List<Integer> amounts = ask(q, a -> Answers.distribution(a, q), null);
        if (amounts == null) return null; // Forge's explicit postpone, or game ended.
        final Map<CardView, Integer> result = new LinkedHashMap<>();
        for (int i = 0; i < blockers.size(); i++) {
            result.put(blockers.get(i), amounts.get(i));
        }
        if (policy.defenderAllowed()) result.put(null, amounts.get(blockers.size()));
        return result;
    }

    @Override
    public Map<Object, Integer> assignGenericAmount(final CardView effectSource, final Map<Object, Integer> target,
                                                    final int amount, final boolean atLeastOne, final String amountLabel) {
        final List<Object> targets = new ArrayList<>(target.keySet());
        final int min = atLeastOne ? 1 : 0;
        final JsonObject q = question(Protocol.KIND_DISTRIBUTE, amountLabel);
        attachCard(q, effectSource);
        q.addProperty("total", amount);
        q.addProperty("min", min);
        q.add("items", items(targets, null));
        final JsonArray maximums = new JsonArray();
        for (final Object t : targets) maximums.add(target.get(t) == null ? amount : target.get(t));
        q.add("maximums", maximums);
        final List<Integer> amounts = ask(q, a -> Answers.distribution(a, q), null);
        final Map<Object, Integer> result = new LinkedHashMap<>();
        int remaining = amount - min * targets.size();
        for (int i = 0; i < targets.size(); i++) {
            final int extra = Math.min(Math.max(0, remaining), Math.max(0, maximums.get(i).getAsInt() - min));
            result.put(targets.get(i), amounts == null ? min + extra : amounts.get(i));
            remaining -= extra;
        }
        return result;
    }

    /** The supported match has one game; there is no between-game sideboarding. */
    @Override
    public List<PaperCard> sideboard(final CardPool sideboard, final CardPool main, final String message) {
        return null;
    }

    // ══ Non-blocking questions: buttons and selectable cards ═════════════════════

    /**
     * Forge sets the two prompt buttons and waits on its input latch; the
     * answer arrives through the pump. Never blocks here.
     */
    @Override
    public void updateButtons(final PlayerView owner, final String label1, final String label2,
                              final boolean enable1, final boolean enable2, final boolean focus1) {
        checkThread("updateButtons");
        if (buttonsQuestion != null) {
            withdraw(buttonsQuestion);
            buttonsQuestion = null;
        }
        if (!enable1 && !enable2) {
            return;
        }
        final JsonObject q = question(Protocol.KIND_BUTTONS, lastMessage);
        final String purpose = isBlockStep() ? Protocol.PURPOSE_BLOCK : purposeFromLabels(label1, label2);
        if (purpose != null) {
            q.addProperty("purpose", purpose);
        }
        final JsonArray buttons = new JsonArray();
        buttons.add(button(1, label1, enable1, meaningOf(purpose, 1, label1)));
        buttons.add(button(2, label2, enable2, meaningOf(purpose, 2, label2)));
        q.add("buttons", buttons);
        attachSourceCard(q);

        final OpenQuestion oq = register(q, Protocol.KIND_BUTTONS);
        oq.enabled1 = enable1;
        oq.enabled2 = enable2;
        buttonsQuestion = oq;
        sendStateNow();
        host.emit(q);
    }

    /**
     * Forge names the cards that may be selected now (targets, cards to
     * discard ...). Anvil skipped an empty list; here it is sent too, because
     * "no card qualifies" during targeting means a player is the target
     * ({@code player.tap}).
     */
    @Override
    public void setSelectables(final Iterable<CardView> cards, final int min, final int max) {
        super.setSelectables(cards, min, max);
        checkThread("setSelectables");
        if (selectQuestion != null) {
            withdraw(selectQuestion);
            selectQuestion = null;
        }
        final List<CardView> selectable = new ArrayList<>();
        cards.forEach(selectable::add);
        // Forge's own bounds for the whole selection: players Forge takes
        // count too (protocol 6), so they are not cut down to the cards.
        final int upper = max <= 0 ? selectable.size() : max;
        final int lower = Math.min(Math.max(min, 0), upper);

        final JsonObject q = question(Protocol.KIND_SELECT, lastMessage);
        q.addProperty("min", lower);
        q.addProperty("max", upper);
        // Only the ids of cards the player may see: a hidden card is a hidden
        // item without id (ids follow the deck lists and would reveal it).
        final JsonArray ids = new JsonArray();
        for (final CardView c : selectable) {
            if (mayViewSafely(c)) {
                ids.add(c.getId());
            }
        }
        q.add("cards", ids);
        q.add("items", items(selectable, null));
        attachSourceCard(q);

        final OpenQuestion oq = register(q, Protocol.KIND_SELECT);
        oq.cards = selectable;
        // One answer taps at most as many cards as there are and Forge takes.
        oq.max = Math.max(Math.min(upper, selectable.size()), 1);
        selectQuestion = oq;
        sendStateNow();
        host.emit(q);
    }

    @Override
    public void clearSelectables() {
        if (selectQuestion != null) {
            withdraw(selectQuestion);
            selectQuestion = null;
        }
        super.clearSelectables();
        markDirty("clearSelectables");
    }

    /** Forge's playable markers during priority and payment; they go out with the next state. */
    @Override
    public void setWeaklySelectable(final Iterable<CardView> cards) {
        super.setWeaklySelectable(cards);
        markDirty("setWeaklySelectable");
    }

    @Override
    public void clearWeaklySelectable() {
        super.clearWeaklySelectable();
        markDirty("clearWeaklySelectable");
    }

    /** The London mulligan marks the cards to put back only this way (Anvil lesson). */
    @Override
    public void setHighlighted(final Iterable<GameEntityView> entities, final boolean b) {
        super.setHighlighted(entities, b);
        markDirty("setHighlighted");
    }

    // ══ Messages and state ═══════════════════════════════════════════════════════

    @Override
    public void showPromptMessage(final PlayerView playerView, final String message, final CardView card) {
        lastMessage = message == null ? "" : message.replace("\n", " ").trim();
        lastMessageCard = card;
        final JsonObject o = messageOf(Protocol.MESSAGE_PROMPT, lastMessage);
        // The card is often in no zone (paying for a spell: it left the hand
        // but is not on the stack yet), so the full view goes along.
        attachCard(o, card);
        host.emit(o);
    }

    @Override
    public void message(final String message, final String title) {
        final JsonObject o = messageOf(Protocol.MESSAGE_NOTICE, message);
        if (title != null) {
            o.addProperty("title", title);
        }
        host.emit(o);
    }

    @Override
    public void showErrorDialog(final String message, final String title) {
        final JsonObject o = messageOf(Protocol.MESSAGE_ERROR, message);
        if (title != null) {
            o.addProperty("title", title);
        }
        host.emit(o);
    }

    /** Forge says the game is over. Who won is stated from the player's point of view (Anvil lesson). */
    @Override
    public void finishGame() {
        checkThread("finishGame");
        sendStateNow();
        withdrawAll();
        finished = true;
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.GAME_END);
        final GameView game = getGameView();
        final PlayerView me = getCurrentPlayer();
        final GameOutcome outcome = game == null ? null : game.getOutcome();
        // Every field is always present (null if Forge does not say): the contract has no optional end.
        final LobbyPlayer winner = outcome == null ? null : outcome.getWinningLobbyPlayer();
        o.addProperty("winner", winner == null ? null : winner.getName());
        o.addProperty("reason", outcome == null ? null : String.valueOf(outcome.getWinCondition()));
        o.addProperty("turns", outcome == null ? null : outcome.getLastTurnNumber());
        o.addProperty("result", outcome == null ? null : winner == null ? "draw" : me == null ? null : me.isLobbyPlayer(winner) ? "win" : "loss");
        final JsonArray players = new JsonArray();
        if (game != null) {
            for (final PlayerView p : game.getPlayers()) {
                final JsonObject e = new JsonObject();
                e.addProperty("id", p.getId());
                e.addProperty("name", p.getLobbyPlayerName());
                e.addProperty("life", p.getLife());
                e.addProperty("me", p.equals(me));
                players.add(e);
            }
        }
        o.add("players", players);
        o.addProperty("conceded", conceded);
        endMessage = o;
        host.emit(o);
    }

    JsonObject endMessage() {
        return endMessage;
    }

    int inputsReceived() {
        return inputsReceived;
    }

    /**
     * Forge opens the view before the game starts (before the mulligans):
     * the moment an engine trace starts listening to the game's events.
     */
    @Override
    public void openView(final TrackableCollection<PlayerView> myPlayers) {
        count("openView");
        if (trace != null) {
            trace.attach(getGameView().getGame());
            trace.setGui(this);
        }
        sendStateNow();
    }

    @Override
    protected void updateCurrentPlayer(final PlayerView player) {
        markDirty("updateCurrentPlayer");
    }

    @Override
    public void updateStack() {
        stateChanged("updateStack");
    }

    @Override
    public void updatePhase(final boolean saveState) {
        stateChanged("updatePhase");
    }

    @Override
    public void updateTurn(final PlayerView player) {
        count("updateTurn");
        sendStateNow();
    }

    @Override
    public void updatePlayerControl() {
        stateChanged("updatePlayerControl");
    }

    @Override
    public void updateZones(final Iterable<PlayerZoneUpdate> zonesToUpdate) {
        stateChanged("updateZones");
    }

    @Override
    public void updateCards(final Iterable<CardView> cards) {
        stateChanged("updateCards");
    }

    @Override
    public void updateManaPool(final Iterable<PlayerView> manaPoolUpdate) {
        stateChanged("updateManaPool");
    }

    @Override
    public void updateLives(final Iterable<PlayerView> livesUpdate) {
        stateChanged("updateLives");
    }

    @Override
    public void refreshField() {
        stateChanged("refreshField");
    }

    @Override
    public void showCombat() {
        stateChanged("showCombat");
    }

    @Override
    public void updateShards(final Iterable<PlayerView> shardsUpdate) {
        stateChanged("updateShards");
    }

    @Override
    public void flashIncorrectAction() {
        host.emit(messageOf(Protocol.MESSAGE_INCORRECT_ACTION, ""));
    }

    // Display details Forge's own GUIs care about and the protocol does not.
    @Override public void alertUser() { }
    @Override public void enableOverlay() { }
    @Override public void disableOverlay() { }
    @Override public void showManaPool(final PlayerView player) { }
    @Override public void hideManaPool(final PlayerView player) { }
    @Override public void setPanelSelection(final CardView hostCard) { }
    @Override public void setCard(final CardView card) { }
    @Override public void setPlayerAvatar(final LobbyPlayer player, final IHasIcon ihi) { }

    // The state always contains everything Forge allows the player to see.
    @Override
    public PlayerZoneUpdates openZones(final PlayerView controller, final Collection<ZoneType> zones,
                                       final Map<PlayerView, Object> players, final boolean backupLastZones) {
        return new PlayerZoneUpdates();
    }

    @Override
    public void restoreOldZones(final PlayerView playerView, final PlayerZoneUpdates playerZoneUpdates) {
    }

    @Override
    public Iterable<PlayerZoneUpdate> tempShowZones(final PlayerView controller, final Iterable<PlayerZoneUpdate> zonesToUpdate) {
        return zonesToUpdate;
    }

    @Override
    public void hideZones(final PlayerView controller, final Iterable<PlayerZoneUpdate> zonesToUpdate) {
    }

    /** Never skip a phase in the GUI; Forge's APINA already passes empty priorities. */
    @Override
    public boolean isUiSetToSkipPhase(final PlayerView playerTurn, final PhaseType phase) {
        return false;
    }

    /** Belongs to Forge's developer mode. */
    @Override
    public GameState getGamestate() {
        return null;
    }

    // ══ State, events, questions: helpers ════════════════════════════════════════

    /**
     * Counts Forge's calls into this GUI by method. The counts depend only on
     * the game, not on timing: the Wasm replay compares them with the JVM run,
     * which catches Forge events that silently stop arriving (Guava's EventBus
     * finds its subscribers reflectively; unregistered in the image = no calls).
     */
    private void count(final String callback) {
        forgeCallbacks.merge(callback, 1, Integer::sum);
    }

    Map<String, Integer> forgeCallbacks() {
        return forgeCallbacks;
    }

    private void markDirty(final String callback) {
        count(callback);
        dirty = true;
    }

    /** From Forge's update callbacks: send at most every 120 ms (clock, no timer). */
    private void stateChanged(final String callback) {
        count(callback);
        dirty = true;
        if (System.nanoTime() - lastStateNanos >= STATE_INTERVAL_NANOS) {
            sendStateNow();
        }
    }

    /** Before waiting for input: the UI must see the current state. */
    private void sendState() {
        if (dirty) {
            sendStateNow();
        } else {
            sendEvents();
        }
    }

    /** Events first, then the picture they explain (Anvil lesson). */
    private void sendStateNow() {
        if (finished) {
            return;
        }
        sendEvents();
        final JsonObject snapshot = state.build();
        if (snapshot != null) {
            host.emit(snapshot);
        }
        dirty = false;
        lastStateNanos = System.nanoTime();
    }

    /**
     * Forge's own game log, filtered with Forge's MEDIUM verbosity. The
     * pointer counts the UNFILTERED list (Anvil lesson). {@code actor} is
     * "me"/"opponent" only from the structured source card controller.
     * Unknown stays absent; localized prose is never parsed.
     */
    private void sendEvents() {
        final GameView game = getGameView();
        if (game == null || game.getGameLog() == null) {
            return;
        }
        final List<GameLogEntry> all = game.getGameLog().getAllEntries();
        if (eventsSent >= all.size()) {
            return;
        }
        final PlayerView me = getCurrentPlayer();
        final JsonArray entries = new JsonArray();
        for (int i = eventsSent; i < all.size(); i++) {
            final GameLogEntry e = all.get(i);
            if (!GameLogVerbosity.MEDIUM.getIncludedTypes().contains(e.type())) {
                continue;
            }
            final JsonObject o = new JsonObject();
            o.addProperty("kind", e.type().name());
            o.addProperty("text", e.message());
            if (e.sourceCard() != null && mayViewSafely(e.sourceCard())) {
                o.addProperty("card", e.sourceCard().getId());
            }
            final String actor = actor(e, me);
            if (actor != null) {
                o.addProperty("actor", actor);
            }
            entries.add(o);
        }
        eventsSent = all.size();
        if (entries.isEmpty()) {
            return;
        }
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.EVENTS);
        o.add("entries", entries);
        host.emit(o);
    }

    static String actor(final GameLogEntry e, final PlayerView me) {
        if (me == null) {
            return null;
        }
        final CardView source = e.sourceCard();
        if (source != null && source.getController() != null) {
            return source.getController().equals(me) ? "me" : "opponent";
        }
        return null;
    }

    private JsonObject question(final String kind, final String text) {
        final JsonObject q = new JsonObject();
        q.addProperty("type", Protocol.QUESTION);
        q.addProperty("kind", kind);
        q.addProperty("text", text == null ? "" : text.replace("\n", " ").trim());
        return q;
    }

    /**
     * Registers a non-blocking question. Buttons are set by the input that is
     * showing itself, so they belong to the input running now. Selectable
     * cards may be named before their input is on the stack (in its
     * constructor), so a selection belongs to the next input that waits.
     */
    private OpenQuestion register(final JsonObject q, final String kind) {
        final long id = ++lastQuestionId;
        q.addProperty("id", id);
        q.addProperty("blocking", false);
        final Input owner = Protocol.KIND_BUTTONS.equals(kind) ? currentInput() : null;
        final OpenQuestion oq = new OpenQuestion(id, kind, owner);
        open.put(id, oq);
        return oq;
    }

    private void close(final OpenQuestion q) {
        open.remove(q.id);
    }

    private void withdraw(final OpenQuestion q) {
        if (open.remove(q.id) != null) {
            final JsonObject o = new JsonObject();
            o.addProperty("type", Protocol.QUESTION_WITHDRAWN);
            o.addProperty("id", q.id);
            host.emit(o);
        }
    }

    /** The answer with this seq was accepted and closed the question (select questions never close this way). */
    private void answered(final OpenQuestion q, final JsonObject input) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.QUESTION_ANSWERED);
        o.addProperty("id", q.id);
        o.addProperty("seq", input.get("seq").getAsLong());
        host.emit(o);
    }

    private void withdrawAll() {
        if (buttonsQuestion != null) {
            withdraw(buttonsQuestion);
            buttonsQuestion = null;
        }
        if (selectQuestion != null) {
            withdraw(selectQuestion);
            selectQuestion = null;
        }
    }

    /**
     * Before waiting: a button or selection question of an input that is no
     * longer running is answered by nobody. Anvil relied on Forge's
     * "waiting for opponent" timer to clear it; that timer does not run in
     * synchronous mode (patch 0005), so the bridge withdraws it itself.
     */
    private void withdrawQuestionsOfFinishedInputs() {
        final Input current = currentInput();
        if (buttonsQuestion != null && !belongsTo(buttonsQuestion, current)) {
            withdraw(buttonsQuestion);
            buttonsQuestion = null;
        }
        if (selectQuestion != null && !belongsTo(selectQuestion, current)) {
            withdraw(selectQuestion);
            selectQuestion = null;
        }
    }

    /**
     * Some inputs name their selectable cards in their constructor, before
     * Forge puts them on the input stack (InputSelectTargets does). Such a
     * question has no owner yet and belongs to the first input that waits
     * for the player afterwards.
     */
    private static boolean belongsTo(final OpenQuestion q, final Input current) {
        if (q.owner == null) {
            q.owner = current;
            return true;
        }
        return q.owner == current;
    }

    private Input currentInput() {
        return RunningInput.current(getGameController());
    }

    /** Attaches the card Forge sent with the current prompt: which ability is asking (Anvil lesson). */
    private void attachSourceCard(final JsonObject q) {
        attachCard(q, lastMessageCard);
    }

    /**
     * The card a message or question is about: id and full view, but only if
     * the player may see it. A hidden card never leaves the engine with its id.
     */
    private void attachCard(final JsonObject o, final CardView card) {
        if (card == null || o.has("card") || !mayViewSafely(card)) {
            return;
        }
        o.addProperty("card", card.getId());
        o.add("cardView", state.card(card, true));
    }

    private static JsonObject messageOf(final String kind, final String text) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.MESSAGE);
        o.addProperty("kind", kind);
        o.addProperty("text", text == null ? "" : text);
        return o;
    }

    private <T> JsonArray items(final List<T> list, final FSerializableFunction<T, String> display) {
        final JsonArray a = new JsonArray();
        for (int i = 0; i < list.size(); i++) {
            final T item = list.get(i);
            final JsonObject o = new JsonObject();
            o.addProperty("nr", i + 1);
            if (item instanceof CardView c && !mayViewSafely(c)) {
                // A card the player may not see: neither its text (Forge's
                // toString names it) nor its id (ids follow the deck list).
                o.addProperty("hidden", true);
                a.add(o);
                continue;
            }
            o.addProperty("text", text(item, display));
            if (item instanceof CardView c) {
                o.addProperty("card", c.getId());
                o.add("cardView", state.card(c, true));
            } else if (item instanceof PlayerView p) {
                o.addProperty("player", p.getId());
            } else if (item instanceof GameEntityView e) {
                o.addProperty("card", e.getId());
            }
            a.add(o);
        }
        return a;
    }

    private static <T> String text(final T item, final FSerializableFunction<T, String> display) {
        if (display != null) {
            try {
                return display.apply(item);
            } catch (final RuntimeException ignored) {
                // falls back to toString()
            }
        }
        return String.valueOf(item);
    }

    private static <T> List<T> reorder(final List<T> items, final List<Integer> order) {
        if (order == null) {
            return new ArrayList<>(items);
        }
        final List<T> result = new ArrayList<>();
        for (final int nr : order) {
            result.add(items.get(nr - 1));
        }
        return result;
    }

    private static JsonObject button(final int nr, final String label, final boolean enabled, final String meaning) {
        final JsonObject o = new JsonObject();
        o.addProperty("nr", nr);
        o.addProperty("label", label);
        o.addProperty("enabled", enabled);
        if (meaning != null) {
            o.addProperty("meaning", meaning);
        }
        return o;
    }

    private static String join(final String title, final String text) {
        if (title == null || title.isBlank()) {
            return text == null ? "" : text;
        }
        if (text == null || text.isBlank()) {
            return title;
        }
        return title + " — " + text;
    }

    /**
     * What a button pair is for, by comparing with Forge's own label keys
     * (the same source the inputs take their labels from; Anvil lesson).
     * Keep/Mulligan is new compared to Anvil.
     */
    static String purposeFromLabels(final String label1, final String label2) {
        if (label1 == null || label2 == null) {
            return null;
        }
        final Localizer l = Localizer.getInstance();
        final String ok = l.getMessage("lblOK");
        final String auto = l.getMessage("lblAuto");
        if (label1.equals(ok) && (label2.equals(l.getMessage("lblEndTurn")) || label2.startsWith(l.getMessage("lblUndo")))) {
            return Protocol.PURPOSE_PRIORITY;
        }
        if (label1.equals(l.getMessage("lblKeep")) && label2.equals(l.getMessage("lblMulligan"))) {
            return Protocol.PURPOSE_MULLIGAN;
        }
        if (label1.equals(ok) && label2.equals(auto)) {
            return Protocol.PURPOSE_MULLIGAN_BOTTOM;
        }
        if (label1.equals(auto) && label2.equals(l.getMessage("lblCancel"))) {
            return Protocol.PURPOSE_PAYMENT;
        }
        if (label1.equals(ok) && label2.equals(l.getMessage("lblAlphaStrike"))) {
            return Protocol.PURPOSE_ATTACK;
        }
        if (label1.equals(ok) && label2.equals(l.getMessage("lblCallBack"))) {
            return Protocol.PURPOSE_ATTACK_DECLARED;
        }
        return null;
    }

    /**
     * What a button of the priority step does (protocol 5), by Forge's own
     * label keys like {@link #purposeFromLabels}: InputPassPriority shows OK
     * (pass priority) and as its second button Undo (n) while the last action
     * can be taken back (tryUndoLastAction), otherwise End Turn (pass until
     * the end of the turn: autoPassUntilEndOfTurn). The same for the
     * declaration of attackers (protocol 7): OK declares, the second button
     * is Alpha Strike or Call Back. Null elsewhere: the UI then shows Forge's
     * own words.
     */
    static String meaningOf(final String purpose, final int nr, final String label) {
        if (label == null) {
            return null;
        }
        final Localizer l = Localizer.getInstance();
        // Protocol 7: the declaration of attackers (InputAttack.updatePrompt) shows OK
        // and, as its second button, Alpha Strike or - once attackers are declared - Call Back.
        if (Protocol.PURPOSE_ATTACK.equals(purpose) || Protocol.PURPOSE_ATTACK_DECLARED.equals(purpose)) {
            if (nr == 1) {
                return label.equals(l.getMessage("lblOK")) ? Protocol.MEANING_DECLARE : null;
            }
            if (label.equals(l.getMessage("lblAlphaStrike"))) {
                return Protocol.MEANING_ATTACK_ALL;
            }
            return label.equals(l.getMessage("lblCallBack")) ? Protocol.MEANING_CALL_BACK : null;
        }
        if (!Protocol.PURPOSE_PRIORITY.equals(purpose)) {
            return null;
        }
        if (nr == 1) {
            return label.equals(l.getMessage("lblOK")) ? Protocol.MEANING_PASS : null;
        }
        if (label.equals(l.getMessage("lblEndTurn"))) {
            return Protocol.MEANING_END_TURN;
        }
        if (label.startsWith(l.getMessage("lblUndo"))) {
            return Protocol.MEANING_UNDO;
        }
        return null;
    }

    /** Blocking uses a generic OK/Cancel pair; Forge's running input says what it is (Anvil lesson). */
    private boolean isBlockStep() {
        return currentInput() instanceof InputBlock;
    }

    private CardView findCard(final int id) {
        final GameView game = getGameView();
        if (game == null || game.getPlayers() == null) {
            return null;
        }
        for (final PlayerView p : game.getPlayers()) {
            for (final ZoneType zone : TAPPABLE_ZONES) {
                final Iterable<CardView> content = p.getCards(zone);
                if (content == null) {
                    continue;
                }
                for (final CardView c : content) {
                    if (c != null && c.getId() == id && mayView(c)) {
                        return c;
                    }
                }
            }
        }
        return null;
    }

    private PlayerView findPlayer(final int id) {
        final GameView game = getGameView();
        if (game == null || game.getPlayers() == null) {
            return null;
        }
        for (final PlayerView p : game.getPlayers()) {
            if (p.getId() == id) {
                return p;
            }
        }
        return null;
    }

    private boolean mayViewSafely(final CardView c) {
        try {
            return getGameController() == null || mayView(c);
        } catch (final RuntimeException e) {
            return false;
        }
    }

    private boolean isGameOver() {
        final GameView game = getGameView();
        return finished || (game != null && game.isGameOver());
    }

    // ══ Input handling ══════════════════════════════════════════════════════════

    /**
     * The next input. Inputs are numbered 1, 2, 3 … without gaps ({@code seq});
     * anything else means the transport lost, repeated or reordered an input,
     * and the game must not go on on a false basis: technical abort.
     */
    private JsonObject nextInput() {
        final JsonObject input = host.awaitInput();
        if (input == null) {
            throw new IllegalStateException("the host returned no input");
        }
        final long expected = inputsReceived + 1L;
        final JsonElement seq = input.get("seq");
        if (seq == null || !seq.isJsonPrimitive() || !seq.getAsJsonPrimitive().isNumber() || seq.getAsDouble() != expected) {
            throw new IllegalStateException("input sequence broken: expected seq " + expected + ", got " + input);
        }
        inputsReceived++;
        return input;
    }

    private static String typeOf(final JsonObject input) {
        final JsonElement type = input.get("type");
        return type != null && type.isJsonPrimitive() ? type.getAsString() : "";
    }

    private static long questionId(final JsonObject input) {
        final JsonElement id = input.get("question");
        return id != null && id.isJsonPrimitive() && id.getAsJsonPrimitive().isNumber() ? id.getAsLong() : -1;
    }

    private static int intField(final JsonObject input, final String field) {
        final JsonElement e = input.get(field);
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isNumber() ? e.getAsInt() : Integer.MIN_VALUE;
    }

    private void reject(final JsonObject input, final String reason, final String detail) {
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.INPUT_REJECTED);
        o.addProperty("seq", input.get("seq").getAsLong());
        o.addProperty("reason", reason);
        o.addProperty("detail", detail);
        o.add("input", input);
        host.emit(o);
    }

    /** Everything happens on Forge's game thread; anything else is a bridge bug. */
    private void checkThread(final String where) {
        if (Thread.currentThread() != engineThread) {
            EngineDiagnostics.recordThreadViolation(where, Thread.currentThread().getName());
        }
    }
}
