package org.openmana.engine;

import org.testng.annotations.Test;
import org.tinylog.configuration.Configuration;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNull;
import static org.testng.Assert.assertTrue;

/**
 * Forge logs through tinylog. In WebAssembly tinylog must never look up the
 * calling class (no Java stack there): the engine's configuration replaces
 * Forge's own tinylog.properties on both runtimes (ForgeEngine.LOGGING).
 */
public class ForgeLoggingTest {

    @Test
    public void forgeLogsWithoutLookingUpTheCaller() throws Exception {
        EngineTestSupport.boot();
        assertTrue(Configuration.isFrozen(), "tinylog should be in use after the engine started");
        assertEquals(Configuration.get("writer.format"), "[{level}] {message}", "no {class}, {method}, {file} or {line}");
        assertEquals(Configuration.get("writer.level"), "info");
        // Forge's file is not in effect: no levels per package, no network writer on TRACE.
        assertNull(Configuration.get("level@io.netty"));
        assertNull(Configuration.get("writerNetFile"));
        assertNull(Configuration.get("writerNetFile.level"));
    }
}
