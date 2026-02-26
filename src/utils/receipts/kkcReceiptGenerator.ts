/**
 * KKC Receipt Generator
 * ─────────────────────
 * This is the original KKC thermal receipt implementation.
 * Hardcoded values are intentional — this is KKC's exclusive template.
 * DO NOT modify this file for other hospitals. Create a new generator instead.
 */

import { TokenData } from '../tokenReceiptGenerator';

const ESC = 0x1B;
const GS  = 0x1D;

const COMMANDS = {
    INIT:            [ESC, 0x40],
    CENTER:          [ESC, 0x61, 0x01],
    LEFT:            [ESC, 0x61, 0x00],
    BOLD_ON:         [ESC, 0x45, 0x01],
    BOLD_OFF:        [ESC, 0x45, 0x00],
    DOUBLE_SIZE:     [GS,  0x21, 0x11],
    QUADRUPLE_SIZE:  [GS,  0x21, 0x33],
    NORMAL_SIZE:     [GS,  0x21, 0x00],
    FEED_LINES_3:    [ESC, 0x64, 0x03],
    PAPER_CUT:       [GS,  0x56, 0x00],
};

function generateDivider(char = '-', width = 32): string {
    return char.repeat(width);
}

export function generateKKCReceipt(data: TokenData): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    const addCommand = (cmd: number[]) => parts.push(...cmd);
    const addText    = (text: string)   => parts.push(...encoder.encode(text));

    const tokenNumberOnly = data.tokenNumber.replace(/^[A-Za-z-]+/, '');

    addCommand(COMMANDS.INIT);
    addCommand(COMMANDS.CENTER);
    addText('~~~ Om Muruga ~~~\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('KONGUNAD KIDNEY CENTRE\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText(generateDivider('=') + '\n');

    addCommand(COMMANDS.CENTER);
    addCommand(COMMANDS.QUADRUPLE_SIZE);
    addCommand(COMMANDS.BOLD_ON);
    addText(tokenNumberOnly + '\n');
    addCommand(COMMANDS.NORMAL_SIZE);
    addCommand(COMMANDS.BOLD_OFF);

    addCommand(COMMANDS.LEFT);
    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.BOLD_ON);
    addText('Patient: ');
    addCommand(COMMANDS.BOLD_OFF);
    addText(data.patientName + '\n');

    if (data.mrNumber) {
        addCommand(COMMANDS.BOLD_ON);
        addText('MR. NO: ');
        addCommand(COMMANDS.BOLD_OFF);
        addText(data.mrNumber + '\n');
    }

    addCommand(COMMANDS.BOLD_ON);
    addText('Doctor: ');
    addCommand(COMMANDS.BOLD_OFF);
    const doctorName = data.doctorName.toLowerCase().startsWith('dr.')
        ? data.doctorName
        : 'Dr. ' + data.doctorName;
    addText(doctorName + '\n');

    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.CENTER);
    addText(data.date + '  ' + data.time + '\n');

    addText(generateDivider('=') + '\n');
    addText('For feedback & queries\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('Ph: 8056391682\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText('IG: @kongunad_kidney_centre\n');
    addText(generateDivider('=') + '\n');

    addCommand(COMMANDS.CENTER);
    addText('BeanHealth\n');

    addCommand(COMMANDS.FEED_LINES_3);
    addCommand(COMMANDS.PAPER_CUT);

    return new Uint8Array(parts);
}
