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
    private static final List<String> THREAD_VIOLATIONS = new ArrayList<>();

    private EngineDiagnostics() {
    }

    static void recordForgeError(final String title, final String text) {
        final String entry = title + (text == null || text.isEmpty() ? "" : "\n" + text);
        FORGE_ERRORS.add(entry);
        System.err.println("[openmana-engine] Forge reported an error: " + entry);
    }

    /**
     * The bridge runs entirely on Forge's game thread. A GUI callback on any
     * other thread means something in Forge or the bridge still assumes
     * threads, which the browser does not have.
     */
    public static synchronized void recordThreadViolation(final String where, final String thread) {
        final String entry = where + " called on thread '" + thread + "'";
        THREAD_VIOLATIONS.add(entry);
        System.err.println("[openmana-engine] thread violation: " + entry);
    }

    public static synchronized List<String> threadViolations() {
        return Collections.unmodifiableList(new ArrayList<>(THREAD_VIOLATIONS));
    }

    public static List<String> forgeErrors() {
        return Collections.unmodifiableList(new ArrayList<>(FORGE_ERRORS));
    }

    public static synchronized void clear() {
        FORGE_ERRORS.clear();
        THREAD_VIOLATIONS.clear();
    }
}
