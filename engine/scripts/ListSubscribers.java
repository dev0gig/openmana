import java.io.File;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

/**
 * Lists every method annotated with Guava's {@code @Subscribe} in Forge's
 * classes of the fat JAR, one JSON object per line:
 * {@code {"type": "...", "name": "...", "parameterTypes": ["..."]}}.
 *
 * <p>Forge delivers game events through Guava's EventBus (game log, the GUI's
 * event handler, sound ...). EventBus finds subscriber methods reflectively
 * (getDeclaredMethods + annotation) and calls them with Method.invoke. In a
 * GraalVM image an unregistered subscriber method is invisible: the
 * subscriber then silently receives nothing. Used by gen-reflection-config.mjs
 * so that every subscriber is registered, not only those a sample game
 * happened to reach.
 *
 * <pre>
 * java engine/scripts/ListSubscribers.java [--interfaces] &lt;fat.jar&gt; [excluded path prefix ...]
 * </pre>
 * With {@code --interfaces} it lists Forge's interfaces instead, one
 * {@code {"type": "...", "interface": true}} per line: they have no
 * constructors to register, and a registered interface keeps its method
 * signatures as reflection metadata (IGuiBase would make jupnp's
 * UpnpServiceConfiguration reachable).
 * Classes are loaded without initialisation. A class that cannot be loaded is
 * reported on stderr and makes the run fail: it could hide a subscriber.
 */
public final class ListSubscribers {

    private ListSubscribers() {
    }

    public static void main(final String[] args) throws Exception {
        final boolean interfaces = args.length > 0 && "--interfaces".equals(args[0]);
        final int first = interfaces ? 1 : 0;
        final File jar = new File(args[first]);
        final List<String> excluded = Arrays.asList(args).subList(first + 1, args.length);
        int scanned = 0;
        int found = 0;
        int unloadable = 0;
        try (URLClassLoader loader = new URLClassLoader(new URL[] {jar.toURI().toURL()}, ClassLoader.getPlatformClassLoader());
             JarFile jarFile = new JarFile(jar)) {
            @SuppressWarnings("unchecked")
            final Class<? extends Annotation> subscribe =
                    (Class<? extends Annotation>) Class.forName("com.google.common.eventbus.Subscribe", false, loader);
            for (final Enumeration<JarEntry> e = jarFile.entries(); e.hasMoreElements();) {
                final String path = e.nextElement().getName();
                if (!path.startsWith("forge/") || !path.endsWith(".class")
                        || path.endsWith("module-info.class") || path.endsWith("package-info.class")
                        || excluded.stream().anyMatch(path::startsWith)) {
                    continue;
                }
                final String className = path.substring(0, path.length() - ".class".length()).replace('/', '.');
                final Class<?> type;
                final Method[] methods;
                try {
                    type = Class.forName(className, false, loader);
                    methods = type.getDeclaredMethods();
                } catch (final Throwable t) {
                    unloadable++;
                    System.err.println("[ListSubscribers] not loadable: " + className + ": " + t);
                    continue;
                }
                scanned++;
                if (interfaces) {
                    if (type.isInterface()) {
                        System.out.println("{\"type\":\"" + className + "\",\"interface\":true}");
                        found++;
                    }
                    continue;
                }
                for (final Method m : methods) {
                    if (!m.isAnnotationPresent(subscribe)) {
                        continue;
                    }
                    final StringBuilder json = new StringBuilder();
                    json.append("{\"type\":\"").append(className).append("\",\"name\":\"").append(m.getName())
                            .append("\",\"parameterTypes\":[");
                    final Class<?>[] parameters = m.getParameterTypes();
                    for (int i = 0; i < parameters.length; i++) {
                        json.append(i == 0 ? "" : ",").append('"').append(parameters[i].getTypeName()).append('"');
                    }
                    System.out.println(json.append("]}"));
                    found++;
                }
            }
        }
        System.err.println("[ListSubscribers] " + scanned + " Forge classes scanned, " + found
                + (interfaces ? " interfaces, " : " @Subscribe methods, ") + unloadable + " not loadable");
        if (unloadable > 0) {
            System.exit(1);
        }
    }
}
