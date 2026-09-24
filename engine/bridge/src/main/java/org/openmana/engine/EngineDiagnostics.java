package org.openmana.engine;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Collects problems Forge reports while it keeps running (BugReporter
 * dialogs). Nothing here decides anything about the game; it only makes sure
 * a reported error is visible in the result instead of disappearing into a
 * console nobody reads.
 */
public final class EngineDiagnostics {

    private static final List<String> FORGE_ERRORS = new ArrayList<>();

    private EngineDiagnostics() {
    }

    static void recordForgeError(final String title, final String text) {
        final String entry = title + (text == null || text.isEmpty() ? "" : "\n" + text);
        FORGE_ERRORS.add(entry);
        System.err.println("[openmana-engine] Forge reported an error: " + entry);
    }

    public static List<String> forgeErrors() {
        return Collections.unmodifiableList(new ArrayList<>(FORGE_ERRORS));
    }

    public static void clear() {
        FORGE_ERRORS.clear();
    }
}
