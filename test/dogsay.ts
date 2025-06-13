export interface DogsayOptions {
    text: string
    mode?: "say" | "think"
    eyes?: string
    tongue?: string
}

/**
 * Generates an ASCII art dog with a speech or thought bubble containing the provided text.
 *
 * @param options Either a DogsayOptions object specifying text, mode, eyes, and tongue, or a string to be displayed in the bubble.
 *   - text: The message to display.
 *   - mode: Whether to "say" (default) or "think" the message.
 *   - eyes: Custom eyes for the dog (default "oo").
 *   - tongue: Custom tongue (default is two spaces).
 * @returns Combined ASCII art string of the speech bubble and dog.
 */
export function dogsay(options: DogsayOptions | string): string {
    // Handle string argument
    const opts: DogsayOptions =
        typeof options === "string" ? { text: options } : options

    // Default options
    const { text = "", mode = "say", eyes = "oo", tongue = "  " } = opts

    // Split text into lines
    const lines = formatText(text)

    // Create the speech bubble
    const bubble = createBubble(lines, mode)

    // Create the dog
    const dog = createDog(eyes, tongue, mode)

    // Combine the bubble and dog
    return bubble + dog
}

/**
 * Splits the input text into lines that do not exceed the specified maximum width.
 *
 * @param text The string to be wrapped into lines.
 * @param maxWidth The maximum width of each line. Defaults to 40 if not provided.
 * @returns An array of strings, each representing a line within the given width.
 */
export function formatText(text: string, maxWidth: number = 40): string[] {
    if (!text) return [""]

    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxWidth) {
            currentLine += (currentLine ? " " : "") + word
        } else {
            lines.push(currentLine)
            currentLine = word
        }
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    return lines
}

function createBubble(lines: string[], mode: "say" | "think"): string {
    if (lines.length === 0) return ""

    const maxLength = Math.max(...lines.map((line) => line.length))
    let result = " " + "_".repeat(maxLength + 2) + "\n"

    if (lines.length === 1) {
        const line = lines[0]
        const padding = " ".repeat(maxLength - line.length)
        result +=
            mode === "say"
                ? `< ${line}${padding} >\n`
                : `( ${line}${padding} )\n`
    } else {
        lines.forEach((line, i) => {
            const padding = " ".repeat(maxLength - line.length)
            let prefix, suffix

            if (i === 0) {
                prefix = mode === "say" ? "/ " : "( "
                suffix = mode === "say" ? " \\" : " )"
            } else if (i === lines.length - 1) {
                prefix = mode === "say" ? "\\ " : "( "
                suffix = mode === "say" ? " /" : " )"
            } else {
                prefix = mode === "say" ? "| " : "( "
                suffix = mode === "say" ? " |" : " )"
            }

            result += `${prefix}${line}${padding}${suffix}\n`
        })
    }

    result += " " + "-".repeat(maxLength + 2) + "\n"
    return result
}

  // Create the ASCII dog
function createDog(
    eyes: string,
    tongue: string,
    mode: "say" | "think"
): string {
    return `        \\   ^__^
           \\  (${eyes})\\_______
              (__)\\       )\\/\\
               ${tongue}||----w |
                  ||     ||
  `
}



    export function dogthink(options: DogsayOptions | string): string {
        const opts = typeof options === "string" ? { text: options } : options
        return dogsay({ ...opts, mode: "think" })
    }
