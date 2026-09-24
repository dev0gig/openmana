package org.openmana.engine;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Unpacks the Forge resource bundle written by
 * {@code engine/scripts/pack-resources.mjs} into a directory.
 *
 * <p>In the browser the target is the in-memory file system of the Web Image
 * runtime; on the JVM (tests) it is a temporary directory. Both runtimes
 * therefore read exactly the same Forge files.
 *
 * <p>Format {@code OMRB0001}: 8 magic bytes, u32 entry count, then per entry
 * u16 path length, UTF-8 path (relative, forward slashes), u32 content
 * length, raw content bytes. All integers big-endian. Nothing may follow the
 * last entry.
 */
public final class ResourceBundleReader {

    public static final byte[] MAGIC = "OMRB0001".getBytes(StandardCharsets.US_ASCII);

    /** What was unpacked, for the boot report. */
    public static final class Stats {
        public final int files;
        public final long bytes;

        Stats(final int files, final long bytes) {
            this.files = files;
            this.bytes = bytes;
        }
    }

    private ResourceBundleReader() {
    }

    public static Stats unpack(final InputStream source, final Path targetRoot) throws IOException {
        if (source == null) {
            throw new IOException("Forge resource bundle not found");
        }
        final DataInputStream in = new DataInputStream(new BufferedInputStream(source, 1 << 16));
        final byte[] magic = new byte[MAGIC.length];
        in.readFully(magic);
        if (!Arrays.equals(magic, MAGIC)) {
            throw new IOException("not an OpenMana resource bundle (magic " + new String(magic, StandardCharsets.US_ASCII) + ")");
        }
        final int count = in.readInt();
        if (count <= 0) {
            throw new IOException("resource bundle declares " + count + " entries");
        }
        final Set<Path> createdDirs = new HashSet<>();
        long total = 0;
        for (int i = 0; i < count; i++) {
            final byte[] pathBytes = new byte[in.readUnsignedShort()];
            in.readFully(pathBytes);
            final String relative = new String(pathBytes, StandardCharsets.UTF_8);
            checkRelativePath(relative);
            final byte[] content = new byte[in.readInt()];
            in.readFully(content);

            final Path target = targetRoot.resolve(relative);
            final Path parent = target.getParent();
            if (parent != null && createdDirs.add(parent)) {
                Files.createDirectories(parent);
            }
            Files.write(target, content);
            total += content.length;
        }
        if (in.read() != -1) {
            throw new IOException("resource bundle has data after its last entry");
        }
        return new Stats(count, total);
    }

    private static void checkRelativePath(final String relative) throws IOException {
        if (relative.isEmpty() || relative.startsWith("/") || relative.contains("\\")
                || relative.equals("..") || relative.startsWith("../") || relative.contains("/../")) {
            throw new IOException("unsafe path in resource bundle: " + relative);
        }
    }
}
