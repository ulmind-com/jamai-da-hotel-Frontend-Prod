import { motion } from "framer-motion";
import { Sun, Moon, Cloud, Star } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    // Check if system is dark
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && systemIsDark);

    const toggleTheme = () => {
        setTheme(isDark ? "light" : "dark");
    };

    return (
        <button
            onClick={toggleTheme}
            className={`relative flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-500 flex-shrink-0 ${isDark ? "bg-slate-900" : "bg-blue-400"
                }`}
            aria-label="Toggle theme"
        >
            {/* Background Decor */}
            <div className="absolute inset-0 overflow-hidden rounded-full">
                {/* Stars for Dark Mode */}
                <motion.div
                    initial={false}
                    animate={{ opacity: isDark ? 1 : 0, y: isDark ? 0 : 8 }}
                    className="absolute left-1.5 top-1"
                >
                    <div className="h-0.5 w-0.5 rounded-full bg-white opacity-80 shadow-[3px_1px_0_white,6px_-1px_0_white]" />
                </motion.div>

                {/* Clouds for Light Mode */}
                <motion.div
                    initial={false}
                    animate={{ opacity: isDark ? 0 : 1, x: isDark ? -6 : 0 }}
                    className="absolute right-1.5 top-1.5"
                >
                    <Cloud className="h-2 w-2 text-white/50 fill-white/50" />
                </motion.div>
            </div>

            {/* Toggle Circle */}
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className="z-10 flex items-center justify-center rounded-full bg-white shadow-md"
                style={{ width: 20, height: 20 }}
                animate={{ x: isDark ? 20 : 0 }}
            >
                <motion.div
                    initial={false}
                    animate={{ rotate: isDark ? 0 : 180, scale: isDark ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                >
                    {isDark && <Moon className="h-2.5 w-2.5 text-slate-900" fill="currentColor" />}
                </motion.div>
                <motion.div
                    initial={false}
                    animate={{ rotate: isDark ? -180 : 0, scale: isDark ? 0 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                >
                    {!isDark && <Sun className="h-2.5 w-2.5 text-orange-400" fill="currentColor" />}
                </motion.div>
            </motion.div>
        </button>
    );
}
