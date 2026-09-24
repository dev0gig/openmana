package org.openmana.engine.bridge;

/**
 * Names used on the wire between engine and UI. The contract itself is the
 * JSON schema engine/protocol/schema/protocol.schema.json; ProtocolContractTest
 * checks that these constants and the schema agree.
 *
 * <p>Semantics follow Anvil's PROTOKOLL.md (dev0gig/anvil, version 1): full
 * snapshots, numbered questions, withdrawal, card taps outside questions,
 * Forge's playable/action/highlight markers, events from Forge's GameLog.
 * Names are English here; docs/implementation/02-anvil-bridge.md maps them to
 * Anvil's German ones.
 */
public final class Protocol {

    private Protocol() {
    }

    /**
     * Version of the UI<->engine contract (engine/protocol/schema/protocol.schema.json,
     * ProtocolVersion). UI, worker host and engine must speak exactly the same
     * version; change it together with the schema.
     */
    public static final int VERSION = 1;

    // --- engine -> UI ---------------------------------------------------------
    public static final String GAME_STARTED = "game.started";
    public static final String STATE = "state";
    public static final String EVENTS = "events";
    public static final String MESSAGE = "message";
    public static final String QUESTION = "question";
    public static final String QUESTION_WITHDRAWN = "question.withdrawn";
    /** The answer with this seq was accepted and closed the question. */
    public static final String QUESTION_ANSWERED = "question.answered";
    public static final String INPUT_REJECTED = "input.rejected";
    public static final String GAME_END = "game.end";

    // --- UI -> engine ---------------------------------------------------------
    public static final String ANSWER = "answer";
    public static final String CARD_TAP = "card.tap";
    public static final String PLAYER_TAP = "player.tap";
    public static final String STATE_REQUEST = "state.request";
    public static final String CONCEDE = "concede";

    // --- question kinds (Anvil: antippen, karten, knoepfe, jaNein, optionen, zahl, ordnen, verteilen)
    public static final String KIND_SELECT = "select";
    public static final String KIND_CHOOSE = "choose";
    public static final String KIND_BUTTONS = "buttons";
    public static final String KIND_CONFIRM = "confirm";
    public static final String KIND_OPTIONS = "options";
    public static final String KIND_INPUT = "input";
    public static final String KIND_ORDER = "order";
    /** Move some cards of a hidden pile to its top or bottom (scry, surveil-like effects). */
    public static final String KIND_ARRANGE = "arrange";
    public static final String KIND_DISTRIBUTE = "distribute";

    // --- kinds of a message (what Forge shows the player) ------------------------
    /** The instruction line of the current decision. */
    public static final String MESSAGE_PROMPT = "prompt";
    /** A message dialog. */
    public static final String MESSAGE_NOTICE = "notice";
    /** An error dialog. */
    public static final String MESSAGE_ERROR = "error";
    /** Forge refused an action (a flash in Forge's own GUI). */
    public static final String MESSAGE_INCORRECT_ACTION = "incorrect-action";

    // --- purposes of a buttons question (Anvil: anlass) --------------------------
    public static final String PURPOSE_PRIORITY = "priority";
    public static final String PURPOSE_MULLIGAN = "mulligan";
    public static final String PURPOSE_MULLIGAN_BOTTOM = "mulliganBottom";
    public static final String PURPOSE_PAYMENT = "payment";
    public static final String PURPOSE_ATTACK = "attack";
    public static final String PURPOSE_ATTACK_DECLARED = "attackDeclared";
    public static final String PURPOSE_BLOCK = "block";

    // --- reasons of input.rejected ----------------------------------------------
    /** The question was withdrawn or already answered. Normal, not an error. */
    public static final String REJECT_STALE = "stale";
    /** Another question must be answered first (a blocking decision is open). */
    public static final String REJECT_NOT_ACTIVE = "not-active";
    /** The answer does not fit the question (range, count, sum ...). */
    public static final String REJECT_INVALID = "invalid";
    /** The message itself is malformed or of an unknown type. */
    public static final String REJECT_MALFORMED = "malformed";
    /** No card with this id is visible to the player. */
    public static final String REJECT_UNKNOWN_CARD = "unknown-card";
    /** No player with this id is in the game. */
    public static final String REJECT_UNKNOWN_PLAYER = "unknown-player";
    /** Forge accepted the tap but it had no effect in the current step. */
    public static final String REJECT_NO_EFFECT = "no-effect";
}
