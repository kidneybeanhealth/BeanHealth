/**
 * Standard Receipt Generator
 * ──────────────────────────
 * Generic thermal receipt for non-KKC hospitals.
 * Pulls hospital name, contact, and branding from TenantContext.
 */

import { TokenData } from '../tokenReceiptGenerator';
import { HospitalProfile, getTenantDisplayName, getTenantPhone } from '../../contexts/TenantContext';

const ESC = 0x1B;
const GS  = 0x1D;

const COMMANDS = {
    INIT:            [ESC, 0x40],
    CENTER:          [ESC, 0x61, 0x01],
    LEFT:            [ESC, 0x61, 0x00],
    BOLD_ON:         [ESC, 0x45, 0x01],
    BOLD_OFF:        [ESC, 0x45, 0x00],
    QUADRUPLE_SIZE:  [GS,  0x21, 0x33],
    NORMAL_SIZE:     [GS,  0x21, 0x00],
    FEED_LINES_3:    [ESC, 0x64, 0x03],
    PAPER_CUT:       [GS,  0x56, 0x00],
};

function generateDivider(char = '-', width = 32): string {
    return char.repeat(width);
}

export function generateStandardReceipt(data: TokenData, tenant: HospitalProfile): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    const addCommand = (cmd: number[]) => parts.push(...cmd);
    const addText    = (text: string)   => parts.push(...encoder.encode(text));

    const tokenNumberOnly = data.tokenNumber.replace(/^[A-Za-z-]+/, '');
    const hospitalName    = getTenantDisplayName(tenant);
    const phone           = getTenantPhone(tenant);

    addCommand(COMMANDS.INIT);
    addCommand(COMMANDS.CENTER);

    // Religious / blessing header — only if configured in DB
    if (tenant.config.show_religious_header && tenant.config.religious_header_text) {
        addText(tenant.config.religious_header_text + '\n');
    }

    addCommand(COMMANDS.BOLD_ON);
    addText(hospitalName.toUpperCase() + '\n');
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

    // Footer contact — only if configured
    if (phone || tenant.footer_instagram) {
        addText(generateDivider('=') + '\n');
        addText('For feedback & queries\n');
        if (phone) {
            addCommand(COMMANDS.BOLD_ON);
            addText('Ph: ' + (tenant.footer_phone || phone) + '\n');
            addCommand(COMMANDS.BOLD_OFF);
        }
        if (tenant.footer_instagram) {
            addText('IG: ' + tenant.footer_instagram + '\n');
        }
    }

    addText(generateDivider('=') + '\n');
    addCommand(COMMANDS.CENTER);
    addText('Powered by BeanHealth\n');

    addCommand(COMMANDS.FEED_LINES_3);
    addCommand(COMMANDS.PAPER_CUT);

    return new Uint8Array(parts);
}
