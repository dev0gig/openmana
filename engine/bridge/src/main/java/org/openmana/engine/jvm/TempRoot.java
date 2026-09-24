package org.openmana.engine.jvm;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;

/**
 * Temporary engine root for JVM runs, deleted again when the JVM exits.
 *
 * <p>Every boot unpacks ~37 000 Forge files. Left behind in /tmp, a few dozen
 * runs exhaust the inodes of a tmpfs (happened on 2026-09-24 during prompt 02).
 */
final class TempRoot {

    private TempRoot() {
    }

    static Path create() throws IOException {
        final Path root = Files.createTempDirectory("openmana-engine-");
        Runtime.getRuntime().addShutdownHook(new Thread(() -> deleteQuietly(root), "openmana-temp-cleanup"));
        return root;
    }

    static void deleteQuietly(final Path root) {
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(final Path dir, final IOException exc) throws IOException {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (final IOException e) {
            System.err.println("[openmana-engine] could not delete " + root + ": " + e);
        }
    }
}
