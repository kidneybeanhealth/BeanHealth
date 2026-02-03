/**
 * Token Receipt Generator - Creates ESC/POS formatted receipt data for thermal printers
 * Compatible with Rugtek BP02 and similar 58mm/80mm thermal printers
 */

export interface TokenData {
    hospitalName: string;
    tokenNumber: string;
    patientName: string;
    mrNumber?: string;
    doctorName: string;
    department: string;
    date: string;
    time: string;
}

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],                    // Initialize printer
    CENTER: [ESC, 0x61, 0x01],            // Center align
    LEFT: [ESC, 0x61, 0x00],              // Left align
    BOLD_ON: [ESC, 0x45, 0x01],           // Bold on
    BOLD_OFF: [ESC, 0x45, 0x00],          // Bold off
    DOUBLE_SIZE: [GS, 0x21, 0x11],        // Double width & height (2x)
    QUADRUPLE_SIZE: [GS, 0x21, 0x33],     // Quadruple width & height (4x) - HUGE
    NORMAL_SIZE: [GS, 0x21, 0x00],        // Normal size
    DOUBLE_HEIGHT: [GS, 0x21, 0x01],      // Double height only
    DOUBLE_WIDTH: [GS, 0x21, 0x10],       // Double width only
    UNDERLINE_ON: [ESC, 0x2D, 0x01],      // Underline on
    UNDERLINE_OFF: [ESC, 0x2D, 0x00],     // Underline off
    FEED_LINE: [0x0A],                     // Line feed
    FEED_LINES_3: [ESC, 0x64, 0x03],      // Feed 3 lines
    FEED_LINES_5: [ESC, 0x64, 0x05],      // Feed 5 lines
    PAPER_CUT: [GS, 0x56, 0x00],          // Full cut
    PARTIAL_CUT: [GS, 0x56, 0x01],        // Partial cut
    CHAR_SPACING: [ESC, 0x20],            // Character spacing (ESC SP n)
};

/**
 * Generate a divider line
 */
function generateDivider(char: string = '-', width: number = 32): string {
    return char.repeat(width);
}

/**
 * Generate token receipt as ESC/POS byte array
 * Compact design with HUGE token number
 */
export function generateTokenReceipt(data: TokenData): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    // Helper to add command bytes
    const addCommand = (cmd: number[]) => {
        parts.push(...cmd);
    };

    // Helper to add text
    const addText = (text: string) => {
        const encoded = encoder.encode(text);
        parts.push(...encoded);
    };

    // Extract just the number from token (remove any prefix like "T-")
    const tokenNumberOnly = data.tokenNumber.replace(/^[A-Za-z-]+/, '');

    // Initialize printer
    addCommand(COMMANDS.INIT);

    // === HEADER (Compact) ===
    addCommand(COMMANDS.CENTER);
    // Om Muruga blessing - prints reliably on all thermal printers
    addText('~~~ Om Muruga ~~~\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('KONGUNAD KIDNEY CENTRE\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText(generateDivider('=') + '\n');

    // === TOKEN NUMBER (HUGE - 4x size) ===
    addCommand(COMMANDS.CENTER);
    addCommand(COMMANDS.QUADRUPLE_SIZE);
    addCommand(COMMANDS.BOLD_ON);
    // Add character spacing (80 dots = ~10mm = 1cm) for clear digit separation
    addCommand([...COMMANDS.CHAR_SPACING, 0x50]);
    // Split digits and join without manual spaces (ESC SP command handles spacing)
    const spacedToken = tokenNumberOnly.split('').join('');
    addText(spacedToken + '\n');
    // Reset character spacing (0 dots)
    addCommand([...COMMANDS.CHAR_SPACING, 0x00]);
    addCommand(COMMANDS.NORMAL_SIZE);
    addCommand(COMMANDS.BOLD_OFF);

    // === PATIENT DETAILS (Compact - no department) ===
    addCommand(COMMANDS.LEFT);
    addText(generateDivider('-') + '\n');

    // Patient Name
    addCommand(COMMANDS.BOLD_ON);
    addText('Patient: ');
    addCommand(COMMANDS.BOLD_OFF);
    addText(data.patientName + '\n');

    // MR Number (if provided)
    if (data.mrNumber) {
        addCommand(COMMANDS.BOLD_ON);
        addText('MR. NO: ');
        addCommand(COMMANDS.BOLD_OFF);
        addText(data.mrNumber + '\n');
    }

    // Doctor
    addCommand(COMMANDS.BOLD_ON);
    addText('Doctor: ');
    addCommand(COMMANDS.BOLD_OFF);
    const doctorName = data.doctorName.toLowerCase().startsWith('dr.')
        ? data.doctorName
        : 'Dr. ' + data.doctorName;
    addText(doctorName + '\n');

    addText(generateDivider('-') + '\n');

    // === DATE & TIME (Compact - single line) ===
    addCommand(COMMANDS.CENTER);
    addText(data.date + '  ' + data.time + '\n');

    // === FOOTER ===
    addText(generateDivider('=') + '\n');
    addText('For feedback & queries\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('Ph: 8056391682\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText('IG: @kongunad_kidney_centre\n');
    addText(generateDivider('=') + '\n');

    // BeanHealth branding
    addCommand(COMMANDS.CENTER);
    addText('BeanHealth\n');

    // Feed some lines and cut
    addCommand(COMMANDS.FEED_LINES_3);
    addCommand(COMMANDS.PAPER_CUT);

    return new Uint8Array(parts);
}

/**
 * Create TokenData from patient registration info
 */
export function createTokenData(params: {
    tokenNumber: string;
    patientName: string;
    mrNumber?: string;
    doctorName: string;
    department: string;
}): TokenData {
    const now = new Date();

    return {
        hospitalName: 'BeanHealth',
        tokenNumber: params.tokenNumber,
        patientName: params.patientName,
        mrNumber: params.mrNumber,
        doctorName: params.doctorName,
        department: params.department,
        date: now.toLocaleDateString('en-GB'), // DD/MM/YYYY format
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
}

export default { generateTokenReceipt, createTokenData };
