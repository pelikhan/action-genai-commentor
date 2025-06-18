/**
 * Options for configuring the cowsay output.
 *
 * @property text - The text to be displayed inside the speech or thought bubble.
 * @property mode - Optional; display mode, either "say" for speech or "think" for thought.
 * @property eyes - Optional; the appearance of the cow's eyes.
 * @property tongue - Optional; the appearance of the cow's tongue.
 */
export interface CowsayOptions {
    text: string
    mode?: "say" | "think"
    eyes?: string
    tongue?: string
}

/**
 * / **
 *  * Generates an ASCII cow saying or thinking a given message.
 *  *
 *  * @param options - The text or an object with options to customize the output,
 *  * including the message text, mode ("say" or "think"), eyes, and tongue appearance.
 *  * @returns The formatted string representing the cow with a speech or thought bubble.
 *  * /
 */
export function cowsay(options: CowsayOptions | string): string {
    // Handle string argument
    const opts: CowsayOptions =
        typeof options === "string" ? { text: options } : options

    // Default options
    const { text = "", mode = "say", eyes = "oo", tongue = "  " } = opts

    // Split text into lines
    const lines = formatText(text)

    // Create the speech bubble
    const bubble = createBubble(lines, mode)

    // Create the cow
    const cow = createCow(eyes, tongue, mode)

    // Combine the bubble and cow
    return bubble + cow
}

/**
 * / **
 *  * Splits a given text into lines of a specified maximum width without breaking words.
 *  *
 *  * @param text - The text to be formatted into lines.
 *  * @param maxWidth - The maximum allowed width of each line; defaults to 40.
 *  * @returns An array of strings, each representing a line within the maxWidth limit.
 *  * /
 */
function formatText(text: string, maxWidth: number = 40): string[] {
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

/****
 * Generates an ASCII speech or thought bubble around the provided lines of text.
 *
 * @param lines - Array of strings representing lines of text to include inside the bubble.
 * @param mode - Determines the type of bubble: "say" for speech, "think" for thought.
 * @returns The formatted bubble as a string.
 */
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

  // Create the ASCII cow
function createCow(
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



    /**
     * / **
     *  * Generates an ASCII cow with a thought bubble containing the specified text.
     *  *
     *  * @param options - The text or configuration options for the thought bubble and cow appearance.
     *  * @returns The formatted ASCII art string with the cow "thinking" the given text.
     *  * /
     */
    export function cowthink(options: CowsayOptions | string): string {
        const opts = typeof options === "string" ? { text: options } : options
        return cowsay({ ...opts, mode: "think" })
    }
