package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Checks an answer against its question before anything reaches Forge.
 *
 * <p>Deliberate difference to Anvil: Anvil bent malformed answers into shape
 * (filled up selections, normalised amounts). OpenMana rejects them loudly
 * instead (research plan §3.4, Bible §9.5): the UI gets
 * {@code input.rejected} and the question stays open. Only the numbers the
 * question itself carries are checked here (range, count, sum); whether a
 * choice is legal in Magic was already decided by Forge when it built the
 * question.
 */
final class Answers {

    /** An answer that does not fit its question. */
    static final class InvalidAnswer extends Exception {
        private static final long serialVersionUID = 1L;

        InvalidAnswer(final String detail) {
            super(detail);
        }
    }

    private Answers() {
    }

    /** Every answer names the kind of its question; another kind is invalid. */
    static void kind(final JsonObject answer, final String expected) throws InvalidAnswer {
        final JsonElement e = answer.get("kind");
        if (e == null || !e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new InvalidAnswer("kind is missing");
        }
        if (!expected.equals(e.getAsString())) {
            throw new InvalidAnswer("the question is a " + expected + " question, the answer is for " + e.getAsString());
        }
    }

    /** buttons: {@code button} is 1 or 2 and that button is enabled. */
    static int button(final JsonObject answer, final boolean enabled1, final boolean enabled2) throws InvalidAnswer {
        final int button = integer(answer, "button");
        if (button != 1 && button != 2) {
            throw new InvalidAnswer("button must be 1 or 2, got " + button);
        }
        if ((button == 1 && !enabled1) || (button == 2 && !enabled2)) {
            throw new InvalidAnswer("button " + button + " is disabled");
        }
        return button;
    }

    /**
     * select / choose: {@code choices} are distinct item numbers 1..count,
     * at least {@code min} and at most {@code max} of them.
     */
    static List<Integer> choices(final JsonObject answer, final int count, final int min, final int max) throws InvalidAnswer {
        final JsonArray array = array(answer, "choices");
        final List<Integer> result = new ArrayList<>();
        final Set<Integer> seen = new HashSet<>();
        for (final JsonElement e : array) {
            final int nr = asInt(e, "choices");
            if (nr < 1 || nr > count) {
                throw new InvalidAnswer("choice " + nr + " is not between 1 and " + count);
            }
            if (!seen.add(nr)) {
                throw new InvalidAnswer("choice " + nr + " appears twice");
            }
            result.add(nr);
        }
        if (result.size() < min || result.size() > max) {
            throw new InvalidAnswer(result.size() + " choices, expected " + min + ".." + max);
        }
        return result;
    }

    /** confirm: {@code yes} is a boolean. */
    static boolean yes(final JsonObject answer) throws InvalidAnswer {
        final JsonElement e = answer.get("yes");
        if (e == null || !e.isJsonPrimitive() || !e.getAsJsonPrimitive().isBoolean()) {
            throw new InvalidAnswer("yes must be true or false");
        }
        return e.getAsBoolean();
    }

    /** options: {@code option} is 1..count, or 0 when the question may be cancelled. */
    static int option(final JsonObject answer, final int count, final boolean cancellable) throws InvalidAnswer {
        final int option = integer(answer, "option");
        if (option == 0 && cancellable) {
            return 0;
        }
        if (option < 1 || option > count) {
            throw new InvalidAnswer("option " + option + " is not between 1 and " + count
                    + (cancellable ? " (or 0 to cancel)" : ""));
        }
        return option;
    }

    /** input: {@code value} is a string, an integer if the question is numeric. */
    static String value(final JsonObject answer, final boolean numeric) throws InvalidAnswer {
        return value(answer, numeric, false);
    }

    static String value(final JsonObject answer, final boolean numeric, final boolean cancellable) throws InvalidAnswer {
        final JsonElement e = answer.get("value");
        if (e != null && e.isJsonNull() && cancellable) {
            return null;
        }
        if (e == null || !e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new InvalidAnswer("value is missing");
        }
        final String value = e.getAsString();
        if (numeric) {
            try {
                Integer.parseInt(value.trim());
            } catch (final NumberFormatException ex) {
                throw new InvalidAnswer("value '" + value + "' is not a whole number");
            }
        }
        return value;
    }

    /** order: {@code order} is a permutation of 1..count. */
    static List<Integer> order(final JsonObject answer, final int count) throws InvalidAnswer {
        return order(answer, count, 0, 0);
    }

    /**
     * order as Forge's dual list: {@code order} lists the chosen items in
     * order; the items not listed "remain". Forge bounds how many may remain:
     * a negative maximum means any number, otherwise the remainder must lie
     * in [remainingMin, remainingMax] (Forge's DualListBox). With both 0 it is
     * a plain ordering of all items.
     */
    static List<Integer> order(final JsonObject answer, final int count, final int remainingMin, final int remainingMax)
            throws InvalidAnswer {
        final List<Integer> order = choices(answer, "order", count);
        final int remaining = count - order.size();
        if (remainingMax >= 0 && (remaining < remainingMin || remaining > remainingMax)) {
            throw new InvalidAnswer(order.size() + " of " + count + " items listed, but "
                    + remainingMin + ".." + remainingMax + " must remain");
        }
        return order;
    }

    /** Result of an arrange answer: item numbers for the top and for the bottom, each in order. */
    static final class Arrangement {
        final List<Integer> top;
        final List<Integer> bottom;
        final List<Integer> positions;

        Arrangement(final List<Integer> top, final List<Integer> bottom) {
            this(top, bottom, null);
        }

        Arrangement(final List<Integer> top, final List<Integer> bottom, final List<Integer> positions) {
            this.top = top;
            this.bottom = bottom;
            this.positions = positions;
        }
    }

