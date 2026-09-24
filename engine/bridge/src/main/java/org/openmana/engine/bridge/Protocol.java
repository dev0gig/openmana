package org.openmana.engine.bridge;

/**
 * Names used on the wire between engine and UI (spike version of the
 * protocol; prompt 03 turns it into a versioned JSON schema).
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

    /** Protocol version of this bridge; the UI must reject what it does not know. */
    public static final String VERSION = "0.2-spike";

    // --- engine -> UI ---------------------------------------------------------
    public static final String GAME_STARTED = "game.started";
    public static final String STATE = "state";
    public static final String EVENTS = "events";
    public static final String MESSAGE = "message";
    public static final String ERROR = "error";
    public static final String QUESTION = "question";
    public static final String QUESTION_WITHDRAWN = "question.withdrawn";
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