    static Arrangement arrange(final JsonObject answer, final int count, final boolean topAllowed,
                               final boolean bottomAllowed, final boolean anywhere, final int others) throws InvalidAnswer {
        if (!answer.has("positions")) {
            return arrange(answer, count, topAllowed, bottomAllowed);
        }
        if (!anywhere || !array(answer, "top").isEmpty() || !array(answer, "bottom").isEmpty()) {
            throw new InvalidAnswer("positions require toAnywhere and empty top/bottom lists");
        }
        final List<Integer> positions = choices(answer, "positions", Math.addExact(count, others));
        if (positions.size() != count) {
            throw new InvalidAnswer("each movable item needs exactly one position");
        }
        return new Arrangement(List.of(), List.of(), positions);
    }

    /**
     * arrange: {@code top} and {@code bottom} together list every item exactly
     * once; a side Forge does not allow must stay empty.
     */
    static Arrangement arrange(final JsonObject answer, final int count, final boolean topAllowed,
                               final boolean bottomAllowed) throws InvalidAnswer {
        final List<Integer> top = choices(answer, "top", count);
        final List<Integer> bottom = choices(answer, "bottom", count);
        final Set<Integer> all = new HashSet<>(top);
        for (final int nr : bottom) {
            if (!all.add(nr)) {
                throw new InvalidAnswer("item " + nr + " is both on top and on the bottom");
            }
        }
        if (all.size() != count) {
            throw new InvalidAnswer("top and bottom must place all " + count + " items, got " + all.size());
        }
        if (!topAllowed && !top.isEmpty()) {
            throw new InvalidAnswer("nothing may go on top here");
        }
        if (!bottomAllowed && !bottom.isEmpty()) {
            throw new InvalidAnswer("nothing may go on the bottom here");
        }
        return new Arrangement(top, bottom);
    }

    /** distribute: {@code amounts} has one entry per item, each at least {@code min}, summing to {@code total}. */
    static List<Integer> amounts(final JsonObject answer, final int count, final int total, final int min) throws InvalidAnswer {
        final JsonArray array = array(answer, "amounts");
        if (array.size() != count) {
            throw new InvalidAnswer(array.size() + " amounts for " + count + " items");
        }
        final List<Integer> amounts = new ArrayList<>();
        long sum = 0;
        for (final JsonElement e : array) {
            final int amount = asInt(e, "amounts");
            if (amount < min) {
                throw new InvalidAnswer("amount " + amount + " is below the minimum " + min);
            }
            amounts.add(amount);
            sum += amount;
        }
        if (sum != total) {
            throw new InvalidAnswer("amounts sum to " + sum + ", expected " + total);
        }
        return amounts;
    }

    /** Forge supplies caps/dependencies; the bridge checks the same numbers it sends. */
    static List<Integer> distribution(final JsonObject answer, final JsonObject question) throws InvalidAnswer {
        if (answer.has("skip")) {
            if (!answer.get("skip").isJsonPrimitive() || !answer.get("skip").getAsJsonPrimitive().isBoolean()
                    || !answer.get("skip").getAsBoolean() || !question.has("maySkip")
                    || !question.get("maySkip").getAsBoolean() || !array(answer, "amounts").isEmpty()) {
                throw new InvalidAnswer("this distribution cannot be postponed");
            }
            return null;
        }
        final List<Integer> result = amounts(answer, question.getAsJsonArray("items").size(),
                question.get("total").getAsInt(), question.get("min").getAsInt());
        if (question.has("maximums")) {
            final JsonArray max = question.getAsJsonArray("maximums");
            for (int i = 0; i < result.size(); i++) {
                if (result.get(i) > max.get(i).getAsInt()) {
                    throw new InvalidAnswer("amount exceeds Forge's maximum for item " + (i + 1));
                }
            }
        }
        if (question.has("prerequisites")) {
            for (final JsonElement entry : question.getAsJsonArray("prerequisites")) {
                final JsonObject p = entry.getAsJsonObject();
                if (result.get(p.get("item").getAsInt() - 1) > 0
                        && result.get(p.get("requires").getAsInt() - 1) < p.get("amount").getAsInt()) {
                    throw new InvalidAnswer("Forge's assignment prerequisite is not met");
                }
            }
        }
        return result;
    }

    private static List<Integer> choices(final JsonObject answer, final String field, final int count) throws InvalidAnswer {
        final JsonArray array = array(answer, field);
        final List<Integer> result = new ArrayList<>();
        final Set<Integer> seen = new HashSet<>();
        for (final JsonElement e : array) {
            final int nr = asInt(e, field);
            if (nr < 1 || nr > count || !seen.add(nr)) {
                throw new InvalidAnswer(field + " contains " + nr + ", expected distinct numbers 1.." + count);
            }
            result.add(nr);
        }
        return result;
    }

    private static int integer(final JsonObject answer, final String field) throws InvalidAnswer {
        final JsonElement e = answer.get(field);
        if (e == null) {
            throw new InvalidAnswer(field + " is missing");
        }
        return asInt(e, field);
    }

    private static int asInt(final JsonElement e, final String field) throws InvalidAnswer {
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isNumber()) {
            throw new InvalidAnswer(field + " must contain whole numbers");
        }
        final double d = e.getAsDouble();
        if (d != Math.rint(d) || Math.abs(d) > Integer.MAX_VALUE) {
            throw new InvalidAnswer(field + " must contain whole numbers");
        }
        return (int) d;
    }

    private static JsonArray array(final JsonObject answer, final String field) throws InvalidAnswer {
        final JsonElement e = answer.get(field);
        if (e == null || !e.isJsonArray()) {
            throw new InvalidAnswer(field + " must be an array");
        }
        return e.getAsJsonArray();
    }
}
